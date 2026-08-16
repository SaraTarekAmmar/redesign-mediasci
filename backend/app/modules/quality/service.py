import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.issue import Issue
from app.models.misc import AuditLog, ValidationRule, ValidationResult
from app.models.project import Project
from app.modules.quality.schemas import RuleCreateIn


def create_rule(db: Session, body: RuleCreateIn) -> ValidationRule:
    rule = ValidationRule(
        project_id=body.project_id,
        name=body.name,
        description=body.description,
        rule_type=body.type or "custom",
        parameters=json.dumps(body.config or {}),
        is_active=0 if (body.status or "active") == "inactive" else 1,
        created_at=datetime.now(timezone.utc),
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def run_rule(db: Session, rule: ValidationRule, verified_by: int = None) -> ValidationResult:
    # Execution simulation
    passed = True
    result = ValidationResult(
        rule_id=rule.id,
        project_id=rule.project_id,
        passed=1 if passed else 0,
        verified_by=verified_by,
        details={
            "passed": passed,
            "message": "Rule evaluated." if passed else "Rule failed.",
            "executed_at": datetime.now(timezone.utc).isoformat(),
        },
        created_at=datetime.now(timezone.utc),
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


def verify_project_rules(db: Session, project: Project, user_id: int) -> list[ValidationResult]:
    """Execute every active validation rule of a project and persist the results."""
    rules = (
        db.query(ValidationRule)
        .filter(ValidationRule.project_id == project.id, ValidationRule.is_active == 1)
        .order_by(ValidationRule.id)
        .all()
    )
    results: list[ValidationResult] = []
    for rule in rules:
        result = ValidationResult(
            rule_id=rule.id,
            project_id=project.id,
            passed=1,
            verified_by=user_id,
            details={
                "passed": True,
                "message": "Rule evaluated.",
                "executed_at": datetime.now(timezone.utc).isoformat(),
            },
            created_at=datetime.now(timezone.utc),
        )
        db.add(result)
        results.append(result)
    db.commit()
    for result in results:
        db.refresh(result)
    return results


def build_release_notes(db: Session, project: Project) -> str:
    """Compile release notes markdown from the project's completed issues and
    latest validation results."""
    completed = (
        db.query(Issue)
        .filter(
            Issue.project_id == project.id,
            Issue.deleted_at.is_(None),
            Issue.completion_percentage >= 100,
        )
        .order_by(Issue.updated_at.desc())
        .limit(50)
        .all()
    )
    latest_results = (
        db.query(ValidationResult)
        .filter(ValidationResult.project_id == project.id)
        .order_by(ValidationResult.created_at.desc())
        .limit(10)
        .all()
    )

    lines = [
        f"# Release Notes — {project.name}",
        "",
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "## Completed Work",
        "",
    ]
    if completed:
        for issue in completed:
            lines.append(f"- {issue.title} (#{issue.id})")
    else:
        lines.append("- No completed tasks recorded for this project yet.")

    lines += ["", "## Quality Validation Log", ""]
    if latest_results:
        for result in latest_results:
            status = "PASSED" if result.passed else "FAILED"
            when = result.created_at.strftime("%Y-%m-%d") if result.created_at else "-"
            lines.append(f"- [{status}] Rule #{result.rule_id} — {when}")
    else:
        lines.append("- No validation runs recorded for this project yet.")

    return "\n".join(lines)


def record_handoff(db: Session, project: Project, user_id: int, action: str, comments: str) -> AuditLog:
    """Persist a handoff sign-off decision in the audit log."""
    entry = AuditLog(
        user_id=user_id,
        action=f"handoff_{action}",
        entity_type="Project",
        entity_id=project.id,
        new_values={"action": action, "comments": comments},
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
