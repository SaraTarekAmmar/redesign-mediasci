from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.risk import Risk
from app.modules.risks.schemas import RiskCreateIn, RiskUpdateIn


def _calc_severity(probability: int, impact: int) -> str:
    score = probability * impact
    if score >= 16:
        return "critical"
    if score >= 9:
        return "high"
    if score >= 4:
        return "medium"
    return "low"


def create_risk(db: Session, body: RiskCreateIn, user_id: int) -> Risk:
    severity = body.severity or _calc_severity(body.probability or 2, body.impact or 2)
    risk = Risk(
        project_id=body.project_id,
        created_by=user_id,
        title=body.title,
        description=body.description,
        category=body.category,
        probability=body.probability,
        impact=body.impact,
        risk_score=(body.probability or 2) * (body.impact or 2),
        severity=severity,
        status="identified",
        owner=body.owner,
        owner_user_id=body.owner_user_id,
        response_plan=body.response_plan,
        contingency_plan=body.contingency_plan,
        due_date=datetime.fromisoformat(body.due_date).date() if body.due_date else None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(risk)
    db.commit()
    db.refresh(risk)
    return risk


def update_risk(db: Session, r: Risk, body: RiskUpdateIn) -> Risk:
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field == "due_date" and value:
            r.due_date = datetime.fromisoformat(value).date()
        elif hasattr(r, field):
            setattr(r, field, value)
    
    # Recalculate severity if probability or impact changed
    if "probability" in data or "impact" in data:
        r.risk_score = r.probability * r.impact
        if "severity" not in data:
            r.severity = _calc_severity(r.probability, r.impact)
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    return r


def update_risk_status(db: Session, r: Risk, status: str) -> Risk:
    r.status = status
    if status == "closed":
        r.closed_at = datetime.now(timezone.utc)
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    return r


def delete_risk(db: Session, r: Risk):
    r.deleted_at = datetime.now(timezone.utc)
    db.commit()
