from pydantic import Field

from app.reels.models import ReelStatus
from app.shared.schema import CamelModel


class ReelOut(CamelModel):
    """An invitation's video, as the owner's "download your video" section needs it."""

    available: bool = Field(
        description="Whether this invitation can have a video: it is published, its payment "
        "is complete and its template has a film. When false the other fields are empty."
    )
    status: ReelStatus | None = Field(
        default=None, description="State of the latest render; null if none was ever requested."
    )
    progress: int = Field(default=0, description="Percent done while status is RENDERING.")
    download_url: str | None = Field(
        default=None,
        description="Where to download the latest finished video. Stays set while a newer "
        "render is running or after one fails. Signed and short-lived on a private bucket.",
    )
    size_bytes: int | None = Field(default=None, description="Size of the video at downloadUrl.")
    is_stale: bool = Field(
        default=False,
        description="True when the invitation was edited after the video at downloadUrl "
        "was made, so the video no longer shows the latest details.",
    )
