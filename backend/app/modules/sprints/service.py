from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.sprint import Sprint
from app.models.issue import Issue, IssueStatus, sprint_issues
from app.modules.sprints.schemas import SprintCreateIn, SprintUpdateIn, CompleteSprintIn
from app.modules.sprints import repository as repo


def create_sprint(db: Session, project_id: int, body: SprintCreateIn) -> Sprint:
    sprint = Sprint(
        name=body.name,
        goal=body.goal,
        project_id=project_id,
        status="planning",
        start_date=datetime.fromisoformat(body.start_date).date() if body.start_date else None,
        end_date=datetime.fromisoformat(body.end_date).date() if body.end_date else None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    return sprint


def update_sprint(db: Session, sprint: Sprint, body: SprintUpdateIn) -> Sprint:
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field in ("start_date", "end_date") and value:
            setattr(sprint, field, datetime.fromisoformat(value).date())
        elif hasattr(sprint, field):
            setattr(sprint, field, value)
    sprint.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sprint)
    return sprint


def delete_sprint(db: Session, sprint: Sprint):
    db.execute(sprint_issues.delete().where(sprint_issues.c.sprint_id == sprint.id))
    db.delete(sprint)
    db.commit()


def complete_sprint(db: Session, sprint: Sprint, body: CompleteSprintIn) -> int:
    # Find incomplete issues in this sprint
    done_statuses = db.query(IssueStatus).filter(IssueStatus.category == "done").all()
    done_ids = {s.id for s in done_statuses}

    incomplete_issue_ids = db.execute(
        select(sprint_issues.c.issue_id)
        .join(Issue, Issue.id == sprint_issues.c.issue_id)
        .where(
            sprint_issues.c.sprint_id == sprint.id,
            Issue.issue_status_id.notin_(done_ids),
        )
    ).scalars().all()

    moved_count = len(incomplete_issue_ids)
    if body.move_incomplete_to and incomplete_issue_ids:
        # Move to another sprint
        for issue_id in incomplete_issue_ids:
            db.execute(
                sprint_issues.update()
                .where(sprint_issues.c.issue_id == issue_id)
                .values(sprint_id=body.move_incomplete_to)
            )
    elif incomplete_issue_ids:
        # Move to backlog (remove from any sprint)
        db.execute(
            sprint_issues.delete()
            .where(sprint_issues.c.issue_id.in_(incomplete_issue_ids))
        )

    sprint.status = "completed"
    sprint.updated_at = datetime.now(timezone.utc)
    db.commit()
    return moved_count


def add_issue_to_sprint(db: Session, sprint_id: int, issue_id: int):
    # Remove from any existing sprint first
    db.execute(sprint_issues.delete().where(sprint_issues.c.issue_id == issue_id))
    max_pos = repo.get_max_issue_position(db, sprint_id)
    db.execute(sprint_issues.insert().values(issue_id=issue_id, sprint_id=sprint_id, position=max_pos + 1))
    db.commit()


def remove_issue_from_sprint(db: Session, sprint_id: int, issue_id: int):
    db.execute(sprint_issues.delete().where(sprint_issues.c.sprint_id == sprint_id, sprint_issues.c.issue_id == issue_id))
    db.commit()
