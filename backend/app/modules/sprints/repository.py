from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.sprint import Sprint
from app.models.issue import sprint_issues


def get_sprints_query(db: Session, project_id: Optional[int] = None, status: Optional[str] = None):
    q = db.query(Sprint)
    if project_id:
        q = q.filter(Sprint.project_id == project_id)
    if status:
        q = q.filter(Sprint.status == status)
    return q


def get_sprint_by_id(db: Session, sprint_id: int) -> Optional[Sprint]:
    return db.query(Sprint).filter(Sprint.id == sprint_id).first()


def get_max_issue_position(db: Session, sprint_id: int) -> int:
    max_pos = db.execute(
        select(sprint_issues.c.position).where(sprint_issues.c.sprint_id == sprint_id)
    ).scalars().all()
    return max(max_pos, default=-1)
