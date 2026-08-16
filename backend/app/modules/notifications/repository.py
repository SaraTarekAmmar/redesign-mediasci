from typing import Optional
from sqlalchemy.orm import Session
from app.models.notification import Notification


def get_notifications_query(db: Session, user_id: int, unread_only: bool = False):
    q = db.query(Notification).filter(Notification.notifiable_id == user_id)
    if unread_only:
        q = q.filter(Notification.read_at.is_(None))
    return q


def get_notification_by_id(db: Session, notif_id: str, user_id: int) -> Optional[Notification]:
    return db.query(Notification).filter(Notification.id == notif_id, Notification.notifiable_id == user_id).first()
