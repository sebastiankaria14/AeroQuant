from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import FlightRoute
from app.db.session import get_db
from app.schemas.schemas import RouteOut
from app.services.cache import cache_get, cache_set

router = APIRouter()


@router.get("/routes", response_model=List[RouteOut])
async def list_routes(
    source: Optional[str] = Query(None),
    destination: Optional[str] = Query(None),
    airline: Optional[str] = Query(None),
    flight_class: Optional[str] = Query(None, pattern="^(economy|business)$"),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"routes:{source}:{destination}:{airline}:{flight_class}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    stmt = select(FlightRoute)
    if source:
        stmt = stmt.where(FlightRoute.source.ilike(f"%{source}%"))
    if destination:
        stmt = stmt.where(FlightRoute.destination.ilike(f"%{destination}%"))
    if airline:
        stmt = stmt.where(FlightRoute.airline.ilike(f"%{airline}%"))
    if flight_class:
        stmt = stmt.where(FlightRoute.flight_class == flight_class)

    result = await db.execute(stmt.limit(200))
    rows = result.scalars().all()
    data = [RouteOut.model_validate(r).model_dump() for r in rows]
    await cache_set(cache_key, data, ttl=300)
    return data
