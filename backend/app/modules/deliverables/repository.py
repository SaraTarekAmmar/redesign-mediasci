from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session, selectinload

from app.models.planning import ProjectDeliverable


def get_deliverable_by_id(db: Session, deliverable_id: int) -> Optional[ProjectDeliverable]:
    return (
        db.query(ProjectDeliverable)
        .options(selectinload(ProjectDeliverable.owner_resource), selectinload(ProjectDeliverable.milestone))
        .filter(ProjectDeliverable.id == deliverable_id)
        .first()
    )


def get_milestone_deliverables(db: Session, milestone_id: int):
    return (
        db.query(ProjectDeliverable)
        .options(selectinload(ProjectDeliverable.owner_resource))
        .filter(ProjectDeliverable.milestone_id == milestone_id)
        .order_by(ProjectDeliverable.id.asc())
        .all()
    )
