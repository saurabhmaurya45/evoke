"""Renders queued invitation videos: `python -m app.reels.worker`.

Runs as its own long-lived process with Node and Chromium beside it (see
reel-worker.Dockerfile), because a render takes minutes of CPU and the API runs on
Vercel's short-lived functions. It shares the API's database, which is the queue:
claiming uses FOR UPDATE SKIP LOCKED, so any number of workers can run at once. No
transaction stays open during a render.
"""

import asyncio
import json
import logging
import os
import re
import signal
import subprocess
import sys
import tempfile
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

import app.db_models  # noqa: F401  (registers all models on Base.metadata)
from app.config import Settings, get_settings
from app.drafts.models import Draft
from app.events.models import Event, EventStatus
from app.media.paths import event_reel_path
from app.media.service import resolve_media_refs
from app.reels.models import EventReel, ReelStatus
from app.shared.database import _session_factory
from app.shared.observability import configure_logging, init_sentry
from app.shared.storage.b2_client import B2Client, get_b2_client

logger = logging.getLogger("evoke.reels")

MAX_ATTEMPTS = 3
POLL_INTERVAL_SECONDS = 5
HEARTBEAT_INTERVAL_SECONDS = 30
# A render with no heartbeat for this long lost its worker (crash, redeploy).
STALE_AFTER = timedelta(minutes=5)

_DEFAULT_TOOL_DIR = Path(__file__).resolve().parents[3] / "tools" / "reel"
_PROGRESS_LINE = re.compile(r"^\s*(\d{1,3})%\s*$")
_URL_QUERY = re.compile(r"(https?://[^\s?]+)\?\S*")

Renderer = Callable[[str, dict, Path, Callable[[int], None]], Awaitable[None]]


class RenderError(Exception):
    pass


def allowed_media_hosts(settings: Settings) -> list[str]:
    """Hosts a film may fetch from: our own bucket. Saved invitation data can hold any
    URL, and this process runs next to internal services, so nothing else is reachable."""
    urls = (settings.public_media_base_url, settings.b2_endpoint_url)
    return sorted({host for url in urls if url and (host := urlsplit(url).hostname)})


def _stop(process: asyncio.subprocess.Process) -> None:
    """Stops the render and the Chromium and ffmpeg it started."""
    if process.returncode is not None:
        return
    if sys.platform == "win32":
        process.kill()
    else:
        os.killpg(process.pid, signal.SIGKILL)


async def render_with_make_reel(
    slot_id: str, data: dict, out: Path, on_progress: Callable[[int], None]
) -> None:
    settings = get_settings()
    tool_dir = Path(settings.reel_tool_dir) if settings.reel_tool_dir else _DEFAULT_TOOL_DIR
    data_file = out.with_suffix(".json")
    data_file.write_text(json.dumps(data), encoding="utf-8")

    process = await asyncio.create_subprocess_exec(
        "node",
        "make-reel.mjs",
        slot_id,
        "--data",
        str(data_file),
        "--out",
        str(out),
        "--allow-hosts",
        ",".join(allowed_media_hosts(settings)),
        cwd=tool_dir,
        stdout=asyncio.subprocess.PIPE,
        stderr=subprocess.STDOUT,
        start_new_session=sys.platform != "win32",
    )
    output: list[str] = []

    async def read_output() -> None:
        assert process.stdout is not None
        async for raw in process.stdout:
            line = raw.decode(errors="replace").rstrip()
            match = _PROGRESS_LINE.match(line)
            if match:
                on_progress(int(match.group(1)))
            else:
                output.append(line)

    try:
        await asyncio.wait_for(
            asyncio.gather(read_output(), process.wait()),
            timeout=settings.reel_render_timeout_seconds,
        )
    except TimeoutError as exc:
        raise RenderError(
            f"Timed out after {settings.reel_render_timeout_seconds}s"
        ) from exc
    finally:
        _stop(process)
        await process.wait()
    if process.returncode != 0:
        raise RenderError("\n".join(output[-5:]))


async def requeue_abandoned(db: AsyncSession) -> None:
    """Gives renders whose worker died back to the queue, or fails them after MAX_ATTEMPTS."""
    now = datetime.now(UTC)
    abandoned = EventReel.status == ReelStatus.RENDERING, EventReel.heartbeat_at < now - STALE_AFTER
    await db.execute(
        update(EventReel)
        .where(*abandoned, EventReel.attempts >= MAX_ATTEMPTS)
        .values(status=ReelStatus.FAILED, completed_at=now, failure_reason="Worker lost")
    )
    await db.execute(
        update(EventReel).where(*abandoned).values(status=ReelStatus.QUEUED, progress=0)
    )
    await db.commit()


async def claim_next(db: AsyncSession) -> uuid.UUID | None:
    """Atomically takes the oldest queued render. Commits, so the row lock is released
    before rendering starts; heartbeats keep the claim alive from then on."""
    reel = (
        await db.execute(
            select(EventReel)
            .where(EventReel.status == ReelStatus.QUEUED)
            .order_by(EventReel.created_at)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
    ).scalar_one_or_none()
    if reel is None:
        await db.rollback()
        return None
    reel_id = reel.id
    reel.status = ReelStatus.RENDERING
    reel.attempts += 1
    reel.progress = 0
    reel.heartbeat_at = datetime.now(UTC)
    await db.commit()
    return reel_id


async def _heartbeat(session_factory, reel_id: uuid.UUID, progress: list[int]) -> None:
    while True:
        await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
        async with session_factory() as db:
            await db.execute(
                update(EventReel)
                .where(EventReel.id == reel_id, EventReel.status == ReelStatus.RENDERING)
                .values(heartbeat_at=datetime.now(UTC), progress=progress[0])
            )
            await db.commit()


async def _record_failure(session_factory, reel_id: uuid.UUID, error: Exception) -> None:
    """Retries a failed render until MAX_ATTEMPTS. The reason is kept for operators with
    URL query strings stripped, because they can hold storage signatures."""
    reason = _URL_QUERY.sub(r"\1", str(error))[-1000:]
    async with session_factory() as db:
        reel = await db.get(EventReel, reel_id)
        if reel is None:
            return
        reel.failure_reason = reason
        reel.progress = 0
        if reel.attempts >= MAX_ATTEMPTS:
            reel.status = ReelStatus.FAILED
            reel.completed_at = datetime.now(UTC)
        else:
            reel.status = ReelStatus.QUEUED
        await db.commit()


async def _replace_older_videos(
    db: AsyncSession, b2: B2Client, event_id: uuid.UUID, keep: uuid.UUID
) -> None:
    """Only the newest video is kept, so re-rendering doesn't grow storage forever."""
    older = (
        (
            await db.execute(
                select(EventReel).where(
                    EventReel.event_id == event_id,
                    EventReel.id != keep,
                    EventReel.storage_path.is_not(None),
                )
            )
        )
        .scalars()
        .all()
    )
    for reel in older:
        assert reel.storage_path is not None
        try:
            await asyncio.to_thread(b2.delete_object, reel.storage_path)
        except Exception:
            logger.exception("Could not delete old video %s", reel.id)
            continue
        reel.storage_path = None
        reel.size_bytes = None
    await db.commit()


async def process_reel(
    reel_id: uuid.UUID,
    *,
    b2: B2Client,
    session_factory=_session_factory,
    renderer: Renderer = render_with_make_reel,
) -> None:
    """Renders one claimed job from the invitation's current data and stores the video."""
    async with session_factory() as db:
        reel = await db.get(EventReel, reel_id)
        assert reel is not None
        event = await db.get(Event, reel.event_id)
        draft = (
            await db.execute(select(Draft).where(Draft.event_id == reel.event_id))
        ).scalar_one_or_none()
        if event is None or draft is None or event.status != EventStatus.PUBLISHED:
            # Archived while it waited: nobody should get a video of it, and retrying won't help.
            reel.status = ReelStatus.FAILED
            reel.completed_at = datetime.now(UTC)
            reel.failure_reason = "Invitation is no longer published"
            await db.commit()
            return
        event_id, owner_id, slug = event.id, event.owner_id, event.slug
        slot_id = reel.template_slot_id
        reel.draft_revision = draft.revision
        data = resolve_media_refs(b2, draft.data)
        await db.commit()

    progress = [0]

    def on_progress(percent: int) -> None:
        # The last few percent are the upload, so a bar never sits at 100% still working.
        progress[0] = min(percent, 95)

    heartbeat = asyncio.create_task(_heartbeat(session_factory, reel_id, progress))
    try:
        with tempfile.TemporaryDirectory(prefix="reel-") as work_dir:
            out = Path(work_dir) / "reel.mp4"
            await renderer(slot_id, data, out, on_progress)
            key = event_reel_path(owner_id, event_id)
            await asyncio.to_thread(b2.upload_file, key, out, "video/mp4", f"{slug}-video.mp4")
            size = out.stat().st_size
    except Exception as exc:  # noqa: BLE001 — every failure is recorded on the job, then retried
        logger.warning("Render of reel %s failed: %s", reel_id, _URL_QUERY.sub(r"\1", str(exc)))
        await _record_failure(session_factory, reel_id, exc)
        return
    finally:
        heartbeat.cancel()

    async with session_factory() as db:
        reel = await db.get(EventReel, reel_id)
        assert reel is not None
        reel.status = ReelStatus.READY
        reel.storage_path = key
        reel.size_bytes = size
        reel.progress = 100
        reel.failure_reason = None
        reel.completed_at = datetime.now(UTC)
        await db.commit()
        await _replace_older_videos(db, b2, event_id, reel_id)
    logger.info("Reel %s ready (%.1f MB)", reel_id, size / 1e6)


async def run_forever() -> None:
    b2 = get_b2_client()
    if b2 is None:
        raise SystemExit("Media storage isn't configured: the worker has nowhere to put videos.")
    logger.info("Reel worker started, media hosts: %s", allowed_media_hosts(get_settings()))
    while True:
        try:
            async with _session_factory() as db:
                await requeue_abandoned(db)
                reel_id = await claim_next(db)
            if reel_id is not None:
                logger.info("Rendering reel %s", reel_id)
                await process_reel(reel_id, b2=b2)
                continue
        except Exception:
            logger.exception("Reel worker loop failed; retrying")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    _settings = get_settings()
    configure_logging(_settings)
    init_sentry(_settings)
    asyncio.run(run_forever())
