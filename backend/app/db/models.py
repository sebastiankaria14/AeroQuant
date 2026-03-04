from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.session import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    watchlists: Mapped[list["Watchlist"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    prediction_history: Mapped[list["PredictionHistory"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class FlightRoute(Base):
    __tablename__ = "flight_routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    destination: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    airline: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    flight_class: Mapped[str] = mapped_column(String(20), nullable=False, default="economy")
    stops: Mapped[str] = mapped_column(String(50), nullable=True)
    avg_price: Mapped[float] = mapped_column(Float, nullable=True)
    min_price: Mapped[float] = mapped_column(Float, nullable=True)
    max_price: Mapped[float] = mapped_column(Float, nullable=True)
    price_volatility: Mapped[float] = mapped_column(Float, nullable=True)
    sample_count: Mapped[int] = mapped_column(Integer, default=0)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("source", "destination", "airline", "flight_class", name="uq_route"),
    )


class PriceRecord(Base):
    __tablename__ = "price_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("flight_routes.id"), nullable=False, index=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    dep_time: Mapped[str] = mapped_column(String(10), nullable=True)
    arr_time: Mapped[str] = mapped_column(String(10), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    stops: Mapped[str] = mapped_column(String(50), nullable=True)
    recorded_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    route: Mapped["FlightRoute"] = relationship()


class Watchlist(Base):
    __tablename__ = "watchlists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    destination: Mapped[str] = mapped_column(String(100), nullable=False)
    airline: Mapped[str] = mapped_column(String(100), nullable=True)
    flight_class: Mapped[str] = mapped_column(String(20), default="economy")
    alert_price: Mapped[float] = mapped_column(Float, nullable=True)
    is_alert_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="watchlists")

    __table_args__ = (
        UniqueConstraint("user_id", "source", "destination", "airline", "flight_class", name="uq_watchlist"),
    )


class PredictionHistory(Base):
    __tablename__ = "prediction_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    airline: Mapped[str] = mapped_column(String(100), nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    destination: Mapped[str] = mapped_column(String(100), nullable=False)
    stops: Mapped[str] = mapped_column(String(50), nullable=False)
    flight_class: Mapped[str] = mapped_column(String(20), nullable=False)
    days_until_departure: Mapped[int] = mapped_column(Integer, nullable=False)
    dep_time_block: Mapped[str] = mapped_column(String(20), nullable=True)
    predicted_price: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_lower: Mapped[float] = mapped_column(Float, nullable=True)
    confidence_upper: Mapped[float] = mapped_column(Float, nullable=True)
    model_used: Mapped[str] = mapped_column(String(50), nullable=True)
    # Buy/Wait intelligence
    recommendation: Mapped[str] = mapped_column(String(20), nullable=True)   # BUY_NOW | WAIT
    confidence_score: Mapped[float] = mapped_column(Float, nullable=True)
    fair_price: Mapped[float] = mapped_column(Float, nullable=True)
    market_avg: Mapped[float] = mapped_column(Float, nullable=True)
    price_diff_pct: Mapped[float] = mapped_column(Float, nullable=True)
    volatility_score: Mapped[float] = mapped_column(Float, nullable=True)
    shap_values: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    user: Mapped["User"] = relationship(back_populates="prediction_history")


class AirlineMetrics(Base):
    __tablename__ = "airline_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    airline: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    avg_price: Mapped[float] = mapped_column(Float, nullable=True)
    price_stability: Mapped[float] = mapped_column(Float, nullable=True)   # inverse of std-dev, 0-1
    spike_frequency: Mapped[float] = mapped_column(Float, nullable=True)   # % of records above +2σ
    popularity_score: Mapped[float] = mapped_column(Float, nullable=True)  # normalised booking count
    overall_score: Mapped[float] = mapped_column(Float, nullable=True)     # 0-10
    best_for: Mapped[str] = mapped_column(String(50), nullable=True)       # Budget/Stable/Premium
    economy_avg: Mapped[float] = mapped_column(Float, nullable=True)
    business_avg: Mapped[float] = mapped_column(Float, nullable=True)
    route_count: Mapped[int] = mapped_column(Integer, default=0)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ModelMetrics(Base):
    __tablename__ = "model_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    rmse: Mapped[float] = mapped_column(Float, nullable=True)
    mae: Mapped[float] = mapped_column(Float, nullable=True)
    r2: Mapped[float] = mapped_column(Float, nullable=True)
    mape: Mapped[float] = mapped_column(Float, nullable=True)
    is_best: Mapped[bool] = mapped_column(Boolean, default=False)
    trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    feature_count: Mapped[int] = mapped_column(Integer, nullable=True)
    training_rows: Mapped[int] = mapped_column(Integer, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)


class ForecastCache(Base):
    __tablename__ = "forecast_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    destination: Mapped[str] = mapped_column(String(100), nullable=False)
    airline: Mapped[str] = mapped_column(String(100), nullable=True)
    flight_class: Mapped[str] = mapped_column(String(20), nullable=False)
    forecast_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    horizon_days: Mapped[int] = mapped_column(Integer, default=30)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class PriceAlert(Base):
    __tablename__ = "price_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    watchlist_id: Mapped[int] = mapped_column(ForeignKey("watchlists.id"), nullable=True, index=True)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    destination: Mapped[str] = mapped_column(String(100), nullable=False)
    airline: Mapped[str] = mapped_column(String(100), nullable=True)
    flight_class: Mapped[str] = mapped_column(String(20), default="economy")
    target_price: Mapped[float] = mapped_column(Float, nullable=False)
    triggered_price: Mapped[float] = mapped_column(Float, nullable=True)
    is_triggered: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
