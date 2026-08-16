from typing import Optional
from sqlalchemy.orm import Session
from app.models.misc import ValidationRule, ValidationResult


def get_validation_rules_query(db: Session, project_id: Optional[int] = None):
    q = db.query(ValidationRule)
    if project_id:
        q = q.filter(ValidationRule.project_id == project_id)
    return q


def get_validation_rule_by_id(db: Session, rule_id: int) -> Optional[ValidationRule]:
    return db.query(ValidationRule).filter(ValidationRule.id == rule_id).first()


def get_validation_results_query(db: Session, project_id: Optional[int] = None, rule_id: Optional[int] = None):
    q = db.query(ValidationResult)
    if project_id:
        q = q.filter(ValidationResult.project_id == project_id)
    if rule_id:
        q = q.filter(ValidationResult.rule_id == rule_id)
    return q
