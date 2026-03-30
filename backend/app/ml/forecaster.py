"""
AeroQuant Forecaster
====================
Prophet-based 30/60-day price forecasting per route.
Falls back to a lightweight trend extrapolation when Prophet is not available.
"""
from __future__ import annotations

import hashlib
import importlib.util
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import numpy as np
import pandas as pd

PROPHET_AVAILABLE = importlib.util.find_spec("prophet") is not None


def _make_cache_key(source: str, destination: str, airline: Optional[str], flight_class: str, horizon: int) -> str:
    raw = f"{source}:{destination}:{airline}:{flight_class}:{horizon}"
    return "forecast:" + hashlib.md5(raw.encode()).hexdigest()


def _fallback_forecast(
    historical: pd.DataFrame,
    horizon_days: int,
    last_date: datetime,
) -> List[dict]:
    """Simple linear trend extrapolation when Prophet is unavailable."""
    if len(historical) < 2:
        base = float(historical["y"].mean()) if len(historical) else 5000.0
        points = []
        for i in range(1, horizon_days + 1):
            ds = (last_date + timedelta(days=i)).strftime("%Y-%m-%d")
            points.append({"ds": ds, "yhat": round(base, 2), "yhat_lower": round(base * 0.92, 2), "yhat_upper": round(base * 1.08, 2), "is_forecast": True})
        return points

    x = np.arange(len(historical))
    y = historical["y"].values
    slope = float(np.polyfit(x, y, 1)[0])
    last_y = float(y[-1])
    std = float(y.std())
    points = []
    for i in range(1, horizon_days + 1):
        yhat = last_y + slope * i
        ds = (last_date + timedelta(days=i)).strftime("%Y-%m-%d")
        points.append({
            "ds": ds,
            "yhat": round(max(yhat, 500), 2),
            "yhat_lower": round(max(yhat - 1.5 * std, 500), 2),
            "yhat_upper": round(yhat + 1.5 * std, 2),
            "is_forecast": True,
        })
    return points


def build_synthetic_historical(
    source: str,
    destination: str,
    flight_class: str = "economy",
    days: int = 90,
) -> pd.DataFrame:
    """
    Produce synthetic daily price series anchored to realistic Indian domestic fares.
    Used when no real price_records exist in DB.
    """
    np.random.seed(hash(f"{source}{destination}{flight_class}") % (2**31))
    base_prices = {
        ("Delhi", "Mumbai", "economy"): 4800,
        ("Delhi", "Mumbai", "business"): 14000,
        ("Mumbai", "Bangalore", "economy"): 4200,
        ("Delhi", "Bangalore", "economy"): 5500,
        ("Delhi", "Hyderabad", "economy"): 5200,
        ("Mumbai", "Kolkata", "economy"): 6200,
        ("Delhi", "Chennai", "economy"): 6000,
    }
    base = base_prices.get((source, destination, flight_class),
                            base_prices.get((destination, source, flight_class), 5500))
    if flight_class == "business":
        base = int(base * 2.8)

    end = datetime.now(timezone.utc)
    dates = [end - timedelta(days=i) for i in range(days, 0, -1)]
    noise = np.random.normal(0, base * 0.08, days)
    trend = np.linspace(0, base * 0.05, days)   # slight upward trend
    seasonal = base * 0.06 * np.sin(np.linspace(0, 2 * np.pi, days))
    prices = base + noise + trend + seasonal

    return pd.DataFrame({"ds": [d.strftime("%Y-%m-%d") for d in dates], "y": np.maximum(prices, 500)})


def run_forecast(
    historical_df: pd.DataFrame,
    horizon_days: int = 30,
    source: str = "",
    destination: str = "",
    airline: Optional[str] = None,
    flight_class: str = "economy",
) -> dict:
    """
    Given historical price records (ds, y) run Prophet or fallback forecast.
    Returns a ForecastResponse-compatible dict.
    """
    last_date = datetime.now(timezone.utc)
    historical_points: List[dict] = [
        {"ds": str(row["ds"]), "yhat": float(row["y"]),
         "yhat_lower": float(row["y"]) * 0.95,
         "yhat_upper": float(row["y"]) * 1.05,
         "is_forecast": False}
        for _, row in historical_df.iterrows()
    ]

    if PROPHET_AVAILABLE and len(historical_df) >= 10:
        try:
            from prophet import Prophet

            m = Prophet(
                yearly_seasonality=False,
                weekly_seasonality=True,
                daily_seasonality=False,
                interval_width=0.80,
                changepoint_prior_scale=0.3,
            )
            m.fit(historical_df)
            future = m.make_future_dataframe(periods=horizon_days, freq="D")
            forecast_df = m.predict(future)
            forecast_pts = []
            for _, row in forecast_df.tail(horizon_days).iterrows():
                forecast_pts.append({
                    "ds": str(row["ds"])[:10],
                    "yhat": round(float(row["yhat"]), 2),
                    "yhat_lower": round(float(row["yhat_lower"]), 2),
                    "yhat_upper": round(float(row["yhat_upper"]), 2),
                    "is_forecast": True,
                })
        except Exception:
            forecast_pts = _fallback_forecast(historical_df, horizon_days, last_date)
    else:
        forecast_pts = _fallback_forecast(historical_df, horizon_days, last_date)

    all_points = historical_points[-30:] + forecast_pts  # last 30 hist + forecast
    forecast_yhats = [p["yhat"] for p in forecast_pts]
    avg_forecast = round(float(np.mean(forecast_yhats)), 2) if forecast_yhats else 0.0

    # Trend direction
    if len(forecast_yhats) >= 2:
        first_half = np.mean(forecast_yhats[: len(forecast_yhats) // 2])
        second_half = np.mean(forecast_yhats[len(forecast_yhats) // 2 :])
        if second_half > first_half * 1.03:
            trend = "up"
        elif second_half < first_half * 0.97:
            trend = "down"
        else:
            trend = "stable"
    else:
        trend = "stable"

    return {
        "source": source,
        "destination": destination,
        "airline": airline,
        "flight_class": flight_class,
        "horizon_days": horizon_days,
        "points": all_points,
        "trend_direction": trend,
        "avg_forecasted_price": avg_forecast,
    }
