from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError

from app.shared.storage.b2_client import B2Client


def _client() -> B2Client:
    client = B2Client(
        endpoint_url="https://s3.us-east-005.backblazeb2.com",
        bucket="evoke-media",
        producer_key_id="producer-key",
        producer_key_secret="producer-secret",
        consumer_key_id="consumer-key",
        consumer_key_secret="consumer-secret",
    )
    client._producer = MagicMock()
    client._consumer = MagicMock()
    return client


def test_presign_put_uses_producer_key_and_scopes_content_type():
    client = _client()
    client._producer.generate_presigned_url.return_value = "https://signed.example/put"

    url = client.presign_put("asset/tpl-1/image/abc.jpg", "image/jpeg", 600)

    assert url == "https://signed.example/put"
    client._producer.generate_presigned_url.assert_called_once_with(
        ClientMethod="put_object",
        Params={
            "Bucket": "evoke-media",
            "Key": "asset/tpl-1/image/abc.jpg",
            "ContentType": "image/jpeg",
        },
        ExpiresIn=600,
    )
    client._consumer.generate_presigned_url.assert_not_called()


def test_presign_get_uses_consumer_key():
    client = _client()
    client._consumer.generate_presigned_url.return_value = "https://signed.example/get"

    url = client.presign_get("asset/tpl-1/image/abc.jpg", 900)

    assert url == "https://signed.example/get"
    client._consumer.generate_presigned_url.assert_called_once_with(
        ClientMethod="get_object",
        Params={"Bucket": "evoke-media", "Key": "asset/tpl-1/image/abc.jpg"},
        ExpiresIn=900,
    )
    client._producer.generate_presigned_url.assert_not_called()


def test_head_object_returns_metadata_for_existing_key():
    client = _client()
    client._producer.head_object.return_value = {"ContentLength": 2048, "ContentType": "image/jpeg"}

    result = client.head_object("asset/tpl-1/image/abc.jpg")

    assert result == {"ContentLength": 2048, "ContentType": "image/jpeg"}
    client._producer.head_object.assert_called_once_with(
        Bucket="evoke-media", Key="asset/tpl-1/image/abc.jpg"
    )


def _client_error(code: str, status_code: int) -> ClientError:
    return ClientError(
        {
            "Error": {"Code": code, "Message": "not found"},
            "ResponseMetadata": {"HTTPStatusCode": status_code},
        },
        "HeadObject",
    )


def test_head_object_returns_none_for_missing_key():
    client = _client()
    client._producer.head_object.side_effect = _client_error("404", 404)

    assert client.head_object("asset/tpl-1/image/missing.jpg") is None


def test_head_object_returns_none_for_no_such_key_error_code():
    client = _client()
    client._producer.head_object.side_effect = _client_error("NoSuchKey", 404)

    assert client.head_object("asset/tpl-1/image/missing.jpg") is None


def test_head_object_reraises_unexpected_client_error():
    client = _client()
    client._producer.head_object.side_effect = _client_error("403", 403)

    with pytest.raises(ClientError):
        client.head_object("asset/tpl-1/image/forbidden.jpg")
