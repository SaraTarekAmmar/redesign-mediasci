"""
Operation Hub — Pagination Utilities

Provides a reusable paginated response schema and helper function
that works with any SQLAlchemy query.
"""

import math
from typing import Any, Generic, TypeVar
from pydantic import BaseModel
from sqlalchemy.orm import Query

T = TypeVar("T")


class PaginatedResponse(BaseModel):
    """Standard paginated API response envelope."""
    data: list[Any] = []
    current_page: int = 1
    per_page: int = 15
    total: int = 0
    last_page: int = 1
    from_record: int = 0
    to_record: int = 0


def paginate(
    query: Query,
    page: int,
    per_page: int,
    serializer=None,
) -> PaginatedResponse:
    """
    Paginate a SQLAlchemy query and return a PaginatedResponse.

    Args:
        query:      SQLAlchemy query (not yet .all()'d)
        page:       1-indexed current page
        per_page:   items per page
        serializer: optional callable to convert each ORM object to dict
    """
    page = max(1, page)
    per_page = max(1, min(per_page, 200))

    total = query.count()
    last_page = max(1, math.ceil(total / per_page))
    offset = (page - 1) * per_page
    items = query.offset(offset).limit(per_page).all()

    data = [serializer(item) for item in items] if serializer else items
    from_record = offset + 1 if items else 0
    to_record = offset + len(items)

    return PaginatedResponse(
        data=data,
        current_page=page,
        per_page=per_page,
        total=total,
        last_page=last_page,
        from_record=from_record,
        to_record=to_record,
    )


class MessageResponse(BaseModel):
    """Standard success message response."""
    success: bool = True
    message: str


class IDResponse(BaseModel):
    """Response after creating a resource."""
    id: int
    message: str = "Created successfully."
