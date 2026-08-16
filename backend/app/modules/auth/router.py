"""
Auth Router — HTTP layer for authentication.
Thin: delegates all logic to the auth service.
No business logic here.
"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.modules.auth.schemas import AuthResponse, LoginIn, ProfileUpdateIn, UserOut
from app.modules.auth.service import login_user, serialize_user, update_profile
from app.security import create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Cookie name kept the same for frontend compatibility
AUTH_COOKIE = "taskflow_token"
COOKIE_MAX_AGE = 60 * 60 * 24  # 24 hours


def _write_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=AUTH_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=COOKIE_MAX_AGE,
        path="/",
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    """Authenticate an employee and return JWT + user data."""
    user, token = login_user(db, payload.email, payload.password)
    _write_auth_cookie(response, token)
    return {"user": serialize_user(user, db), "token": token}


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(response: Response):
    """Invalidate the auth cookie. JWT stays valid until expiry."""
    response.delete_cookie(AUTH_COOKIE, path="/")
    return {"success": True, "message": "Logged out successfully."}


@router.post("/refresh", response_model=AuthResponse)
def refresh(
    response: Response,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Refresh the authentication token."""
    token = create_access_token({"sub": str(current_user.id)})
    _write_auth_cookie(response, token)
    return {"user": serialize_user(current_user, db), "token": token}


@router.get("/me", response_model=UserOut)
def me(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Return the currently authenticated user's profile with roles and permissions."""
    return serialize_user(current_user, db)


@router.put("/profile", response_model=UserOut)
def update_my_profile(
    payload: ProfileUpdateIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the currently authenticated user's own profile."""
    user = update_profile(db, current_user, payload.model_dump(exclude_unset=True))
    return serialize_user(user, db)
