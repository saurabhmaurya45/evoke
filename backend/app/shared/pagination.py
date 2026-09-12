from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel

from app.shared.schema import CamelModel

T = TypeVar("T")

MAX_PAGE_SIZE = 100


class PageParams(BaseModel):
    page: int = 1
    page_size: int = 20


def page_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=MAX_PAGE_SIZE),
) -> PageParams:
    return PageParams(page=page, page_size=page_size)


class Pagination(CamelModel):
    page: int
    page_size: int
    total: int


class Page(CamelModel, Generic[T]):
    data: list[T]
    pagination: Pagination


def make_page(items: list[T], total: int, params: PageParams) -> Page[T]:
    return Page[T](
        data=items,
        pagination=Pagination(page=params.page, page_size=params.page_size, total=total),
    )
