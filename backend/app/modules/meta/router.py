from fastapi import APIRouter

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/migration-status")
def migration_status():
    return {
        "mode": "parallel",
        "backend": "backend",
        "auth": "cookie+jwt",
        "notes": [
            "FastAPI is running beside Laravel during the migration.",
            "Auth endpoints are available in FastAPI first.",
            "Remaining domains should be moved one router at a time.",
        ],
    }
