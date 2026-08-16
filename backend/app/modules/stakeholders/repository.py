from typing import Optional
from sqlalchemy.orm import Session
from app.models.stakeholder import Stakeholder, StakeholderEngagement, StakeholderImpact
from app.models.project import Project


def get_stakeholders_query(db: Session, project_id: Optional[int] = None, q: str = ""):
    query = db.query(Stakeholder)
    if project_id:
        query = query.filter(Stakeholder.projects.any(Project.id == project_id))
    if q:
        query = query.filter(Stakeholder.name.ilike(f"%{q}%"))
    return query


def get_all_stakeholders(db: Session, allowed_project_ids: set[int] | None = None):
    query = db.query(Stakeholder)
    if allowed_project_ids is not None:
        query = query.filter(Stakeholder.projects.any(Project.id.in_(allowed_project_ids or {-1})))
    return query.order_by(Stakeholder.name).all()


def get_stakeholder_by_id(db: Session, stakeholder_id: int) -> Optional[Stakeholder]:
    return db.query(Stakeholder).filter(Stakeholder.id == stakeholder_id).first()


def get_engagements_by_stakeholder(db: Session, stakeholder_id: int):
    return db.query(StakeholderEngagement).filter(StakeholderEngagement.stakeholder_id == stakeholder_id).all()


def get_impacts_by_stakeholder(db: Session, stakeholder_id: int):
    return db.query(StakeholderImpact).filter(StakeholderImpact.stakeholder_id == stakeholder_id).all()
