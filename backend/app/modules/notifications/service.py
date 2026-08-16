from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.notification import Notification


def mark_read(db: Session, notif: Notification) -> Notification:
    notif.read_at = datetime.now(timezone.utc)
    db.commit()
    return notif


def mark_all_read(db: Session, user_id: int):
    db.query(Notification).filter(
        Notification.notifiable_id == user_id,
        Notification.read_at.is_(None),
    ).update({"read_at": datetime.now(timezone.utc)})
    db.commit()
