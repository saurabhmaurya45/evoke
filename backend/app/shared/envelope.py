from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Envelope(BaseModel, Generic[T]):
    """Standard single-resource response envelope: {"data": {...}}."""

    data: T
