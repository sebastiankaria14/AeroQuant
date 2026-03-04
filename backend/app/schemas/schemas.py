from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field


# ─── Auth ────────────────────────────────────────────────────────────────────
class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    is_active: bool
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Prediction ───────────────────────────────────────────────────────────────
class PredictionInput(BaseModel):
    airline: str
    source: str
    destination: str
    stops: str = Field(default="non-stop", description="e.g. non-stop, 1-stop, 2+-stop")
    days_until_departure: int = Field(ge=0, le=365)
    dep_time: str = Field(default="10:00", description="HH:MM format")
    flight_class: str = Field(default="economy", pattern="^(economy|business)$")


class PredictionOutput(BaseModel):
    predicted_price: float
    confidence_lower: float
    confidence_upper: float
    model_used: str
    currency: str = "INR"
    input_echo: PredictionInput


# ─── Routes ───────────────────────────────────────────────────────────────────
class RouteOut(BaseModel):
    id: int
    source: str
    destination: str
    airline: str
    flight_class: str
    avg_price: Optional[float]
    min_price: Optional[float]
    max_price: Optional[float]
    price_volatility: Optional[float]

    model_config = {"from_attributes": True}


# ─── Analytics ────────────────────────────────────────────────────────────────
class TopRouteItem(BaseModel):
    source: str
    destination: str
    avg_price: float
    flight_class: str
    sample_count: int


class VolatilityItem(BaseModel):
    route: str
    airline: str
    volatility_score: float
    price_range: float


class PriceTrendPoint(BaseModel):
    date: str
    avg_price: float
    min_price: float
    max_price: float


class AnalyticsSummary(BaseModel):
    total_routes: int
    total_records: int
    avg_economy_price: float
    avg_business_price: float
    cheapest_airline: str
    most_expensive_route: str


# ─── Compare ──────────────────────────────────────────────────────────────────
class CompareRequest(BaseModel):
    route_a: dict
    route_b: dict


class CompareResult(BaseModel):
    route_a_label: str
    route_b_label: str
    route_a_prices: List[PriceTrendPoint]
    route_b_prices: List[PriceTrendPoint]
    route_a_avg: float
    route_b_avg: float
    difference_pct: float


# ─── Watchlist ────────────────────────────────────────────────────────────────
class WatchlistAdd(BaseModel):
    source: str
    destination: str
    airline: Optional[str] = None
    flight_class: str = "economy"
    alert_price: Optional[float] = None


class WatchlistOut(BaseModel):
    id: int
    source: str
    destination: str
    airline: Optional[str]
    flight_class: str
    alert_price: Optional[float]
    is_alert_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Buy/Wait Recommendation ──────────────────────────────────────────────────
class BuyWaitRecommendation(BaseModel):
    recommendation: str          # BUY_NOW | WAIT | NEUTRAL
    confidence_score: float      # 0-1
    fair_price: float
    market_avg: float
    price_diff_pct: float        # positive = overpriced, negative = underpriced
    volatility_score: float      # 0-100
    volatility_label: str        # Stable | Moderate | Highly Volatile
    price_in_5d: float
    price_in_10d: float
    price_in_30d: float
    reasoning: str


# ─── SHAP Explainability ──────────────────────────────────────────────────────
class ShapFeature(BaseModel):
    feature: str
    value: Any
    shap_value: float            # contribution in ₹
    direction: str               # positive | negative


class ExplainOutput(BaseModel):
    predicted_price: float
    base_value: float
    top_features: List[ShapFeature]
    summary: str


# ─── Full Prediction Output (enriched) ───────────────────────────────────────
class PredictionOutputV2(BaseModel):
    predicted_price: float
    confidence_lower: float
    confidence_upper: float
    model_used: str
    currency: str = "INR"
    input_echo: "PredictionInput"
    buy_wait: BuyWaitRecommendation
    explain: ExplainOutput


# ─── Forecast ────────────────────────────────────────────────────────────────
class ForecastPoint(BaseModel):
    ds: str                      # ISO date string
    yhat: float
    yhat_lower: float
    yhat_upper: float
    is_forecast: bool = True


class ForecastResponse(BaseModel):
    source: str
    destination: str
    airline: Optional[str]
    flight_class: str
    horizon_days: int
    points: List[ForecastPoint]
    trend_direction: str         # up | down | stable
    avg_forecasted_price: float


# ─── Volatility ───────────────────────────────────────────────────────────────
class VolatilityDetail(BaseModel):
    route: str
    airline: str
    volatility_score: float      # 0-100
    volatility_label: str        # Stable | Moderate | Highly Volatile
    price_range: float
    std_dev: float
    avg_price: float


# ─── Airline Metrics ──────────────────────────────────────────────────────────
class AirlineScoreOut(BaseModel):
    airline: str
    overall_score: float         # 0-10
    avg_price: float
    price_stability: float       # 0-1
    spike_frequency: float       # 0-1
    economy_avg: Optional[float]
    business_avg: Optional[float]
    best_for: str                # Budget | Stable | Premium
    route_count: int

    model_config = {"from_attributes": True}


# ─── Model Metrics ────────────────────────────────────────────────────────────
class ModelMetricsOut(BaseModel):
    model_name: str
    rmse: Optional[float]
    mae: Optional[float]
    r2: Optional[float]
    mape: Optional[float]
    is_best: bool
    trained_at: datetime

    model_config = {"from_attributes": True}


# ─── Price Alert ──────────────────────────────────────────────────────────────
class AlertCreate(BaseModel):
    source: str
    destination: str
    airline: Optional[str] = None
    flight_class: str = "economy"
    target_price: float


class AlertOut(BaseModel):
    id: int
    source: str
    destination: str
    airline: Optional[str]
    flight_class: str
    target_price: float
    triggered_price: Optional[float]
    is_triggered: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Admin ────────────────────────────────────────────────────────────────────
class AdminMetrics(BaseModel):
    total_predictions: int
    predictions_today: int
    most_searched_routes: List[Dict[str, Any]]
    avg_prediction_latency_ms: float
    model_accuracy: Dict[str, float]      # model_name → R2
    api_requests_last_hour: int
    active_alerts: int
    total_users: int
    cache_hit_rate: float


# ─── Seasonal Heatmap ─────────────────────────────────────────────────────────
class HeatmapCell(BaseModel):
    month: int
    month_label: str
    source: str
    destination: str
    avg_price: float
    sample_count: int


class SeasonalHeatmapResponse(BaseModel):
    cells: List[HeatmapCell]
    source: str
    destination: str
