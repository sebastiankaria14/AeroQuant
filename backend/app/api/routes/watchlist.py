from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Watchlist
from app.db.session import get_db
from app.schemas.schemas import WatchlistAdd, WatchlistOut

router = APIRouter()

# ── Demo user id when auth is not wired (anonymous mode) ────────────────────
DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@router.get("", response_model=List[WatchlistOut])
async def get_watchlist(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Watchlist).where(Watchlist.user_id == DEMO_USER_ID).order_by(Watchlist.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=WatchlistOut, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(payload: WatchlistAdd, db: AsyncSession = Depends(get_db)):
    item = Watchlist(
        user_id=DEMO_USER_ID,
        source=payload.source,
        destination=payload.destination,
        airline=payload.airline,
        flight_class=payload.flight_class,
        alert_price=payload.alert_price,
        is_alert_active=payload.alert_price is not None,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(item_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Watchlist).where(Watchlist.id == item_id, Watchlist.user_id == DEMO_USER_ID)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    await db.delete(item)
