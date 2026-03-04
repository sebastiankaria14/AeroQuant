"""
Forecast endpoint — uses Prophet (or fallback) to produce 30/60-day price forecasts.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import PriceRecord, FlightRoute, ForecastCache
from app.db.session import get_db
from app.ml.forecaster import (
    build_synthetic_historical,
    run_forecast,
    _make_cache_key,
)
from app.schemas.schemas import ForecastResponse
from app.services.cache import cache_get, cache_set

router = APIRouter()


@router.get("/forecast", response_model=ForecastResponse)
async def get_forecast(
    source: str = Query(..., description="Origin city"),
    destination: str = Query(..., description="Destination city"),
    airline: Optional[str] = Query(None),
    flight_class: str = Query("economy", pattern="^(economy|business)$"),
    horizon: int = Query(30, ge=7, le=60, description="Forecast horizon in days"),
    db: AsyncSession = Depends(get_db),
):
    """
    Return Prophet-based price forecast for a route.
    Results are Redis-cached for 6 hours; DB-backed ForecastCache for 12 hours.
    """
    cache_key = _make_cache_key(source, destination, airline, flight_class, horizon)

    # 1. Redis short cache
    cached = await cache_get(cache_key)
    if cached:
        return ForecastResponse(**cached)

    # 2. DB forecast cache (12 h)
    db_cache_result = await db.execute(
        select(ForecastCache).where(ForecastCache.cache_key == cache_key)
    )
    db_cache = db_cache_result.scalar_one_or_none()
    if db_cache:
        from datetime import datetime, timezone, timedelta
        age = (datetime.now(timezone.utc) - db_cache.computed_at.replace(tzinfo=timezone.utc)).total_seconds()
        if age < 43200:  # 12 hours
            data = db_cache.forecast_json
            await cache_set(cache_key, data, ttl=3600)
            return ForecastResponse(**data)

    # 3. Build historical series from DB (price_records)
    stmt = (
        select(
            func.date_trunc("day", PriceRecord.recorded_date).label("day"),
            func.avg(PriceRecord.price).label("avg_price"),
        )
        .join(FlightRoute, PriceRecord.route_id == FlightRoute.id)
        .where(
            FlightRoute.source.ilike(f"%{source}%"),
            FlightRoute.destination.ilike(f"%{destination}%"),
            FlightRoute.flight_class == flight_class,
        )
    )
    if airline:
        stmt = stmt.where(FlightRoute.airline.ilike(f"%{airline}%"))
    stmt = stmt.group_by("day").order_by("day")

    result = await db.execute(stmt)
    rows = result.all()

    import pandas as pd
    if len(rows) >= 10:
        hist_df = pd.DataFrame([{"ds": str(r.day)[:10], "y": float(r.avg_price)} for r in rows])
    else:
        # Synthetic fallback
        hist_df = build_synthetic_historical(source, destination, flight_class)

    data = run_forecast(
        historical_df=hist_df,
        horizon_days=horizon,
        source=source,
        destination=destination,
        airline=airline,
        flight_class=flight_class,
    )

    # Persist to DB cache
    if db_cache:
        db_cache.forecast_json = data
        from datetime import datetime, timezone
        db_cache.computed_at = datetime.now(timezone.utc)
    else:
        db.add(ForecastCache(
            cache_key=cache_key,
            source=source,
            destination=destination,
            airline=airline,
            flight_class=flight_class,
            forecast_json=data,
            horizon_days=horizon,
        ))

    await cache_set(cache_key, data, ttl=3600)
    return ForecastResponse(**data)
