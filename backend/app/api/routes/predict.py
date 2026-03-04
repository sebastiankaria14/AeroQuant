from __future__ import annotations

import json
import hashlib

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import PredictionHistory
from app.schemas.schemas import PredictionInput, PredictionOutput, PredictionOutputV2
from app.services.cache import cache_get, cache_set
from app.ml.predictor import get_predictor

router = APIRouter()


def _cache_key(payload: PredictionInput, v2: bool = False) -> str:
    raw = json.dumps(payload.model_dump(), sort_keys=True)
    prefix = "pred_v2:" if v2 else "pred:"
    return prefix + hashlib.md5(raw.encode()).hexdigest()


@router.post("/predict", response_model=PredictionOutput)
async def predict_price(
    payload: PredictionInput,
    db: AsyncSession = Depends(get_db),
):
    """V1 prediction — returns price + CI only."""
    key = _cache_key(payload)
    cached = await cache_get(key)
    if cached:
        return PredictionOutput(**cached)

    predictor = get_predictor()
    result = predictor.predict(payload)

    record = PredictionHistory(
        airline=payload.airline,
        source=payload.source,
        destination=payload.destination,
        stops=payload.stops,
        flight_class=payload.flight_class,
        days_until_departure=payload.days_until_departure,
        dep_time_block=predictor.time_to_block(payload.dep_time),
        predicted_price=result.predicted_price,
        confidence_lower=result.confidence_lower,
        confidence_upper=result.confidence_upper,
        model_used=result.model_used,
    )
    db.add(record)

    out = result.model_dump()
    await cache_set(key, out, ttl=120)
    return result


@router.post("/predict/v2", response_model=PredictionOutputV2)
async def predict_price_v2(
    payload: PredictionInput,
    db: AsyncSession = Depends(get_db),
):
    """V2 enriched prediction — includes Buy/Wait recommendation + SHAP explain."""
    key = _cache_key(payload, v2=True)
    cached = await cache_get(key)
    if cached:
        return PredictionOutputV2(**cached)

    predictor = get_predictor()
    result = predictor.predict_v2(payload)
    bw = result.buy_wait

    record = PredictionHistory(
        airline=payload.airline,
        source=payload.source,
        destination=payload.destination,
        stops=payload.stops,
        flight_class=payload.flight_class,
        days_until_departure=payload.days_until_departure,
        dep_time_block=predictor.time_to_block(payload.dep_time),
        predicted_price=result.predicted_price,
        confidence_lower=result.confidence_lower,
        confidence_upper=result.confidence_upper,
        model_used=result.model_used,
        recommendation=bw.recommendation,
        confidence_score=bw.confidence_score,
        fair_price=bw.fair_price,
        market_avg=bw.market_avg,
        price_diff_pct=bw.price_diff_pct,
        volatility_score=bw.volatility_score,
        shap_values={f.feature: f.shap_value for f in result.explain.top_features},
    )
    db.add(record)

    out = result.model_dump()
    await cache_set(key, out, ttl=120)
    return result
