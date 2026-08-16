from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class IssueComment(Base):
    __tablename__ = "issue_comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    parent_id = Column(Integer, ForeignKey("issue_comments.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    issue = relationship("Issue", back_populates="comments")
    user = relationship("User", back_populates="comments")
    parent = relationship("IssueComment", remote_side=[id], back_populates="replies")
    replies = relationship("IssueComment", back_populates="parent")


class CommentReaction(Base):
    __tablename__ = "comment_reactions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    comment_id = Column(Integer, ForeignKey("issue_comments.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    reaction = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Mention(Base):
    __tablename__ = "mentions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    mentionable_type = Column(String(255))
    mentionable_id = Column(Integer)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    mentioned_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = relationship("User", foreign_keys=[user_id])
    mentioned_user = relationship("User", foreign_keys=[mentioned_user_id])
