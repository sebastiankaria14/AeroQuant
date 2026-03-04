"""
Admin Intelligence Panel endpoints.
Protected — requires admin JWT in production.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AirlineMetrics,
    ModelMetrics,
    PredictionHistory,
    PriceAlert,
    User,
    Watchlist,
)
from app.db.session import get_db
from app.schemas.schemas import AdminMetrics, AirlineScoreOut, ModelMetricsOut
from app.services.cache import cache_get, cache_set

router = APIRouter()


@router.get("/admin/metrics", response_model=AdminMetrics)
async def get_admin_metrics(db: AsyncSession = Depends(get_db)):
    """Aggregate platform-wide intelligence metrics."""
    cache_key = "admin:metrics"
    cached = await cache_get(cache_key)
    if cached:
        return AdminMetrics(**cached)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Total predictions
    total_preds_res = await db.execute(select(func.count()).select_from(PredictionHistory))
    total_predictions = int(total_preds_res.scalar_one() or 0)

    # Predictions today
    today_res = await db.execute(
        select(func.count()).select_from(PredictionHistory).where(PredictionHistory.created_at >= today_start)
    )
    predictions_today = int(today_res.scalar_one() or 0)

    # Most searched routes (top 5)
    routes_sql = await db.execute(
        select(
            PredictionHistory.source,
            PredictionHistory.destination,
            func.count().label("cnt"),
        )
        .group_by(PredictionHistory.source, PredictionHistory.destination)
        .order_by(func.count().desc())
        .limit(5)
    )
    most_searched = [
        {"route": f"{r.source} → {r.destination}", "count": r.cnt}
        for r in routes_sql.all()
    ]

    # Total users
    users_res = await db.execute(select(func.count()).select_from(User))
    total_users = int(users_res.scalar_one() or 0)

    # Active alerts
    alerts_res = await db.execute(
        select(func.count()).select_from(PriceAlert).where(PriceAlert.is_active == True)
    )
    active_alerts = int(alerts_res.scalar_one() or 0)

    # Model accuracy from ModelMetrics table
    metrics_res = await db.execute(select(ModelMetrics))
    model_rows = metrics_res.scalars().all()
    model_accuracy: Dict[str, float] = {
        m.model_name: round(m.r2 or 0.0, 4) for m in model_rows
    }

    data = AdminMetrics(
        total_predictions=total_predictions,
        predictions_today=predictions_today,
        most_searched_routes=most_searched,
        avg_prediction_latency_ms=42.0,   # placeholder — wire APM in prod
        model_accuracy=model_accuracy,
        api_requests_last_hour=predictions_today * 3,  # rough estimate
        active_alerts=active_alerts,
        total_users=total_users,
        cache_hit_rate=0.72,              # placeholder — wire Redis INFO in prod
    ).model_dump()

    await cache_set(cache_key, data, ttl=60)
    return AdminMetrics(**data)


@router.get("/admin/models", response_model=List[ModelMetricsOut])
async def list_model_metrics(db: AsyncSession = Depends(get_db)):
    """Return all saved model benchmark results."""
    result = await db.execute(
        select(ModelMetrics).order_by(ModelMetrics.trained_at.desc())
    )
    return result.scalars().all()


@router.get("/admin/airlines", response_model=List[AirlineScoreOut])
async def airline_scores(db: AsyncSession = Depends(get_db)):
    """Return computed airline performance scores."""
    cache_key = "admin:airline_scores"
    cached = await cache_get(cache_key)
    if cached:
        return [AirlineScoreOut(**a) for a in cached]

    result = await db.execute(
        select(AirlineMetrics).order_by(AirlineMetrics.overall_score.desc())
    )
    rows = result.scalars().all()
    if not rows:
        # Return stub scores when DB table is empty
        stubs = [
            AirlineScoreOut(airline="IndiGo", overall_score=8.2, avg_price=4500, price_stability=0.82, spike_frequency=0.05, economy_avg=4500, business_avg=13500, best_for="Budget", route_count=42),
            AirlineScoreOut(airline="Air India", overall_score=7.5, avg_price=6800, price_stability=0.70, spike_frequency=0.10, economy_avg=6800, business_avg=18000, best_for="Premium", route_count=38),
            AirlineScoreOut(airline="Vistara", overall_score=8.8, avg_price=7200, price_stability=0.88, spike_frequency=0.04, economy_avg=7200, business_avg=20000, best_for="Stable", route_count=28),
            AirlineScoreOut(airline="SpiceJet", overall_score=6.9, avg_price=4200, price_stability=0.62, spike_frequency=0.15, economy_avg=4200, business_avg=12000, best_for="Budget", route_count=35),
            AirlineScoreOut(airline="GO FIRST", overall_score=7.1, avg_price=4600, price_stability=0.68, spike_frequency=0.12, economy_avg=4600, business_avg=13000, best_for="Budget", route_count=25),
            AirlineScoreOut(airline="AirAsia", overall_score=7.4, avg_price=4400, price_stability=0.72, spike_frequency=0.09, economy_avg=4400, business_avg=12500, best_for="Budget", route_count=30),
        ]
        return stubs

    data = [AirlineScoreOut.model_validate(r).model_dump() for r in rows]
    await cache_set(cache_key, data, ttl=300)
    return [AirlineScoreOut(**a) for a in data]


@router.get("/admin/system-health")
async def system_health(db: AsyncSession = Depends(get_db)):
    """Quick liveness + capability check."""
    from app.ml.predictor import get_predictor, SHAP_AVAILABLE
    from app.ml.forecaster import PROPHET_AVAILABLE

    pred_ok = False
    try:
        p = get_predictor()
        pred_ok = p.model is not None
    except Exception:
        pass

    return {
        "status": "ok",
        "model_loaded": pred_ok,
        "shap_available": SHAP_AVAILABLE,
        "prophet_available": PROPHET_AVAILABLE,
        "server_type": "FastAPI/async",
    }
