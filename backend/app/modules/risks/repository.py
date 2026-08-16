from typing import Optional
from sqlalchemy.orm import Session
from app.models.risk import Risk


def get_risks_query(db: Session, project_id: Optional[int] = None, status: str = "", severity: str = ""):
    q = db.query(Risk).filter(Risk.deleted_at.is_(None))
    if project_id:
        q = q.filter(Risk.project_id == project_id)
    if status:
        q = q.filter(Risk.status == status)
    if severity:
        q = q.filter(Risk.severity == severity)
    return q


def get_risk_by_id(db: Session, risk_id: int) -> Optional[Risk]:
    return db.query(Risk).filter(Risk.id == risk_id).first()
