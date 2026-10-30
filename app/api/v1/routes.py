from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.core.constants import RouteType
from app.core.exceptions import EntityNotFoundException
from app.models.route import Route, RouteStop
from app.models.bus import Bus
from app.schemas.trip import RouteResponse, RouteStopResponse
from app.schemas.admin import BusResponse


router = APIRouter(tags=["Routes & Buses"])


@router.get("/routes", response_model=List[RouteResponse])
async def list_routes(
    q: Optional[str] = Query(None, description="Search route name, origin, destination, or stop"),
    route_type: Optional[RouteType] = Query(None, description="Filter by CITY or INTERCITY"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """Lists bus routes with search, route type filter, and pagination"""
    stmt = (
        select(Route)
        .options(selectinload(Route.stops))
        .order_by(Route.name.asc())
        .offset(offset)
        .limit(limit)
    )

    if route_type:
        stmt = stmt.where(Route.route_type == route_type)

    if q:
        query_pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                Route.name.ilike(query_pattern),
                Route.origin.ilike(query_pattern),
                Route.destination.ilike(query_pattern)
            )
        )

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/routes/{route_id}", response_model=RouteResponse)
async def get_route(route_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieves full details of a specific route with ordered stops"""
    stmt = (
        select(Route)
        .where(Route.id == route_id)
        .options(selectinload(Route.stops))
    )
    route = (await db.execute(stmt)).scalar_one_or_none()
    if not route:
        raise EntityNotFoundException("Route", route_id)
    return route


@router.get("/buses", response_model=List[BusResponse])
async def list_buses(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """Lists buses available in the fleet"""
    stmt = select(Bus).order_by(Bus.registration_number.asc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

