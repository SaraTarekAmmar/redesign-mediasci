"""
Redesign MediaSci — Backend Application Entry Point

Clean Architecture:
- All middleware registered
- All global exception handlers registered
- All modules mounted cleanly under /api/v1/ and / (for backwards compatibility)
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.core.handlers import register_exception_handlers
from app.core.logging import setup_logging
from app.core.middleware import RequestLoggingMiddleware

# Module Routers
from app.modules.administration.router import router as admin_router
from app.modules.ai.router import router as ai_router
from app.modules.analytics.router import router as analytics_router
from app.modules.auth.router import router as auth_router
from app.modules.bootstrap.router import router as bootstrap_router
from app.modules.budget.router import router as budget_router
from app.modules.change_requests.router import router as change_requests_router
from app.modules.clients.router import router as clients_router
from app.modules.documents.router import router as documents_router
from app.modules.deliverables.router import router as deliverables_router
from app.modules.issues.router import router as issues_router
from app.modules.milestones.router import router as milestones_router
from app.modules.notifications.router import router as notifications_router
from app.modules.partners.router import router as partners_router
from app.modules.planning.router import router as planning_router
from app.modules.presentations.router import router as presentations_router
from app.modules.team_tasks.router import router as team_tasks_router
from app.modules.projects.router import router as projects_router
from app.modules.proposals.router import router as proposals_router
from app.modules.quality.router import router as quality_router
from app.modules.requests.router import router as requests_router
from app.modules.resources.router import router as resources_router
from app.modules.risks.router import router as risks_router
from app.modules.sprints.router import router as sprints_router
from app.modules.stakeholders.router import router as stakeholders_router
from app.modules.workflows.router import router as workflows_router
from app.modules.scope.router import router as scope_router
from app.modules.meta.router import router as meta_router
from app.modules.triage.router import router as triage_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup & shutdown events."""
    setup_logging()
    logger = logging.getLogger("operation_hub")
    logger.info("Initializing %s backend...", settings.APP_NAME)
    yield
    logger.info("Shutting down %s backend...", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    description="Redesign MediaSci operation workspace API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Uploaded documents/presentations were stored on disk but never actually served — every
# download link in the app 404'd. Mount the upload dir (not the project root) so nothing
# else on disk is exposed.
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/storage", StaticFiles(directory=settings.UPLOAD_DIR), name="storage")

# ── Middleware Registration ──────────────────────────────────────────────────

app.add_middleware(RequestLoggingMiddleware)

origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Exception Handlers Registration ──────────────────────────────────────────

register_exception_handlers(app)

# ── Health Check ─────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["System"])
@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
    }


# ── Mount Routers (Direct /api prefix for SPA compatibility + /api/v1/) ──────

routers = [
    auth_router,
    admin_router,
    projects_router,
    issues_router,
    triage_router,
    sprints_router,
    clients_router,
    partners_router,
    requests_router,
    proposals_router,
    resources_router,
    planning_router,
    milestones_router,
    deliverables_router,
    scope_router,
    risks_router,
    change_requests_router,
    quality_router,
    stakeholders_router,
    documents_router,
    presentations_router,
    team_tasks_router,
    budget_router,
    workflows_router,
    analytics_router,
    notifications_router,
    ai_router,
    meta_router,
]

# Mount routers for root, /api, /ops, /api/ops, and /api/v1
for r in routers:
    app.include_router(r)
    app.include_router(r, prefix="/api")
    app.include_router(r, prefix="/ops")
    app.include_router(r, prefix="/api/ops")
    app.include_router(r, prefix="/api/v1")

# Mount Bootstrap endpoints at root level (expects /spa/bootstrap, /sanctum/csrf-cookie, /locale)
app.include_router(bootstrap_router)
