"""Set the B2 bucket's CORS rules so browsers can upload to it directly.

Media uploads are a browser → B2 `PUT` to a presigned URL (see
aidlc-docs/construction/1-1-media-upload-b2-frontend-integration.md). That is a
cross-origin request with a `Content-Type` header, so the browser sends a CORS
preflight first — and without a CORS rule on the bucket every upload fails before
a single byte is sent. Signed `GET`s for <img>/<audio> tags don't need this, but a
`fetch()` of one would, so GET/HEAD are allowed too.

An external, idempotent script — never run by the app itself. Allowed origins are
the API's own `CORS_ORIGINS` (the frontend origins), unless `--origin` is given.

  cd backend
  .venv/Scripts/python scripts/configure_b2_cors.py            # dry run: shows current + planned rules
  .venv/Scripts/python scripts/configure_b2_cors.py --apply    # writes

Changing bucket settings needs a B2 application key with the `writeBuckets`
capability. The app's Producer/Consumer keys normally don't have it (and
shouldn't), so set B2_ADMIN_KEY_ID / B2_ADMIN_KEY_SECRET for this script; it falls
back to the Producer key if those are unset.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.config import get_settings

class _AdminKey(BaseSettings):
    """Read from the environment or .env, like the app's own settings — but only
    here: the app never needs bucket-level permissions."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    b2_admin_key_id: str | None = None
    b2_admin_key_secret: str | None = None


# Presigned URLs stay valid for 10 minutes, so caching a preflight for an hour is safe.
_MAX_AGE_SECONDS = 3600


def build_rules(origins: list[str]) -> dict:
    return {
        "CORSRules": [
            {
                "ID": "evoke-browser-uploads",
                "AllowedOrigins": origins,
                "AllowedMethods": ["PUT", "GET", "HEAD"],
                # The presigned PUT is signed over Content-Type, so the browser must send it.
                "AllowedHeaders": ["content-type"],
                "ExposeHeaders": ["ETag"],
                "MaxAgeSeconds": _MAX_AGE_SECONDS,
            }
        ]
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--apply", action="store_true", help="write the rules (default: dry run)")
    parser.add_argument(
        "--origin",
        action="append",
        help="allowed origin (repeatable); defaults to the API's CORS_ORIGINS",
    )
    args = parser.parse_args()

    settings = get_settings()
    if not (settings.b2_endpoint_url and settings.b2_bucket_name):
        print("B2_ENDPOINT_URL and B2_BUCKET_NAME must be set.", file=sys.stderr)
        return 1
    admin = _AdminKey()
    key_id = admin.b2_admin_key_id or settings.b2_producer_key_id
    key_secret = admin.b2_admin_key_secret or settings.b2_producer_key_secret
    if not (key_id and key_secret):
        print("Set B2_ADMIN_KEY_ID / B2_ADMIN_KEY_SECRET (or the Producer key).", file=sys.stderr)
        return 1

    origins = args.origin or settings.cors_origin_list
    if not origins or "*" in origins:
        print("Refusing to allow uploads from any origin — list them explicitly.", file=sys.stderr)
        return 1

    s3 = boto3.client(
        "s3",
        endpoint_url=settings.b2_endpoint_url,
        aws_access_key_id=key_id,
        aws_secret_access_key=key_secret,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
    bucket = settings.b2_bucket_name

    try:
        current = s3.get_bucket_cors(Bucket=bucket).get("CORSRules", [])
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "NoSuchCORSConfiguration":
            raise
        current = []
    rules = build_rules(origins)

    print(f"Bucket: {bucket}")
    print("Current CORS rules:", json.dumps(current, indent=2) if current else "none")
    print("Planned CORS rules:", json.dumps(rules["CORSRules"], indent=2))

    if not args.apply:
        print("\nDry run — re-run with --apply to write.")
        return 0

    s3.put_bucket_cors(Bucket=bucket, CORSConfiguration=rules)
    print("\nCORS rules written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
