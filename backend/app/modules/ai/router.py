"""AI module — provider abstraction + recommendation management.
AI NEVER acts autonomously. Every recommendation requires human approval.
"""
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.pagination import paginate, MessageResponse
from app.database import get_db
from app.dependencies import get_current_user, require_permissions, _get_user_roles
from app.models.misc import AiRecommendation
from app.models.issue import Issue
from app.models.project import Project
from app.modules.projects.access import (
    accessible_project_ids,
    filter_query_by_project_access,
    is_system_admin,
    require_project_access,
)

router = APIRouter(prefix="/ai", tags=["AI Copilot"])
settings = get_settings()


# ── Abstract AI Provider Interface ─────────────────────────────────────────

class AbstractAIProvider(ABC):
    """
    All AI providers implement this interface.
    Business logic NEVER imports a concrete provider directly.
    """

    @abstractmethod
    async def generate_proposal(self, context: dict) -> dict: ...

    @abstractmethod
    async def analyze_rfp(self, rfp_content: str, context: dict) -> dict: ...

    @abstractmethod
    async def recommend_resources(self, project_context: dict) -> dict: ...

    @abstractmethod
    async def smart_assign(self, issue_context: dict) -> dict: ...

    @abstractmethod
    async def triage_issues(self, issues: list[dict]) -> dict: ...

    @abstractmethod
    async def executive_insights(self, dashboard_data: dict) -> dict: ...

    @abstractmethod
    async def predict_velocity(self, sprint_context: dict) -> dict: ...


class MockAIProvider(AbstractAIProvider):
    """Development mock — returns structured placeholder responses."""

    async def generate_proposal(self, context: dict) -> dict:
        return {
            "title": f"Proposal for {context.get('rfp_title', 'Project')}",
            "executive_summary": "Based on the RFP analysis, we propose a comprehensive solution...",
            "technical_approach": "We will use an agile methodology with 2-week sprints...",
            "timeline": "12 weeks",
            "estimated_hours": 480,
            "estimated_cost": 48000,
            "team_composition": [{"role": "Project Manager", "hours": 80}, {"role": "Senior Developer", "hours": 200}],
            "ai_provider": "mock",
        }

    async def analyze_rfp(self, rfp_content: str, context: dict) -> dict:
        return {
            "key_requirements": ["Scalable architecture", "Security compliance", "API integration"],
            "estimated_complexity": "high",
            "suggested_team_size": 4,
            "risk_factors": ["Tight timeline", "Complex integrations"],
            "recommendation": "Proceed with proposal",
            "ai_provider": "mock",
        }

    async def recommend_resources(self, project_context: dict) -> dict:
        return {
            "recommendations": [
                {"resource_id": None, "reason": "Senior developer with matching skills", "confidence": 0.85},
            ],
            "ai_narrative": "Based on current workload and skill matching...",
            "ai_provider": "mock",
        }

    async def smart_assign(self, issue_context: dict) -> dict:
        return {
            "suggested_assignee_id": None,
            "reason": "Best skill match + balanced workload",
            "confidence": 0.80,
            "alternatives": [],
            "ai_provider": "mock",
        }

    async def triage_issues(self, issues: list[dict]) -> dict:
        return {
            "triaged": [
                {
                    "issue_id": i.get("id"),
                    "suggested_priority": "medium",
                    "categories": ["technical"],
                    "confidence": 0.85,
                    "suggested_actions": ["Assign to backend developer"],
                }
                for i in issues
            ],
            "ai_provider": "mock",
        }

    async def executive_insights(self, dashboard_data: dict) -> dict:
        return {
            "summary": "Overall portfolio health is moderate with 2 projects at risk.",
            "key_risks": ["Resource bottleneck on Project A", "Budget overrun risk on Project B"],
            "recommendations": ["Reallocate 2 senior developers from Project C", "Review scope for Project B"],
            "ai_provider": "mock",
        }

    async def predict_velocity(self, sprint_context: dict) -> dict:
        return {
            "predicted_velocity": 32,
            "confidence": 0.78,
            "risk_factors": ["3 unassigned issues", "Holiday next week"],
            "recommendation": "Consider reducing sprint scope by 10%",
            "ai_provider": "mock",
        }


def get_ai_provider() -> AbstractAIProvider:
    """
    Factory function: returns the configured AI provider.
    Switch providers by changing AI_PROVIDER in .env.
    """
    provider = settings.AI_PROVIDER

    if provider == "mock" or not provider:
        return MockAIProvider()

    if provider == "openai":
        # Import only if configured
        try:
            from app.modules.ai.providers.openai import OpenAIProvider
            return OpenAIProvider(api_key=settings.OPENAI_API_KEY)
        except ImportError:
            return MockAIProvider()

    if provider == "gemini":
        try:
            from app.modules.ai.providers.gemini import GeminiProvider
            return GeminiProvider(api_key=settings.GEMINI_API_KEY)
        except ImportError:
            return MockAIProvider()

    return MockAIProvider()


# ── Request Schemas ────────────────────────────────────────────────────────

class ProposalGenerateIn(BaseModel):
    rfp_id: Optional[int] = None
    client_request_id: Optional[int] = None
    rfp_title: Optional[str] = None
    rfp_content: Optional[str] = None
    context: Optional[dict] = {}


class ResourceRecommendIn(BaseModel):
    project_id: int
    required_skills: Optional[list[str]] = []
    required_hours: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class SmartAssignIn(BaseModel):
    issue_ids: list[int]
    project_id: int
    expertise: Optional[str] = None


class AutoTriageIn(BaseModel):
    issue_ids: list[int]
    urgency_keywords: Optional[list[str]] = None


class DecideRecommendationIn(BaseModel):
    accepted: bool
    chosen_value: Optional[dict] = None
    override_reason: Optional[str] = None


# ── AI Endpoints ───────────────────────────────────────────────────────────

@router.post("/proposals/generate")
async def generate_proposal(
    body: ProposalGenerateIn,
    current_user=Depends(require_permissions("use-ai-features")),
    db: Session = Depends(get_db),
):
    """Generate a proposal using AI. Returns recommendation for human review — does NOT create proposal automatically."""
    if body.client_request_id:
        project_id = db.execute(
            select(Project.id).where(Project.client_request_id == body.client_request_id)
        ).scalar_one_or_none()
        if project_id:
            require_project_access(db, current_user.id, _get_user_roles(current_user.id, db), project_id)
    ai = get_ai_provider()
    context = {"rfp_title": body.rfp_title, "rfp_content": body.rfp_content, **body.context}
    result = await ai.generate_proposal(context)

    # Save as pending recommendation
    rec = AiRecommendation(
        type="proposal_generate",
        subject_type="Proposal",
        subject_id=body.client_request_id,
        input_data=context,
        suggestion_data=result,
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    return {"recommendation_id": rec.id, "result": result, "requires_approval": True}


@router.post("/proposals/analyze-rfp")
async def analyze_rfp(
    body: ProposalGenerateIn,
    current_user=Depends(require_permissions("use-ai-features")),
    db: Session = Depends(get_db),
):
    if body.client_request_id:
        project_id = db.execute(
            select(Project.id).where(Project.client_request_id == body.client_request_id)
        ).scalar_one_or_none()
        if project_id:
            require_project_access(db, current_user.id, _get_user_roles(current_user.id, db), project_id)
    ai = get_ai_provider()
    result = await ai.analyze_rfp(body.rfp_content or "", body.context or {})
    return {"result": result, "requires_approval": False}


@router.post("/resources/recommend")
async def recommend_resources(
    body: ResourceRecommendIn,
    current_user=Depends(require_permissions("use-ai-features")),
    db: Session = Depends(get_db),
):
    require_project_access(db, current_user.id, _get_user_roles(current_user.id, db), body.project_id)
    ai = get_ai_provider()
    result = await ai.recommend_resources({"project_id": body.project_id, "required_skills": body.required_skills})
    rec = AiRecommendation(
        type="resource_recommend",
        subject_type="Project",
        subject_id=body.project_id,
        input_data={"required_skills": body.required_skills, "required_hours": body.required_hours},
        suggestion_data=result,
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return {"recommendation_id": rec.id, "result": result, "requires_approval": True}


@router.post("/issues/smart-assign")
async def smart_assign(
    body: SmartAssignIn,
    current_user=Depends(require_permissions("use-ai-features")),
    db: Session = Depends(get_db),
):
    require_project_access(db, current_user.id, _get_user_roles(current_user.id, db), body.project_id)
    issues = db.query(Issue).filter(Issue.id.in_(body.issue_ids), Issue.deleted_at.is_(None)).all()
    if len(issues) != len(set(body.issue_ids)):
        raise HTTPException(404, "One or more issues were not found.")
    if any(issue.project_id != body.project_id for issue in issues):
        raise HTTPException(422, "Smart assignment cannot cross project boundaries.")
    ai = get_ai_provider()
    results = []
    for issue in issues:
        context = {"issue_id": issue.id, "title": issue.title, "project_id": body.project_id, "expertise": body.expertise}
        result = await ai.smart_assign(context)
        rec = AiRecommendation(type="smart_assign", subject_type="Issue", subject_id=issue.id, input_data=context, suggestion_data=result, status="pending", created_at=datetime.now(timezone.utc))
        db.add(rec)
        db.flush()
        results.append({"issue_id": issue.id, "issue_key": issue.key, "recommendation": result, "recommendation_id": rec.id})
    db.commit()
    return {"results": results, "requires_approval": True, "message": "AI suggestions generated. Review and approve each assignment."}


@router.post("/issues/triage")
async def auto_triage(
    body: AutoTriageIn,
    current_user=Depends(require_permissions("use-ai-features")),
    db: Session = Depends(get_db),
):
    issues = db.query(Issue).filter(Issue.id.in_(body.issue_ids), Issue.deleted_at.is_(None)).all()
    if len(issues) != len(set(body.issue_ids)):
        raise HTTPException(404, "One or more issues were not found.")
    roles = _get_user_roles(current_user.id, db)
    for project_id in {issue.project_id for issue in issues}:
        require_project_access(db, current_user.id, roles, project_id)
    ai = get_ai_provider()
    issue_dicts = [{"id": i.id, "title": i.title, "description": i.description} for i in issues]
    result = await ai.triage_issues(issue_dicts)
    return {**result, "requires_approval": True}


@router.get("/sprints/velocity-predict")
async def predict_velocity(
    sprint_id: int = Query(...),
    current_user=Depends(require_permissions("use-ai-features")),
    db: Session = Depends(get_db),
):
    from app.models.sprint import Sprint
    from sqlalchemy import select
    from app.models.issue import sprint_issues
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(404, "Sprint not found.")
    ai = get_ai_provider()
    context = {"sprint_id": sprint_id, "sprint_name": sprint.name, "status": sprint.status}
    result = await ai.predict_velocity(context)
    return {**result, "sprint_id": sprint_id, "sprint_name": sprint.name}


@router.get("/recommendations")
def list_recommendations(
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    page: int = Query(1),
    per_page: int = Query(25),
    current_user=Depends(require_permissions("use-ai-features")),
    db: Session = Depends(get_db),
):
    q = db.query(AiRecommendation)
    roles = _get_user_roles(current_user.id, db)
    if not is_system_admin(roles):
        allowed_ids = accessible_project_ids(db, current_user.id, roles)
        allowed_issue_ids = select(Issue.id).where(Issue.project_id.in_(allowed_ids or {-1}))
        q = q.filter(or_(
            and_(AiRecommendation.subject_type == "Project", AiRecommendation.subject_id.in_(allowed_ids or {-1})),
            and_(AiRecommendation.subject_type == "Issue", AiRecommendation.subject_id.in_(allowed_issue_ids)),
        ))
    if status:
        q = q.filter(AiRecommendation.status == status)
    if type:
        q = q.filter(AiRecommendation.type == type)
    return paginate(q.order_by(AiRecommendation.created_at.desc()), page, per_page, serializer=lambda r: {
        "id": r.id,
        "type": r.type,
        "subjectType": r.subject_type,
        "subjectId": r.subject_id,
        "status": r.status,
        "inputData": r.input_data,
        "suggestionData": r.suggestion_data,
        "decidedBy": r.decided_by,
        "decidedAt": r.decided_at.isoformat() if r.decided_at else None,
        "overrideReason": r.override_reason,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
    })


@router.put("/recommendations/{rec_id}/decide")
def decide_recommendation(
    rec_id: int,
    body: DecideRecommendationIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Human approves or overrides an AI recommendation. This is the ONLY way AI suggestions become actions."""
    rec = db.query(AiRecommendation).filter(AiRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(404, "Recommendation not found.")
    if rec.status != "pending":
        raise HTTPException(422, f"Recommendation is already {rec.status}.")
    roles = _get_user_roles(current_user.id, db)
    if rec.subject_type == "Project" and rec.subject_id:
        require_project_access(db, current_user.id, roles, rec.subject_id)
    elif rec.subject_type == "Issue" and rec.subject_id:
        project_id = db.execute(select(Issue.project_id).where(Issue.id == rec.subject_id)).scalar_one_or_none()
        if project_id is None:
            raise HTTPException(404, "Recommendation issue not found.")
        require_project_access(db, current_user.id, roles, project_id)
    elif not is_system_admin(roles):
        raise HTTPException(403, "This recommendation is not in an accessible project.")

    rec.status = "accepted" if body.accepted else "overridden"
    rec.decided_by = current_user.id
    rec.decided_at = datetime.now(timezone.utc)
    rec.override_reason = body.override_reason if not body.accepted else None

    db.commit()
    return {
        "id": rec.id,
        "status": rec.status,
        "message": "Recommendation accepted. Action may now be applied." if body.accepted else "Recommendation overridden.",
    }


@router.get("/insights/executive")
async def executive_insights(
    current_user=Depends(require_permissions("use-ai-features")),
    db: Session = Depends(get_db),
):
    """AI-generated executive insights based on portfolio data."""
    projects_query = db.query(Project).filter(Project.deleted_at.is_(None), Project.status == "active")
    projects_query = filter_query_by_project_access(
        projects_query,
        Project.id,
        current_user.id,
        _get_user_roles(current_user.id, db),
    )
    projects = projects_query.all()
    dashboard_data = {"project_count": len(projects), "project_ids": [p.id for p in projects]}

    ai = get_ai_provider()
    result = await ai.executive_insights(dashboard_data)
    return result
