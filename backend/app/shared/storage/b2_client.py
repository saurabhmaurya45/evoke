from functools import lru_cache
from urllib.parse import unquote, urlsplit

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from fastapi import status

from app.config import get_settings
from app.shared.errors import AppError

# B2's S3-compatible API requires path-style addressing and SigV4 — the boto3
# default (virtual-hosted-style) doesn't resolve against B2's endpoint.
_BOTO_CONFIG = Config(signature_version="s3v4", s3={"addressing_style": "path"})


def region_from_endpoint(endpoint_url: str) -> str | None:
    """`https://s3.us-east-005.backblazeb2.com` → `us-east-005`. SigV4 signatures
    are scoped to a region; without one boto3 signs for `us-east-1`, which isn't
    the bucket's region."""
    host = urlsplit(endpoint_url).hostname or ""
    parts = host.split(".")
    if len(parts) >= 3 and parts[0] == "s3" and host.endswith(".backblazeb2.com"):
        return parts[1]
    return None


class B2Client:
    """Thin wrapper over Backblaze B2's S3-compatible API, split across two
    credentials by pipeline stage (see aidlc-docs architecture doc, ADR-3):
    Producer (read+write) owns the upload pipeline — presigning PUT and
    verifying via HEAD; Consumer (read-only) owns the serving path —
    presigning GET. Neither key is ever used for the other's operations.
    """

    def __init__(
        self,
        *,
        endpoint_url: str,
        bucket: str,
        producer_key_id: str,
        producer_key_secret: str,
        consumer_key_id: str,
        consumer_key_secret: str,
    ) -> None:
        self.bucket = bucket
        self._endpoint = urlsplit(endpoint_url)
        region = region_from_endpoint(endpoint_url)
        self._producer = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=producer_key_id,
            aws_secret_access_key=producer_key_secret,
            region_name=region,
            config=_BOTO_CONFIG,
        )
        self._consumer = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=consumer_key_id,
            aws_secret_access_key=consumer_key_secret,
            region_name=region,
            config=_BOTO_CONFIG,
        )

    def presign_put(self, key: str, content_type: str, expires_in: int) -> str:
        """Presigned PUT URL, scoped to `key` and `content_type` (the client's PUT
        must send a matching Content-Type header or B2 rejects it as a signature
        mismatch). Issued from the Producer key — this is the upload pipeline."""
        return self._producer.generate_presigned_url(
            ClientMethod="put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=expires_in,
        )

    def presign_get(self, key: str, expires_in: int) -> str:
        """Presigned GET URL for serving media back to the browser. Issued from
        the Consumer key — this is the only thing the Consumer key is used for."""
        return self._consumer.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def key_from_presigned_url(self, url: str) -> str | None:
        """The object key a presigned URL from this bucket points at, or None for
        any other URL. Path-style addressing makes it `{endpoint}/{bucket}/{key}?…`.
        Lets a client send back the signed URLs it was given and have them stored
        as plain keys again (see app.media.service.to_storage_refs)."""
        try:
            parts = urlsplit(url)
        except ValueError:
            return None
        prefix = f"/{self.bucket}/"
        if (
            parts.scheme != self._endpoint.scheme
            or parts.netloc != self._endpoint.netloc
            or not parts.path.startswith(prefix)
        ):
            return None
        return unquote(parts.path[len(prefix) :]) or None

    def head_object(self, key: str) -> dict | None:
        """Confirms an object exists and returns its metadata (notably
        `ContentLength`), or `None` if it doesn't exist. Issued from the Producer
        key — this is part of verifying an upload the Producer key initiated,
        not ordinary content serving (see ADR-3)."""
        try:
            return self._producer.head_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")
            if error_code in ("404", "NoSuchKey"):
                return None
            raise


@lru_cache
def get_b2_client() -> B2Client | None:
    """None when any required setting is unset, so the app boots clean and media
    upload/retrieval is simply disabled until B2 is configured."""
    settings = get_settings()
    if not (
        settings.b2_endpoint_url
        and settings.b2_bucket_name
        and settings.b2_producer_key_id
        and settings.b2_producer_key_secret
        and settings.b2_consumer_key_id
        and settings.b2_consumer_key_secret
    ):
        return None
    return B2Client(
        endpoint_url=settings.b2_endpoint_url,
        bucket=settings.b2_bucket_name,
        producer_key_id=settings.b2_producer_key_id,
        producer_key_secret=settings.b2_producer_key_secret,
        consumer_key_id=settings.b2_consumer_key_id,
        consumer_key_secret=settings.b2_consumer_key_secret,
    )


def require_client(client: B2Client | None) -> B2Client:
    if client is None:
        raise AppError(
            "MEDIA_STORAGE_NOT_CONFIGURED",
            "Media storage is not configured on this server.",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return client
