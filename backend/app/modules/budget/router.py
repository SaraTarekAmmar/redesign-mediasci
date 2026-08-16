"""Budget router — budgets, expenses, cloud services, software licenses."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.core.pagination import paginate, MessageResponse
from app.database import get_db
from app.dependencies import get_current_user, require_permissions
from app.models.budget import Budget, CloudService, Expense, ExpenseCategory, SoftwareLicense

router = APIRouter(tags=["Budget"])


class BudgetUpsertIn(BaseModel):
    name: Optional[str] = None
    total_budget: float
    currency: Optional[str] = "USD"
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class ExpenseCreateIn(BaseModel):
    category_id: Optional[int] = None
    name: str
    amount: float
    currency: Optional[str] = "USD"
    date: Optional[str] = None
    description: Optional[str] = None
    vendor: Optional[str] = None
    status: Optional[str] = "pending"


class CloudServiceIn(BaseModel):
    name: str
    provider: Optional[str] = None
    monthly_cost: Optional[float] = None
    annual_cost: Optional[float] = None
    status: Optional[str] = "active"
    renewal_date: Optional[str] = None


class SoftwareLicenseIn(BaseModel):
    name: str
    vendor: Optional[str] = None
    license_type: Optional[str] = None
    seats: Optional[int] = None
    cost: Optional[float] = None
    renewal_date: Optional[str] = None
    status: Optional[str] = "active"


@router.get("/projects/{project_id}/budget")
def get_budget(project_id: int, current_user=Depends(require_permissions("view-budget")), db: Session = Depends(get_db)):
    budgets = db.query(Budget).filter(Budget.project_id == project_id).all()
    expenses = db.query(Expense).filter(Expense.project_id == project_id).all()
    total_spent = sum(float(e.amount) for e in expenses)
    return {
        "projectId": project_id,
        "budgets": [{"id": b.id, "name": b.name, "totalBudget": float(b.total_budget), "spent": float(b.spent), "currency": b.currency} for b in budgets],
        "totalBudget": sum(float(b.total_budget) for b in budgets),
        "totalSpent": total_spent,
        "remaining": sum(float(b.total_budget) for b in budgets) - total_spent,
    }


@router.post("/projects/{project_id}/budget", status_code=201)
def create_or_update_budget(project_id: int, body: BudgetUpsertIn, current_user=Depends(require_permissions("manage-budget")), db: Session = Depends(get_db)):
    existing = db.query(Budget).filter(Budget.project_id == project_id).first()
    if existing:
        existing.total_budget = body.total_budget
        existing.currency = body.currency
        db.commit()
        return {"id": existing.id, "totalBudget": float(existing.total_budget)}
    budget = Budget(
        project_id=project_id,
        name=body.name or "Primary Budget",
        total_budget=body.total_budget,
        currency=body.currency,
        start_date=datetime.fromisoformat(body.start_date).date() if body.start_date else None,
        end_date=datetime.fromisoformat(body.end_date).date() if body.end_date else None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return {"id": budget.id, "totalBudget": float(budget.total_budget)}


@router.get("/projects/{project_id}/expenses")
def list_expenses(project_id: int, page: int = Query(1), per_page: int = Query(50), current_user=Depends(require_permissions("view-budget")), db: Session = Depends(get_db)):
    q = db.query(Expense).filter(Expense.project_id == project_id)
    return paginate(q.order_by(Expense.date.desc()), page, per_page, serializer=lambda e: {
        "id": e.id,
        "name": e.name,
        "amount": float(e.amount),
        "currency": e.currency,
        "date": e.date.isoformat() if e.date else None,
        "description": e.description,
        "vendor": e.vendor,
        "status": e.status,
        "categoryId": e.category_id,
    })


@router.post("/projects/{project_id}/expenses", status_code=201)
def create_expense(project_id: int, body: ExpenseCreateIn, current_user=Depends(require_permissions("manage-budget")), db: Session = Depends(get_db)):
    expense = Expense(
        project_id=project_id,
        category_id=body.category_id,
        name=body.name,
        amount=body.amount,
        currency=body.currency,
        date=datetime.fromisoformat(body.date).date() if body.date else None,
        description=body.description,
        vendor=body.vendor,
        status=body.status,
        created_at=datetime.now(timezone.utc),
    )
    db.add(expense)
    # Update budget spent
    budget = db.query(Budget).filter(Budget.project_id == project_id).first()
    if budget:
        budget.spent = (budget.spent or 0) + body.amount
    db.commit()
    db.refresh(expense)
    return {"id": expense.id, "amount": float(expense.amount)}


@router.put("/projects/{project_id}/expenses/{expense_id}")
def update_expense(project_id: int, expense_id: int, body: dict, current_user=Depends(require_permissions("manage-budget")), db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.project_id == project_id).first()
    if not expense:
        raise HTTPException(404, "Expense not found.")
    for field, value in body.items():
        if hasattr(expense, field):
            setattr(expense, field, value)
    db.commit()
    return {"id": expense.id}


@router.delete("/projects/{project_id}/expenses/{expense_id}", response_model=MessageResponse)
def delete_expense(project_id: int, expense_id: int, current_user=Depends(require_permissions("manage-budget")), db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.project_id == project_id).first()
    if not expense:
        raise HTTPException(404, "Expense not found.")
    db.delete(expense)
    db.commit()
    return MessageResponse(message="Expense deleted.")


@router.get("/projects/{project_id}/cloud-services")
def list_cloud_services(project_id: int, current_user=Depends(require_permissions("view-budget")), db: Session = Depends(get_db)):
    services = db.query(CloudService).filter(CloudService.project_id == project_id).all()
    return [{"id": s.id, "name": s.name, "provider": s.provider, "monthlyCost": float(s.monthly_cost) if s.monthly_cost else 0, "status": s.status} for s in services]


@router.post("/projects/{project_id}/cloud-services", status_code=201)
def add_cloud_service(project_id: int, body: CloudServiceIn, current_user=Depends(require_permissions("manage-budget")), db: Session = Depends(get_db)):
    s = CloudService(project_id=project_id, name=body.name, provider=body.provider, monthly_cost=body.monthly_cost, annual_cost=body.annual_cost, status=body.status, renewal_date=datetime.fromisoformat(body.renewal_date).date() if body.renewal_date else None, created_at=datetime.now(timezone.utc))
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "name": s.name}


@router.get("/projects/{project_id}/software-licenses")
def list_licenses(project_id: int, current_user=Depends(require_permissions("view-budget")), db: Session = Depends(get_db)):
    licenses = db.query(SoftwareLicense).filter(SoftwareLicense.project_id == project_id).all()
    return [{"id": l.id, "name": l.name, "vendor": l.vendor, "seats": l.seats, "cost": float(l.cost) if l.cost else 0, "status": l.status} for l in licenses]


@router.post("/projects/{project_id}/software-licenses", status_code=201)
def add_license(project_id: int, body: SoftwareLicenseIn, current_user=Depends(require_permissions("manage-budget")), db: Session = Depends(get_db)):
    l = SoftwareLicense(project_id=project_id, name=body.name, vendor=body.vendor, license_type=body.license_type, seats=body.seats, cost=body.cost, status=body.status, renewal_date=datetime.fromisoformat(body.renewal_date).date() if body.renewal_date else None, created_at=datetime.now(timezone.utc))
    db.add(l)
    db.commit()
    db.refresh(l)
    return {"id": l.id, "name": l.name}
