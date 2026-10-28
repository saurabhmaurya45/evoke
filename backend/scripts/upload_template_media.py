"""Publish the templates' built-in media to the public R2 bucket the site serves it from.

The heavy files under `frontend/public/invitation-templates/` (videos, audio, images)
are not deployed with the site: production loads them straight from the public media
bucket (`environment.mediaBaseUrl` in the frontend, plus a vercel.json redirect for
media referenced from inside a template page). This script keeps that bucket in sync
with the repo, under the `asset/` prefix:

  frontend/public/invitation-templates/template 4/card.mp4
    -> <bucket>/asset/invitation-templates/template 4/card.mp4
    -> <PUBLIC_MEDIA_BASE_URL>/asset/invitation-templates/template%204/card.mp4

(`asset/` is the same prefix the media API uses for base template media, see
app.media.paths; the `invitation-templates/` sub-tree never collides with its
`asset/<template-id>/…` keys.)

The media files themselves are no longer kept in the repo (the bucket is the source of truth).
To add or replace a template's media, put the file back under
`frontend/public/invitation-templates/template N/…` locally, run this script, and don't commit
the file. (Older copies live in git history, e.g. `git checkout de7a51e~1 -- frontend/public`.)

An external, idempotent script — never run by the app itself.

  cd backend
  python scripts/upload_template_media.py            # dry run: what would be uploaded
  python scripts/upload_template_media.py --apply    # upload

Idempotent: an object whose size and MD5 already match is skipped.

Uses the app's own storage settings from `.env` (B2_ENDPOINT_URL, B2_BUCKET_NAME,
B2_PRODUCER_KEY_ID / B2_PRODUCER_KEY_SECRET — an Object Read & Write key). It does not
touch the bucket's public-access or CORS settings; configure those in the Cloudflare
dashboard.
"""

import argparse
import hashlib
import mimetypes
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote, urlsplit

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from pydantic_settings import BaseSettings, SettingsConfigDict

MEDIA_ROOT = Path(__file__).resolve().parents[2] / "frontend" / "public"
TEMPLATES_DIR = MEDIA_ROOT / "invitation-templates"
KEY_PREFIX = "asset/"

# Must match the redirect in frontend/vercel.json and the ignore glob in angular.json.
MEDIA_EXTENSIONS = {".mp4", ".webm", ".mp3", ".m4a", ".jpg", ".jpeg", ".png", ".webp", ".gif"}

# A day, then revalidate: file names aren't content-hashed, so a replaced file must
# not stay cached for a year.
CACHE_CONTROL = "public, max-age=86400, must-revalidate"

UPLOAD_WORKERS = 6


class _Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    b2_endpoint_url: str | None = None
    b2_bucket_name: str | None = None
    b2_producer_key_id: str | None = None
    b2_producer_key_secret: str | None = None
    public_media_base_url: str | None = None


def media_files() -> list[Path]:
    return sorted(
        p for p in TEMPLATES_DIR.rglob("*") if p.is_file() and p.suffix.lower() in MEDIA_EXTENSIONS
    )


def object_key(path: Path) -> str:
    return KEY_PREFIX + path.relative_to(MEDIA_ROOT).as_posix()


def content_type(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def md5_hex(path: Path) -> str:
    # MD5 only because the S3 ETag is one — compared for change detection, not security.
    digest = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def region_for(endpoint_url: str) -> str | None:
    host = urlsplit(endpoint_url).hostname or ""
    return "auto" if host.endswith(".r2.cloudflarestorage.com") else None


def remote_etag(client, bucket: str, key: str) -> tuple[int, str] | None:
    try:
        head = client.head_object(Bucket=bucket, Key=key)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
            return None
        raise
    return head["ContentLength"], head["ETag"].strip('"')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--apply", action="store_true", help="upload (default: dry run)")
    args = parser.parse_args()

    settings = _Settings()
    missing = [
        name
        for name, value in {
            "B2_ENDPOINT_URL": settings.b2_endpoint_url,
            "B2_BUCKET_NAME": settings.b2_bucket_name,
            "B2_PRODUCER_KEY_ID": settings.b2_producer_key_id,
            "B2_PRODUCER_KEY_SECRET": settings.b2_producer_key_secret,
        }.items()
        if not value
    ]
    if missing:
        sys.exit("Missing settings: " + ", ".join(missing))

    bucket = settings.b2_bucket_name
    client = boto3.client(
        "s3",
        endpoint_url=settings.b2_endpoint_url,
        aws_access_key_id=settings.b2_producer_key_id,
        aws_secret_access_key=settings.b2_producer_key_secret,
        region_name=region_for(settings.b2_endpoint_url),
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            retries={"max_attempts": 5},
            max_pool_connections=UPLOAD_WORKERS * 2,
        ),
    )

    files = media_files()
    total = sum(p.stat().st_size for p in files)
    print(f"{len(files)} media files, {total / 1024 / 1024:.1f} MB, bucket {bucket}, prefix {KEY_PREFIX}")

    def sync(path: Path) -> tuple[str, str]:
        key = object_key(path)
        size = path.stat().st_size
        if remote_etag(client, bucket, key) == (size, md5_hex(path)):
            return "skipped", key
        if not args.apply:
            return "would upload", f"{key} ({size / 1024:.0f} KB)"
        # put_object, not upload_file: a single PUT keeps the ETag equal to the MD5,
        # which is what makes the skip check above work.
        with path.open("rb") as body:
            client.put_object(
                Bucket=bucket,
                Key=key,
                Body=body,
                ContentType=content_type(path),
                CacheControl=CACHE_CONTROL,
            )
        return "uploaded", key

    counts = {"uploaded": 0, "would upload": 0, "skipped": 0}
    failures: list[str] = []
    with ThreadPoolExecutor(max_workers=UPLOAD_WORKERS) as pool:
        futures = {pool.submit(sync, p): p for p in files}
        for future, path in futures.items():
            try:
                outcome, detail = future.result()
            except Exception as exc:  # report every failure, keep going
                failures.append(f"{object_key(path)}: {exc}")
                continue
            counts[outcome] += 1
            if outcome != "skipped":
                print(f"  {outcome} {detail}")

    print(
        f"done: {counts['uploaded']} uploaded, {counts['would upload']} to upload, "
        f"{counts['skipped']} unchanged, {len(failures)} failed"
    )
    for line in failures:
        print("  FAILED", line)
    base = (settings.public_media_base_url or "<PUBLIC_MEDIA_BASE_URL>").rstrip("/")
    print(f"frontend mediaBaseUrl should be: {base}/{KEY_PREFIX.rstrip('/')}")
    print(f"example: {base}/{KEY_PREFIX}invitation-templates/{quote('template 4')}/card.mp4")
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
