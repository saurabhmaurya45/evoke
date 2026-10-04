import re
import uuid

from app.media.models import MediaType
from app.media.paths import base_template_media_path, user_template_media_path

_UUID_RE = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"


def test_base_template_media_path_shape():
    template_id = uuid.uuid4()
    path = base_template_media_path(template_id, MediaType.IMAGE, "hero-photo.jpg")
    assert re.fullmatch(rf"asset/{template_id}/image/{_UUID_RE}\.jpg", path)


def test_user_template_media_path_shape():
    user_id = uuid.uuid4()
    event_id = uuid.uuid4()
    path = user_template_media_path(user_id, event_id, MediaType.VIDEO, "clip.mp4")
    assert re.fullmatch(rf"public/{user_id}/{event_id}/video/{_UUID_RE}\.mp4", path)


def test_extension_is_preserved():
    path = base_template_media_path(uuid.uuid4(), MediaType.MUSIC, "song.mp3")
    assert path.endswith(".mp3")


def test_file_name_without_extension_has_no_trailing_dot():
    path = base_template_media_path(uuid.uuid4(), MediaType.IMAGE, "noext")
    assert not path.endswith(".")
    assert re.fullmatch(rf"asset/[0-9a-f-]+/image/{_UUID_RE}", path)


def test_client_supplied_name_never_appears_verbatim_in_path():
    path = base_template_media_path(uuid.uuid4(), MediaType.IMAGE, "../../etc/passwd.jpg")
    assert "passwd" not in path
    assert ".." not in path


def test_two_calls_produce_different_paths():
    template_id = uuid.uuid4()
    first = base_template_media_path(template_id, MediaType.IMAGE, "same-name.jpg")
    second = base_template_media_path(template_id, MediaType.IMAGE, "same-name.jpg")
    assert first != second
