from pydantic import Field

from app.reels.models import ReelStatus
from app.shared.schema import CamelModel


class ReelOut(CamelModel):
    """An invitation's video: its watermarked preview, and the bought video once paid for."""

    available: bool = Field(
        description="Whether this invitation can have a video: videos are switched on and its "
        "template has a film. When false only the price is set."
    )
    purchased: bool = Field(
        default=False,
        description="Whether the video was paid for. Until then only the watermarked preview "
        "is available, and the download fields stay empty.",
    )
    price_minor: int = Field(
        description="What the video costs, in minor units (paise): the same as the template, "
        "or a fixed price when the template is free."
    )
    currency: str = Field(description="ISO currency code of priceMinor, e.g. 'INR'.")

    preview_status: ReelStatus | None = Field(
        default=None, description="State of the latest preview render; null if none was requested."
    )
    preview_progress: int = Field(
        default=0, description="Percent done while previewStatus is RENDERING."
    )
    preview_url: str | None = Field(
        default=None,
        description="The latest finished preview: low resolution, with a watermark burned into "
        "every frame, so it is safe to show before payment.",
    )
    preview_is_stale: bool = Field(
        default=False,
        description="True when the invitation was edited after the preview at previewUrl was made.",
    )

    status: ReelStatus | None = Field(
        default=None,
        description="State of the latest render of the bought video; null if none was made yet. "
        "Only set once purchased.",
    )
    progress: int = Field(default=0, description="Percent done while status is RENDERING.")
    download_url: str | None = Field(
        default=None,
        description="Where to download the bought video. Only set once purchased. Stays set "
        "while a newer render is running or after one fails.",
    )
    size_bytes: int | None = Field(default=None, description="Size of the video at downloadUrl.")
    is_stale: bool = Field(
        default=False,
        description="True when the invitation was edited after the video at downloadUrl "
        "was made. A new one is made when the invitation is next published.",
    )
