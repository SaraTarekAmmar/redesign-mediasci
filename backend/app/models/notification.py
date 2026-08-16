from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String(36), primary_key=True)
    type = Column(String(255), nullable=False)
    notifiable_type = Column(String(255), nullable=False)
    notifiable_id = Column(Integer, nullable=False)
    data = Column(JSON)
    read_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DatabaseNotification(Base):
    __tablename__ = "database_notifications"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255))
    body = Column(Text)
    type = Column(String(100))
    entity_type = Column(String(100))
    entity_id = Column(Integer)
    data = Column(JSON)
    read_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
