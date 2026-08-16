"""Notifications router."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.pagination import paginate, MessageResponse
from app.database import get_db
from app.dependencies import get_current_user
from app.models.notification import Notification
from app.modules.notifications import service, repository as repo

router = APIRouter(tags=["Notifications"])


@router.get("/notifications")
def list_notifications(
    unread_only: bool = Query(False),
    page: int = Query(1),
    per_page: int = Query(30),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = repo.get_notifications_query(db, current_user.id, unread_only=unread_only)
    return paginate(q.order_by(Notification.created_at.desc()), page, per_page, serializer=lambda n: {
        "id": n.id,
        "type": n.type,
        "data": n.data,
        "readAt": n.read_at.isoformat() if n.read_at else None,
        "createdAt": n.created_at.isoformat() if n.created_at else None,
    })


@router.patch("/notifications/{notif_id}/read", response_model=MessageResponse)
def mark_read(notif_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    notif = repo.get_notification_by_id(db, notif_id, current_user.id)
    if notif:
        service.mark_read(db, notif)
    return MessageResponse(message="Marked as read.")


@router.post("/notifications/read-all", response_model=MessageResponse)
def mark_all_read(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    service.mark_all_read(db, current_user.id)
    return MessageResponse(message="All notifications marked as read.")
