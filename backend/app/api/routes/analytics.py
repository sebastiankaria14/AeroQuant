from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import FlightRoute, PredictionHistory, PriceRecord
from app.db.session import get_db
from app.schemas.schemas import (
    AnalyticsSummary,
    HeatmapCell,
    SeasonalHeatmapResponse,
    TopRouteItem,
    VolatilityDetail,
    VolatilityItem,
)
from app.services.cache import cache_get, cache_set

router = APIRouter()

MONTH_LABELS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


@router.get("/top-routes", response_model=List[TopRouteItem])
async def top_routes(limit: int = 10, db: AsyncSession = Depends(get_db)):
    cache_key = f"analytics:top-routes:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    stmt = (
        select(
            FlightRoute.source,
            FlightRoute.destination,
            FlightRoute.avg_price,
            FlightRoute.flight_class,
            FlightRoute.sample_count,
        )
        .where(FlightRoute.avg_price.isnot(None))
        .order_by(FlightRoute.avg_price.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()
    data = [
        TopRouteItem(
            source=r.source,
            destination=r.destination,
            avg_price=r.avg_price,
            flight_class=r.flight_class,
            sample_count=r.sample_count,
        ).model_dump()
        for r in rows
    ]
    await cache_set(cache_key, data)
    return data


@router.get("/volatility", response_model=List[VolatilityItem])
async def volatility(limit: int = 10, db: AsyncSession = Depends(get_db)):
    cache_key = f"analytics:volatility:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    stmt = (
        select(FlightRoute)
        .where(FlightRoute.price_volatility.isnot(None))
        .order_by(FlightRoute.price_volatility.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    data = [
        VolatilityItem(
            route=f"{r.source} → {r.destination}",
            airline=r.airline,
            volatility_score=round(r.price_volatility, 4),
            price_range=round((r.max_price or 0) - (r.min_price or 0), 2),
        ).model_dump()
        for r in rows
    ]
    await cache_set(cache_key, data)
    return data


@router.get("/volatility/detail", response_model=List[VolatilityDetail])
async def volatility_detail(limit: int = 10, db: AsyncSession = Depends(get_db)):
    """Enriched volatility with std_dev, avg_price and label."""
    cache_key = f"analytics:volatility-detail:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return [VolatilityDetail(**v) for v in cached]

    stmt = (
        select(FlightRoute)
        .where(FlightRoute.price_volatility.isnot(None))
        .order_by(FlightRoute.price_volatility.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    def _label(score: float) -> str:
        if score <= 30:
            return "Stable"
        elif score <= 60:
            return "Moderate"
        return "Highly Volatile"

    import math
    data = []
    for r in rows:
        avg = r.avg_price or 1
        raw_vol = r.price_volatility or 0
        std_dev = round(avg * raw_vol, 2)
        v_score = round(min(raw_vol * 250, 100.0), 2)
        data.append(VolatilityDetail(
            route=f"{r.source} → {r.destination}",
            airline=r.airline,
            volatility_score=v_score,
            volatility_label=_label(v_score),
            price_range=round((r.max_price or 0) - (r.min_price or 0), 2),
            std_dev=std_dev,
            avg_price=round(avg, 2),
        ).model_dump())

    await cache_set(cache_key, data, ttl=300)
    return [VolatilityDetail(**v) for v in data]


@router.get("/summary", response_model=AnalyticsSummary)
async def summary(db: AsyncSession = Depends(get_db)):
    cache_key = "analytics:summary"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    total_routes_res = await db.execute(select(func.count()).select_from(FlightRoute))
    total_routes = total_routes_res.scalar_one()

    total_records_res = await db.execute(select(func.count()).select_from(PredictionHistory))
    total_records = total_records_res.scalar_one()

    avg_econ_res = await db.execute(
        select(func.avg(FlightRoute.avg_price)).where(FlightRoute.flight_class == "economy")
    )
    avg_econ = avg_econ_res.scalar_one() or 0.0

    avg_biz_res = await db.execute(
        select(func.avg(FlightRoute.avg_price)).where(FlightRoute.flight_class == "business")
    )
    avg_biz = avg_biz_res.scalar_one() or 0.0

    cheapest_res = await db.execute(
        select(FlightRoute.airline)
        .where(FlightRoute.avg_price.isnot(None))
        .order_by(FlightRoute.avg_price.asc())
        .limit(1)
    )
    cheapest = cheapest_res.scalar_one_or_none() or "N/A"

    expensive_res = await db.execute(
        select(FlightRoute)
        .where(FlightRoute.avg_price.isnot(None))
        .order_by(FlightRoute.avg_price.desc())
        .limit(1)
    )
    expensive_route = expensive_res.scalar_one_or_none()
    expensive_label = (
        f"{expensive_route.source} → {expensive_route.destination}" if expensive_route else "N/A"
    )

    out = AnalyticsSummary(
        total_routes=total_routes,
        total_records=total_records,
        avg_economy_price=round(avg_econ, 2),
        avg_business_price=round(avg_biz, 2),
        cheapest_airline=cheapest,
        most_expensive_route=expensive_label,
    ).model_dump()
    await cache_set(cache_key, out, ttl=600)
    return out


@router.get("/price-trend")
async def price_trend(
    source: str = Query("Delhi"),
    destination: str = Query("Mumbai"),
    points: int = Query(30, ge=5, le=90),
    db: AsyncSession = Depends(get_db),
):
    """Synthetic day-ahead price trend for the selected route."""
    cache_key = f"analytics:price-trend:{source}:{destination}:{points}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    from app.ml.forecaster import build_synthetic_historical
    import numpy as np

    eco_df = build_synthetic_historical(source, destination, "economy", days=points)
    biz_df = build_synthetic_historical(source, destination, "business", days=points)

    data = [
        {
            "date": eco_df.iloc[i]["ds"],
            "days_left": points - i,
            "economy": round(float(eco_df.iloc[i]["y"]), 2),
            "business": round(float(biz_df.iloc[i]["y"]), 2),
        }
        for i in range(len(eco_df))
    ]
    await cache_set(cache_key, data, ttl=600)
    return data


@router.get("/seasonal-heatmap", response_model=SeasonalHeatmapResponse)
async def seasonal_heatmap(
    source: str = Query("Delhi"),
    destination: str = Query("Mumbai"),
    flight_class: str = Query("economy", pattern="^(economy|business)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Monthly average price heatmap for a route.
    Uses synthetic data when real records are sparse.
    """
    cache_key = f"analytics:heatmap:{source}:{destination}:{flight_class}"
    cached = await cache_get(cache_key)
    if cached:
        return SeasonalHeatmapResponse(**cached)

    # Try DB
    stmt = (
        select(
            extract("month", PriceRecord.recorded_date).label("month"),
            func.avg(PriceRecord.price).label("avg_price"),
            func.count().label("cnt"),
        )
        .join(FlightRoute, PriceRecord.route_id == FlightRoute.id)
        .where(
            FlightRoute.source.ilike(f"%{source}%"),
            FlightRoute.destination.ilike(f"%{destination}%"),
            FlightRoute.flight_class == flight_class,
        )
        .group_by("month")
        .order_by("month")
    )
    result = await db.execute(stmt)
    rows = result.all()

    if len(rows) >= 6:
        cells = [
            HeatmapCell(
                month=int(r.month),
                month_label=MONTH_LABELS[int(r.month)],
                source=source,
                destination=destination,
                avg_price=round(float(r.avg_price), 2),
                sample_count=int(r.cnt),
            )
            for r in rows
        ]
    else:
        # Synthetic seasonal pattern
        import numpy as np
        base = 4800 if flight_class == "economy" else 14000
        cells = []
        seasonal_factors = [1.0, 0.92, 0.89, 0.95, 1.02, 0.98, 1.10, 1.12, 1.05, 0.96, 1.06, 1.18]
        for m in range(1, 13):
            factor = seasonal_factors[m - 1]
            noise = np.random.uniform(-0.03, 0.03)
            cells.append(HeatmapCell(
                month=m,
                month_label=MONTH_LABELS[m],
                source=source,
                destination=destination,
                avg_price=round(base * (factor + noise), 2),
                sample_count=0,
            ))

    data = SeasonalHeatmapResponse(cells=cells, source=source, destination=destination).model_dump()
    await cache_set(cache_key, data, ttl=3600)
    return SeasonalHeatmapResponse(**data)



@router.get("/top-routes", response_model=List[TopRouteItem])
async def top_routes(limit: int = 10, db: AsyncSession = Depends(get_db)):
    cache_key = f"analytics:top-routes:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    stmt = (
        select(
            FlightRoute.source,
            FlightRoute.destination,
            FlightRoute.avg_price,
            FlightRoute.flight_class,
            FlightRoute.sample_count,
        )
        .where(FlightRoute.avg_price.isnot(None))
        .order_by(FlightRoute.avg_price.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()
    data = [
        TopRouteItem(
            source=r.source,
            destination=r.destination,
            avg_price=r.avg_price,
            flight_class=r.flight_class,
            sample_count=r.sample_count,
        ).model_dump()
        for r in rows
    ]
    await cache_set(cache_key, data)
    return data


@router.get("/volatility", response_model=List[VolatilityItem])
async def volatility(limit: int = 10, db: AsyncSession = Depends(get_db)):
    cache_key = f"analytics:volatility:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    stmt = (
        select(FlightRoute)
        .where(FlightRoute.price_volatility.isnot(None))
        .order_by(FlightRoute.price_volatility.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    data = [
        VolatilityItem(
            route=f"{r.source} → {r.destination}",
            airline=r.airline,
            volatility_score=round(r.price_volatility, 4),
            price_range=round((r.max_price or 0) - (r.min_price or 0), 2),
        ).model_dump()
        for r in rows
    ]
    await cache_set(cache_key, data)
    return data


@router.get("/summary", response_model=AnalyticsSummary)
async def summary(db: AsyncSession = Depends(get_db)):
    cache_key = "analytics:summary"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    total_routes_res = await db.execute(select(func.count()).select_from(FlightRoute))
    total_routes = total_routes_res.scalar_one()

    total_records_res = await db.execute(select(func.count()).select_from(PredictionHistory))
    total_records = total_records_res.scalar_one()

    avg_econ_res = await db.execute(
        select(func.avg(FlightRoute.avg_price)).where(FlightRoute.flight_class == "economy")
    )
    avg_econ = avg_econ_res.scalar_one() or 0.0

    avg_biz_res = await db.execute(
        select(func.avg(FlightRoute.avg_price)).where(FlightRoute.flight_class == "business")
    )
    avg_biz = avg_biz_res.scalar_one() or 0.0

    cheapest_res = await db.execute(
        select(FlightRoute.airline)
        .where(FlightRoute.avg_price.isnot(None))
        .order_by(FlightRoute.avg_price.asc())
        .limit(1)
    )
    cheapest = cheapest_res.scalar_one_or_none() or "N/A"

    expensive_res = await db.execute(
        select(FlightRoute)
        .where(FlightRoute.avg_price.isnot(None))
        .order_by(FlightRoute.avg_price.desc())
        .limit(1)
    )
    expensive_route = expensive_res.scalar_one_or_none()
    expensive_label = (
        f"{expensive_route.source} → {expensive_route.destination}" if expensive_route else "N/A"
    )

    out = AnalyticsSummary(
        total_routes=total_routes,
        total_records=total_records,
        avg_economy_price=round(avg_econ, 2),
        avg_business_price=round(avg_biz, 2),
        cheapest_airline=cheapest,
        most_expensive_route=expensive_label,
    ).model_dump()
    await cache_set(cache_key, out, ttl=600)
    return out
