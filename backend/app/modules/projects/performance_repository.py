from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session, aliased, joinedload, selectinload

from app.models.budget import Budget, Expense
from app.models.issue import Issue
from app.models.planning import ProjectDeliverable, ProjectMilestone, ProjectMilestoneDependency
from app.models.project import Project
from app.models.risk import Risk
from app.models.user import User


def get_project_for_performance(db: Session, project_id: int) -> Optional[Project]:
    return (
        db.query(Project)
        .options(
            joinedload(Project.client),
            joinedload(Project.team),
            joinedload(Project.owner),
            joinedload(Project.planning_baseline),
            selectinload(Project.planning_milestones).selectinload(ProjectMilestone.deliverables).selectinload(ProjectDeliverable.owner_resource),
            selectinload(Project.planning_milestones).selectinload(ProjectMilestone.owner_resource),
        )
        .filter(Project.id == project_id, Project.deleted_at.is_(None))
        .first()
    )


def get_project_milestones(db: Session, project_id: int) -> list[ProjectMilestone]:
    return (
        db.query(ProjectMilestone)
        .options(
            selectinload(ProjectMilestone.deliverables).selectinload(ProjectDeliverable.owner_resource),
            selectinload(ProjectMilestone.owner_resource),
        )
        .filter(ProjectMilestone.project_id == project_id)
        .order_by(ProjectMilestone.sort_order.asc(), ProjectMilestone.id.asc())
        .all()
    )


def get_project_milestone_dependencies(db: Session, project_id: int) -> list[ProjectMilestoneDependency]:
    predecessor = aliased(ProjectMilestone)
    successor = aliased(ProjectMilestone)
    return (
        db.query(ProjectMilestoneDependency)
        .join(predecessor, ProjectMilestoneDependency.predecessor_milestone_id == predecessor.id)
        .join(successor, ProjectMilestoneDependency.successor_milestone_id == successor.id)
        .options(
            selectinload(ProjectMilestoneDependency.predecessor_milestone),
            selectinload(ProjectMilestoneDependency.successor_milestone),
        )
        .filter(predecessor.project_id == project_id, successor.project_id == project_id)
        .order_by(ProjectMilestoneDependency.id.asc())
        .all()
    )


def get_project_issues(db: Session, project_id: int) -> list[Issue]:
    return (
        db.query(Issue)
        .options(
            joinedload(Issue.status),
            joinedload(Issue.assignee).selectinload(User.resource),
            joinedload(Issue.milestone),
            joinedload(Issue.deliverable),
            selectinload(Issue.time_logs),
        )
        .filter(Issue.project_id == project_id, Issue.deleted_at.is_(None))
        .all()
    )


def get_project_budgets(db: Session, project_id: int) -> list[Budget]:
    return db.query(Budget).filter(Budget.project_id == project_id).all()


def get_project_expenses(db: Session, project_id: int) -> list[Expense]:
    return db.query(Expense).filter(Expense.project_id == project_id).all()


def get_project_risks(db: Session, project_id: int) -> list[Risk]:
    return db.query(Risk).filter(Risk.project_id == project_id, Risk.deleted_at.is_(None)).all()
