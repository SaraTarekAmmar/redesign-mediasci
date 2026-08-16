from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user, require_permissions

from app.modules.resources import service
from app.modules.resources.schemas import ResourceCreateIn, ResourceUpdateIn

router = APIRouter(prefix="/resources", tags=["resources"])


@router.get("", response_model=List[dict])
def list_resources(
    q: str = Query(""),
    department_id: Optional[int] = Query(None),
    team_id: Optional[int] = Query(None),
    position: Optional[str] = Query(None),
    seniority: Optional[str] = Query(None),
    availability_status: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user=Depends(require_permissions("view-resources")),
    db: Session = Depends(get_db),
):
    return service.list_resources(
        db,
        q=q,
        department_id=department_id,
        team_id=team_id,
        position=position,
        seniority=seniority,
        availability_status=availability_status,
        project_id=project_id,
        is_active=is_active,
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=dict)
def create_resource(
    body: ResourceCreateIn,
    current_user=Depends(require_permissions("manage-teams")),
    db: Session = Depends(get_db),
):
    return service.create_resource(db, body)


@router.get("/{resource_id}", response_model=dict)
def get_resource(
    resource_id: int,
    current_user=Depends(require_permissions("view-resources")),
    db: Session = Depends(get_db),
):
    res = service.repo.get_resource_by_id(db, resource_id)
    if not res:
        raise HTTPException(404, f"Resource with ID {resource_id} not found.")
    return service.repo.format_resource_profile(db, res)


@router.put("/{resource_id}", response_model=dict)
def update_resource(
    resource_id: int,
    body: ResourceUpdateIn,
    current_user=Depends(require_permissions("manage-teams")),
    db: Session = Depends(get_db),
):
    return service.update_resource(db, resource_id, body)


@router.delete("/{resource_id}", response_model=dict)
def delete_resource(
    resource_id: int,
    current_user=Depends(require_permissions("manage-teams")),
    db: Session = Depends(get_db),
):
    return service.delete_resource(db, resource_id)
