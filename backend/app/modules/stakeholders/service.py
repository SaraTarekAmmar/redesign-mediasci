from datetime import datetime, timezone
from urllib.parse import quote
from sqlalchemy.orm import Session
from app.models.stakeholder import Stakeholder, StakeholderEngagement, StakeholderImpact
from app.modules.stakeholders import repository as repo
from app.modules.stakeholders.schemas import StakeholderCreateIn, StakeholderUpdateIn, EngagementCreateIn, ImpactCreateIn

_LEVEL_SCORE = {"low": 1, "medium": 2, "high": 3, "very high": 4}


def _level_score(value) -> int:
    return _LEVEL_SCORE.get((value or "").strip().lower(), 2)


def _support_level(s: Stakeholder) -> str:
    if s.support_level:
        return s.support_level
    if (s.status or "Active") != "Active":
        return "Neutral"
    score = _level_score(s.influence_level) + _level_score(s.interest_level)
    if score >= 5:
        return "Supporter"
    if score <= 2:
        return "Opponent"
    return "Neutral"


def _engagement_score(s: Stakeholder, interactions_count: int) -> float:
    if s.engagement_score is not None:
        return float(s.engagement_score)
    base = (_level_score(s.influence_level) + _level_score(s.interest_level)) / 6 * 60
    return min(100.0, base + min(interactions_count, 10) * 4)


def _engagement_level(score: float) -> str:
    if score >= 80:
        return "Very High"
    if score >= 60:
        return "High"
    if score >= 40:
        return "Medium"
    if score >= 20:
        return "Low"
    return "Very Low"


def _engagement_level_simple(s: Stakeholder, interactions_count: int) -> str:
    score = _engagement_score(s, interactions_count)
    if score >= 60:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"


def _avatar_for(name: str, accent: str) -> str:
    initials = "".join(part[0] for part in (name or "").split() if part)[:2].upper() or "?"
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">'
        f'<rect width="96" height="96" rx="24" fill="{accent}"/>'
        '<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" '
        'font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="white">'
        f"{initials}</text></svg>"
    )
    return f"data:image/svg+xml;utf8,{quote(svg)}"


def _photo_url(s: Stakeholder, index: int) -> str:
    if s.photo:
        return s.photo
    return _avatar_for(s.name, "#0C66E4" if index % 2 == 0 else "#10b981")


def _project_names(s: Stakeholder) -> list:
    return [p.name for p in (s.projects or []) if p.name]


def _last_interaction(s: Stakeholder) -> datetime | None:
    dates = [i.interaction_date for i in s.interactions if i.interaction_date]
    if s.last_interaction_at:
        dates.append(s.last_interaction_at)
    return max(dates) if dates else None


def _impact_level_score(level: str | None) -> float:
    mapping = {"critical": 100.0, "high": 80.0, "medium": 50.0, "low": 20.0}
    return mapping.get((level or "").strip().lower(), 50.0)


_IMPACT_AREAS = {
    "budget": ["budget", "cost", "financial"],
    "schedule": ["schedule", "timeline", "time", "deadline"],
    "scope": ["scope"],
    "risk": ["risk"],
    "comms": ["communication", "communications", "comms"],
}


def build_registration(db: Session, allowed_project_ids: set[int] | None = None) -> list:
    stakeholders = repo.get_all_stakeholders(db, allowed_project_ids)
    rows = []
    for s in stakeholders:
        rows.append({
            "id": str(s.id),
            "name": s.name,
            "type": s.type or "External",
            "category": s.category or s.organization or None,
            "role": s.role or None,
            "projects": _project_names(s),
            "influenceLevel": s.influence_level or "Medium",
            "interestLevel": s.interest_level or "Medium",
            "supportLevel": _support_level(s),
            "status": s.status or "Active",
            "createdAt": s.created_at.isoformat() if s.created_at else None,
        })
    return rows


def build_engagement(db: Session, allowed_project_ids: set[int] | None = None) -> dict:
    stakeholders = repo.get_all_stakeholders(db, allowed_project_ids)
    out_stakeholders = []
    out_interactions = []
    for idx, s in enumerate(stakeholders):
        count = len(s.interactions) + len(s.engagements)
        last = _last_interaction(s)
        out_stakeholders.append({
            "id": str(s.id),
            "name": s.name,
            "photoUrl": _photo_url(s, idx),
            "projects": _project_names(s),
            "interactionsCount": count,
            "lastInteractionDate": last.isoformat() if last else None,
            "engagementLevel": _engagement_level_simple(s, count),
        })
        for i in s.interactions:
            out_interactions.append({
                "id": str(i.id),
                "stakeholderId": str(s.id),
                "stakeholderName": s.name,
                "type": i.type or "Meeting",
                "description": i.notes or i.subject or "",
                "occurredAt": i.interaction_date.isoformat() if i.interaction_date else None,
            })
    out_interactions.sort(key=lambda x: x["occurredAt"] or "", reverse=True)
    return {"stakeholders": out_stakeholders, "interactions": out_interactions[:50]}


def build_analytics(db: Session, allowed_project_ids: set[int] | None = None) -> dict:
    stakeholders = repo.get_all_stakeholders(db, allowed_project_ids)
    by_role: dict = {}
    by_project: dict = {}
    support: dict = {}
    by_type: dict = {}
    by_category: dict = {}
    engagement: dict = {}
    activity: dict = {}

    for s in stakeholders:
        role = s.role or "Unspecified"
        by_role[role] = by_role.get(role, 0) + 1
        for name in _project_names(s) or ["Unassigned"]:
            by_project[name] = by_project.get(name, 0) + 1
        sup = _support_level(s)
        support[sup] = support.get(sup, 0) + 1
        t = s.type or "External"
        by_type[t] = by_type.get(t, 0) + 1
        cat = s.category or s.organization or "Uncategorized"
        by_category[cat] = by_category.get(cat, 0) + 1
        level = _engagement_level(_engagement_score(s, len(s.interactions) + len(s.engagements)))
        engagement[level] = engagement.get(level, 0) + 1
        for i in s.interactions:
            if i.interaction_date:
                day = i.interaction_date.date().isoformat()
                activity[day] = activity.get(day, 0) + 1

    return {
        "total": len(stakeholders),
        "byRole": by_role,
        "byProject": by_project,
        "supportLevel": support,
        "type": by_type,
        "category": by_category,
        "engagementLevel": engagement,
        "activity": [{"date": d, "count": c} for d, c in sorted(activity.items())],
    }


def build_impact(db: Session, allowed_project_ids: set[int] | None = None) -> dict:
    stakeholders = repo.get_all_stakeholders(db, allowed_project_ids)

    area_scores: dict = {k: [] for k in _IMPACT_AREAS}
    for s in stakeholders:
        for impact in s.impacts:
            area_name = (impact.area or "").strip().lower()
            for key, aliases in _IMPACT_AREAS.items():
                if any(alias in area_name for alias in aliases):
                    area_scores[key].append(_impact_level_score(impact.level))
                    break
    impact_data = {
        key: (sum(vals) / len(vals) if vals else 0.0)
        for key, vals in area_scores.items()
    }

    support: dict = {}
    influence_comms = []
    engagement_freq = []
    response_time = []
    alerts = []
    recommendations = []

    for s in stakeholders:
        interactions_count = len(s.interactions) + len(s.engagements)
        sup = _support_level(s)
        support[sup] = support.get(sup, 0) + 1
        score = _engagement_score(s, interactions_count)
        influence = s.influence_level or "Medium"
        influence_comms.append({
            "x": _level_score(influence) * 30,
            "y": round(score, 2),
            "r": max(interactions_count, 1),
            "name": s.name,
            "influence": influence,
            "score": round(score, 2),
            "interactions": interactions_count,
        })
        engagement_freq.append({
            "x": interactions_count,
            "y": round(score, 2),
            "name": s.name,
            "position": sup,
        })
        response_time.append({
            "name": s.name,
            "value": float(s.avg_response_time or 0),
        })
        if (s.status or "Active") != "Active" or sup == "Opponent":
            alerts.append({
                "type": "attention",
                "message": f"{s.name} needs follow-up before the next milestone review.",
                "stakeholderId": str(s.id),
                "stakeholderName": s.name,
            })
        recommendations.append({
            "name": s.name,
            "quadrant": sup,
            "rec": f"{s.communication_preference or 'Email'} is the preferred follow-up channel.",
        })

    insights = []
    if stakeholders:
        supporters = support.get("Supporter", 0)
        insights.append({
            "type": "summary",
            "title": "Stakeholder support distribution",
            "message": f"{supporters} of {len(stakeholders)} stakeholders are supporters.",
        })
        low_engaged = [s.name for s in stakeholders if _engagement_level_simple(s, len(s.interactions) + len(s.engagements)) == "Low"]
        if low_engaged:
            insights.append({
                "type": "engagement",
                "title": "Low engagement detected",
                "message": f"{len(low_engaged)} stakeholder(s) have low engagement: {', '.join(low_engaged[:3])}.",
            })

    return {
        "impactData": impact_data,
        "charts": {
            "influenceComms": influence_comms,
            "engagementFreq": engagement_freq,
            "support": support,
            "responseTime": response_time,
        },
        "alerts": alerts,
        "insights": insights,
        "recommendations": recommendations,
    }


def create_stakeholder(db: Session, body: StakeholderCreateIn) -> Stakeholder:
    inf = body.influence or body.influence_level or "Medium"
    int_lvl = body.interest or body.interest_level or "Medium"
    comm = body.communicationPreference or body.communication_preference or "Email"
    
    s = Stakeholder(
        name=body.name,
        role=body.role,
        organization=body.organization,
        email=body.email,
        phone=body.phone,
        influence_level=inf,
        interest_level=int_lvl,
        communication_preference=comm,
        status=body.status or "Active",
        notes=body.notes,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(s)
    if body.project_id is not None:
        from app.models.project import Project

        project = db.query(Project).filter(Project.id == body.project_id, Project.deleted_at.is_(None)).first()
        if project:
            s.projects.append(project)
    db.commit()
    db.refresh(s)
    return s


def update_stakeholder(db: Session, s: Stakeholder, body: StakeholderUpdateIn) -> Stakeholder:
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        s.name = data["name"]
    if "role" in data:
        s.role = data["role"]
    if "organization" in data:
        s.organization = data["organization"]
    if "email" in data:
        s.email = data["email"]
    if "phone" in data:
        s.phone = data["phone"]
    if "influence" in data or "influence_level" in data:
        s.influence_level = data.get("influence") or data.get("influence_level")
    if "interest" in data or "interest_level" in data:
        s.interest_level = data.get("interest") or data.get("interest_level")
    if "communicationPreference" in data or "communication_preference" in data:
        s.communication_preference = data.get("communicationPreference") or data.get("communication_preference")
    if "status" in data and data["status"] is not None:
        s.status = data["status"]
    if "notes" in data:
        s.notes = data["notes"]
        
    s.updated_at = datetime.now(timezone.utc)
    db.commit()
    return s


def delete_stakeholder(db: Session, s: Stakeholder):
    db.delete(s)
    db.commit()


def create_engagement(db: Session, stakeholder_id: int, body: EngagementCreateIn) -> StakeholderEngagement:
    e = StakeholderEngagement(
        stakeholder_id=stakeholder_id,
        type=body.type,
        description=body.notes,
        outcome=body.next_action,
        date=datetime.fromisoformat(body.engagement_date).date() if body.engagement_date else None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


def create_impact(db: Session, stakeholder_id: int, body: ImpactCreateIn) -> StakeholderImpact:
    i = StakeholderImpact(
        stakeholder_id=stakeholder_id,
        area=body.area,
        level=body.level,
        description=body.description,
        created_at=datetime.now(timezone.utc),
    )
    db.add(i)
    db.commit()
    db.refresh(i)
    return i
