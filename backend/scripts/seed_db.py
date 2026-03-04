"""
Seed flight route data from CSV datasets into PostgreSQL.
Run once after DB init:  python -m scripts.seed_db
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.models import Base, FlightRoute, PriceRecord
from app.ml.train import (
    feature_engineer_clean,
    load_business_csv,
    load_clean_dataset,
    load_economy_csv,
    normalize_stops,
)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://aeroquant:aeroquant_secret@localhost:5432/aeroquant_db",
)

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

DATA_DIR = Path(os.getenv("DATA_DIR", "data"))


def load_all() -> pd.DataFrame:
    frames = []
    clean = load_clean_dataset(DATA_DIR)
    clean = feature_engineer_clean(clean)
    frames.append(clean)

    econ = load_economy_csv(DATA_DIR)
    if not econ.empty:
        econ = feature_engineer_clean(econ)
        frames.append(econ)

    biz = load_business_csv(DATA_DIR)
    if not biz.empty:
        biz = feature_engineer_clean(biz)
        frames.append(biz)

    return pd.concat(frames, ignore_index=True)


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    df = load_all()
    print(f"Seeding {len(df)} records …")

    # Aggregate routes
    group_cols = ["source_city", "destination_city", "airline", "flight_class", "stops"]
    for col in group_cols:
        if col not in df.columns:
            df[col] = "Unknown"

    agg = (
        df.groupby(group_cols)
        .agg(
            avg_price=("price", "mean"),
            min_price=("price", "min"),
            max_price=("price", "max"),
            price_std=("price", "std"),
            sample_count=("price", "count"),
        )
        .reset_index()
    )
    agg["price_volatility"] = (agg["price_std"] / agg["avg_price"]).fillna(0)

    async with AsyncSessionLocal() as session:
        for _, row in agg.iterrows():
            route = FlightRoute(
                source=row["source_city"],
                destination=row["destination_city"],
                airline=row["airline"],
                flight_class=row["flight_class"],
                stops=normalize_stops(row["stops"]),
                avg_price=round(row["avg_price"], 2),
                min_price=round(row["min_price"], 2),
                max_price=round(row["max_price"], 2),
                price_volatility=round(row["price_volatility"], 6),
                sample_count=int(row["sample_count"]),
            )
            session.add(route)

        await session.commit()

    print("Seeding complete.")


if __name__ == "__main__":
    asyncio.run(seed())
