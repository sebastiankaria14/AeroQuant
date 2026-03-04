from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import FlightRoute, PriceRecord
from app.db.session import get_db
from app.schemas.schemas import CompareResult, PriceTrendPoint
from app.services.cache import cache_get, cache_set

router = APIRouter()


async def _get_trend(
    source: str,
    destination: str,
    airline: str,
    flight_class: str,
    db: AsyncSession,
):
    route_res = await db.execute(
        select(FlightRoute).where(
            FlightRoute.source.ilike(source),
            FlightRoute.destination.ilike(destination),
            FlightRoute.airline.ilike(airline),
            FlightRoute.flight_class == flight_class,
        )
    )
    route = route_res.scalar_one_or_none()
    if not route:
        return [], 0.0
    records_res = await db.execute(
        select(PriceRecord)
        .where(PriceRecord.route_id == route.id)
        .order_by(PriceRecord.recorded_date.asc())
        .limit(60)
    )
    records = records_res.scalars().all()
    trend = [
        PriceTrendPoint(
            date=r.recorded_date.strftime("%Y-%m-%d"),
            avg_price=r.price,
            min_price=r.price,
            max_price=r.price,
        )
        for r in records
    ]
    avg = route.avg_price or 0.0
    return trend, avg


@router.get("/compare", response_model=CompareResult)
async def compare(
    source_a: str = Query(...),
    dest_a: str = Query(...),
    airline_a: str = Query(...),
    class_a: str = Query(default="economy"),
    source_b: str = Query(...),
    dest_b: str = Query(...),
    airline_b: str = Query(...),
    class_b: str = Query(default="economy"),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"compare:{source_a}:{dest_a}:{airline_a}:{class_a}:{source_b}:{dest_b}:{airline_b}:{class_b}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    trend_a, avg_a = await _get_trend(source_a, dest_a, airline_a, class_a, db)
    trend_b, avg_b = await _get_trend(source_b, dest_b, airline_b, class_b, db)

    diff_pct = ((avg_b - avg_a) / avg_a * 100) if avg_a else 0.0

    out = CompareResult(
        route_a_label=f"{source_a} → {dest_a} ({airline_a})",
        route_b_label=f"{source_b} → {dest_b} ({airline_b})",
        route_a_prices=trend_a,
        route_b_prices=trend_b,
        route_a_avg=round(avg_a, 2),
        route_b_avg=round(avg_b, 2),
        difference_pct=round(diff_pct, 2),
    ).model_dump()
    await cache_set(cache_key, out, ttl=300)
    return out
