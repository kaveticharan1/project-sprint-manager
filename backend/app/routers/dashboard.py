from fastapi import APIRouter

from app.deps import Db
from app.schemas.dashboard import DashboardSummary
from app.services import dashboard as service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def summary(db: Db):
    return await service.summary(db)
