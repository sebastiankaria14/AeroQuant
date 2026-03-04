"""
Price Alert endpoints — create, list, and check alerts against current forecasts.
"""
from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import PriceAlert, Watchlist
from app.db.session import get_db
from app.ml.predictor import get_predictor
from app.schemas.schemas import AlertCreate, AlertOut, PredictionInput

router = APIRouter()

DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@router.get("/alerts", response_model=List[AlertOut])
async def list_alerts(db: AsyncSession = Depends(get_db)):
    """Return all active price alerts for the demo user."""
    result = await db.execute(
        select(PriceAlert)
        .where(PriceAlert.user_id == DEMO_USER_ID, PriceAlert.is_active == True)
        .order_by(PriceAlert.created_at.desc())
    )
    return result.scalars().all()


@router.post("/alerts", response_model=AlertOut, status_code=status.HTTP_201_CREATED)
async def create_alert(payload: AlertCreate, db: AsyncSession = Depends(get_db)):
    """Create a new price alert. Triggers immediately if current price ≤ target."""
    alert = PriceAlert(
        user_id=DEMO_USER_ID,
        source=payload.source,
        destination=payload.destination,
        airline=payload.airline,
        flight_class=payload.flight_class,
        target_price=payload.target_price,
    )

    # Check immediately against current prediction
    try:
        predictor = get_predictor()
        pred_input = PredictionInput(
            airline=payload.airline or "IndiGo",
            source=payload.source,
            destination=payload.destination,
            stops="non-stop",
            days_until_departure=30,
            dep_time="10:00",
            flight_class=payload.flight_class,
        )
        result = predictor.predict(pred_input)
        if result.predicted_price <= payload.target_price:
            alert.is_triggered = True
            alert.triggered_price = result.predicted_price
            from datetime import datetime, timezone
            alert.triggered_at = datetime.now(timezone.utc)
    except Exception:
        pass

    db.add(alert)
    await db.flush()
    await db.refresh(alert)
    return alert


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PriceAlert).where(PriceAlert.id == alert_id, PriceAlert.user_id == DEMO_USER_ID)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    await db.delete(alert)


@router.get("/watchlist/alerts")
async def check_watchlist_alerts(db: AsyncSession = Depends(get_db)):
    """
    Run current price predictions against all active watchlist alert prices.
    Returns items where predicted price ≤ alert price (i.e., price target hit).
    """
    result = await db.execute(
        select(Watchlist).where(
            Watchlist.user_id == DEMO_USER_ID,
            Watchlist.is_alert_active == True,
            Watchlist.alert_price.isnot(None),
        )
    )
    items = result.scalars().all()
    if not items:
        return []

    predictor = get_predictor()
    hits = []
    for item in items:
        try:
            pred_input = PredictionInput(
                airline=item.airline or "IndiGo",
                source=item.source,
                destination=item.destination,
                stops="non-stop",
                days_until_departure=30,
                dep_time="10:00",
                flight_class=item.flight_class,
            )
            result_pred = predictor.predict(pred_input)
            if result_pred.predicted_price <= (item.alert_price or float("inf")):
                hits.append({
                    "watchlist_id": item.id,
                    "source": item.source,
                    "destination": item.destination,
                    "airline": item.airline,
                    "flight_class": item.flight_class,
                    "alert_price": item.alert_price,
                    "predicted_price": result_pred.predicted_price,
                    "savings": round((item.alert_price or 0) - result_pred.predicted_price, 2),
                })
        except Exception:
            continue
    return hits
