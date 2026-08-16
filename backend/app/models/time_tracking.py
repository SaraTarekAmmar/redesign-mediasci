from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Numeric, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class TimeLog(Base):
    __tablename__ = "time_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    issue_id = Column(Integer, ForeignKey("issues.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    description = Column(Text)
    logged_at = Column(Date)
    billable = Column(Integer, default=0)
    rate = Column(Numeric(10, 2))
    approved = Column(Boolean, default=False)
    approved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    issue = relationship("Issue", back_populates="time_logs")
    user = relationship("User", foreign_keys=[user_id], back_populates="time_logs")
    approved_by_user = relationship("User", foreign_keys=[approved_by])


    @property
    def hours(self) -> float:
        return (self.duration_minutes or 0) / 60.0


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    issue_id = Column(Integer, ForeignKey("issues.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    description = Column(Text)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    duration_minutes = Column(Integer)
    is_running = Column(Integer, default=0)
    billable = Column(Integer, default=0)
    rate = Column(Numeric(10, 2))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
    issue = relationship("Issue")
    project = relationship("Project")
