"""Quality and Validation router — validation rules, execution, results."""
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.pagination import paginate
from app.database import get_db
from app.dependencies import get_current_user, require_permissions, _get_user_roles
from app.models.misc import ValidationRule, ValidationResult
from app.models.project import Project
from app.modules.quality.schemas import HandoffIn, RuleCreateIn
from app.modules.quality import service, repository as repo
from app.modules.projects.access import filter_query_by_project_access, require_project_access

router = APIRouter(tags=["Quality & Validation"])


def _get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found.")
    return project


def _result_payload(result: ValidationResult) -> dict:
    details = result.details or {}
    return {
        "id": result.id,
        "validation_rule_id": result.rule_id,
        "status": "passed" if result.passed else "failed",
        "message": details.get("message"),
        "created_at": result.created_at.isoformat() if result.created_at else None,
    }


def _rule_payload(db: Session, rule: ValidationRule) -> dict:
    latest_results = (
        repo.get_validation_results_query(db, project_id=rule.project_id, rule_id=rule.id)
        .order_by(ValidationResult.created_at.desc())
        .limit(1)
        .all()
    )
    parameters = None
    if rule.parameters:
        try:
            parameters = json.loads(rule.parameters)
        except (TypeError, ValueError):
            parameters = None
    return {
        "id": rule.id,
        "project_id": rule.project_id,
        "name": rule.name,
        "description": rule.description,
        "rule_type": rule.rule_type,
        "parameters": parameters,
        "is_active": bool(rule.is_active),
        "results": [_result_payload(r) for r in latest_results],
    }


@router.get("/projects/{project_id}/validation")
def list_project_validation_rules(
    project_id: int,
    current_user=Depends(require_permissions("view-projects")),
    db: Session = Depends(get_db),
):
    _get_project_or_404(db, project_id)
    rules = repo.get_validation_rules_query(db, project_id=project_id).order_by(ValidationRule.id).all()
    return [_rule_payload(db, rule) for rule in rules]


@router.post("/projects/{project_id}/validation/verify")
def verify_project_validation(
    project_id: int,
    current_user=Depends(require_permissions("view-projects")),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(db, project_id)
    results = service.verify_project_rules(db, project, current_user.id)
    return [_result_payload(r) for r in results]


@router.post("/projects/{project_id}/validation/release-notes")
def generate_release_notes(
    project_id: int,
    current_user=Depends(require_permissions("view-projects")),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(db, project_id)
    return {"markdown": service.build_release_notes(db, project)}


@router.post("/projects/{project_id}/validation/handoff")
def submit_handoff(
    project_id: int,
    body: HandoffIn,
    current_user=Depends(require_permissions("view-projects")),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(db, project_id)
    service.record_handoff(db, project, current_user.id, body.action, body.comments)
    if body.action == "approve":
        return {"status": "approved", "message": "Handoff approved and sign-off recorded."}
    return {"status": "rejected", "message": "Handoff rejected; fixes requested."}


@router.get("/validation-rules")
def list_rules(
    project_id: Optional[int] = Query(None),
    page: int = Query(1),
    per_page: int = Query(25),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = repo.get_validation_rules_query(db, project_id=project_id)
    q = filter_query_by_project_access(q, ValidationRule.project_id, current_user.id, _get_user_roles(current_user.id, db))
    return paginate(q.order_by(ValidationRule.id), page, per_page, serializer=lambda r: {
        "id": r.id,
        "projectId": r.project_id,
        "name": r.name,
        "description": r.description,
        "type": r.type,
        "status": r.status,
    })


@router.post("/validation-rules", status_code=201)
def create_rule(body: RuleCreateIn, current_user=Depends(require_permissions("manage-settings")), db: Session = Depends(get_db)):
    if body.project_id is not None:
        require_project_access(db, current_user.id, _get_user_roles(current_user.id, db), body.project_id)
    rule = service.create_rule(db, body)
    return {"id": rule.id, "name": rule.name}


@router.post("/validation-rules/{rule_id}/run")
def run_rule(rule_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    rule = repo.get_validation_rule_by_id(db, rule_id)
    if not rule:
        raise HTTPException(404, "Validation rule not found.")
    result = service.run_rule(db, rule)
    return {"rule_id": rule_id, "status": result.status, "result_id": result.id}


@router.get("/validation-results")
def list_results(
    project_id: Optional[int] = Query(None),
    rule_id: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = repo.get_validation_results_query(db, project_id=project_id, rule_id=rule_id)
    q = filter_query_by_project_access(q, ValidationResult.project_id, current_user.id, _get_user_roles(current_user.id, db))
    return [
        {
            "id": r.id,
            "ruleId": r.rule_id,
            "projectId": r.project_id,
            "status": r.status,
            "details": r.details,
            "createdAt": r.created_at.isoformat() if r.created_at else None,
        }
        for r in q.order_by(ValidationResult.created_at.desc()).limit(100).all()
    ]
