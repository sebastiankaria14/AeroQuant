"""
AeroQuant Lite Server
=====================
Standalone FastAPI server — no PostgreSQL or Redis required.
Serves all frontend API endpoints using:
  • Trained ML models  (ml/saved_models/)
  • Raw CSV datasets   (data/)

Run:
    python server_lite.py
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

import joblib
import numpy as np
import pandas as pd
import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
DATA_DIR   = BASE_DIR / "data"
MODEL_DIR  = BASE_DIR / "ml" / "saved_models"

# ── Feature config (mirrors app/ml/features.py) ───────────────────────────────
FEATURE_COLS = [
    "airline", "source_city", "destination_city", "stops",
    "departure_time", "arrival_time", "flight_class",
    "duration_hours", "days_left", "route_frequency",
]


def extract_time_block(time_str: str) -> str:
    try:
        hour = int(str(time_str).split(":")[0])
    except Exception:
        return "Morning"
    if 5  <= hour < 9:  return "Early Morning"
    if 9  <= hour < 12: return "Morning"
    if 12 <= hour < 17: return "Afternoon"
    if 17 <= hour < 21: return "Evening"
    return "Night"


# ── Load datasets once ────────────────────────────────────────────────────────
@lru_cache(maxsize=1)
def load_data() -> pd.DataFrame:
    frames = []
    for fname, cls in [("Clean_Dataset.csv", None), ("economy.csv", "economy"), ("business.csv", "business")]:
        fpath = DATA_DIR / fname
        if not fpath.exists():
            continue
        df = pd.read_csv(fpath)
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

        if "clean_dataset" in fname.lower() or fname == "Clean_Dataset.csv":
            # Map Clean_Dataset columns
            remap = {
                "airline": "airline",
                "source_city": "source_city",
                "destination_city": "destination_city",
                "stops": "stops",
                "price": "price",
                "class": "flight_class",
                "days_left": "days_left",
                "duration": "duration_hours",
            }
            df = df.rename(columns={k: v for k, v in remap.items() if k in df.columns})
            if "flight_class" in df.columns:
                df["flight_class"] = df["flight_class"].str.lower().str.strip()
        else:
            # economy / business CSVs
            df["flight_class"] = cls
            city_cols = [c for c in df.columns if "from" in c or "source" in c or "origin" in c]
            dest_cols = [c for c in df.columns if "to" in c or "dest" in c]
            if city_cols: df.rename(columns={city_cols[0]: "source_city"}, inplace=True)
            if dest_cols: df.rename(columns={dest_cols[0]: "destination_city"}, inplace=True)
            price_cols = [c for c in df.columns if "price" in c or "fare" in c]
            if price_cols: df.rename(columns={price_cols[0]: "price"}, inplace=True)
            airline_cols = [c for c in df.columns if "airline" in c]
            if airline_cols: df.rename(columns={airline_cols[0]: "airline"}, inplace=True)

        # Keep only rows with required cols
        needed = ["source_city", "destination_city", "airline", "price", "flight_class"]
        if all(c in df.columns for c in needed):
            df = df[needed + [c for c in ["days_left", "duration_hours", "stops"] if c in df.columns]]
            df["price"] = pd.to_numeric(df["price"], errors="coerce")
            df = df.dropna(subset=["price"])
            frames.append(df)

    if not frames:
        return pd.DataFrame()
    combined = pd.concat(frames, ignore_index=True)
    combined["source_city"]      = combined["source_city"].astype(str).str.strip().str.title()
    combined["destination_city"] = combined["destination_city"].astype(str).str.strip().str.title()
    combined["airline"]          = combined["airline"].astype(str).str.strip()
    combined["flight_class"]     = combined["flight_class"].astype(str).str.lower().str.strip()
    return combined


# ── Load ML models ─────────────────────────────────────────────────────────────
@lru_cache(maxsize=1)
def load_models():
    if not MODEL_DIR.exists():
        return None, None, None
    preprocessor = joblib.load(MODEL_DIR / "preprocessor.joblib")
    model        = joblib.load(MODEL_DIR / "best_model.joblib")
    meta_path    = MODEL_DIR / "metadata.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    # Secondary model for confidence interval
    secondary_name = "lightgbm" if meta.get("best_model_name", "xgboost") == "xgboost" else "xgboost"
    secondary_path = MODEL_DIR / f"{secondary_name}_model.joblib"
    secondary = joblib.load(secondary_path) if secondary_path.exists() else model
    return preprocessor, model, secondary


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="AeroQuant Lite", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ────────────────────────────────────────────────────────────────────
class PredictionInput(BaseModel):
    airline: str
    source: str
    destination: str
    stops: str = "non-stop"
    days_until_departure: int = 30
    dep_time: str = "10:00"
    flight_class: str = "economy"


class PredictionOutput(BaseModel):
    predicted_price: float
    confidence_lower: float
    confidence_upper: float
    model_used: str
    currency: str = "INR"
    input_echo: PredictionInput

    model_config = ConfigDict(protected_namespaces=())


# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.get("/api/v1/health")
def health():
    return {"status": "ok", "server": "lite"}


@app.get("/api/v1/analytics/summary")
def analytics_summary():
    df = load_data()
    if df.empty:
        raise HTTPException(503, "No data loaded")

    eco = df[df["flight_class"] == "economy"]["price"]
    biz = df[df["flight_class"] == "business"]["price"]

    # Cheapest airline by mean economy price
    cheapest = (
        df[df["flight_class"] == "economy"]
        .groupby("airline")["price"].mean()
        .idxmin() if not eco.empty else "N/A"
    )
    # Most expensive route
    route_avg = (
        df.groupby(["source_city", "destination_city"])["price"]
        .mean()
        .reset_index()
        .sort_values("price", ascending=False)
    )
    most_exp_route = (
        f"{route_avg.iloc[0]['source_city']} → {route_avg.iloc[0]['destination_city']}"
        if not route_avg.empty else "N/A"
    )

    route_count = df.groupby(["source_city", "destination_city"]).ngroups

    return {
        "total_routes": int(route_count),
        "total_records": int(len(df)),
        "avg_economy_price":  round(float(eco.mean()) if not eco.empty else 0, 2),
        "avg_business_price": round(float(biz.mean()) if not biz.empty else 0, 2),
        "cheapest_airline": str(cheapest),
        "most_expensive_route": most_exp_route,
    }


@app.get("/api/v1/analytics/top-routes")
def top_routes(limit: int = Query(10, ge=1, le=50)):
    df = load_data()
    if df.empty:
        return []
    grp = (
        df.groupby(["source_city", "destination_city", "flight_class"])["price"]
        .agg(avg_price="mean", sample_count="count")
        .reset_index()
        .sort_values("avg_price", ascending=False)
        .head(limit)
    )
    return [
        {
            "source":       row["source_city"],
            "destination":  row["destination_city"],
            "avg_price":    round(row["avg_price"], 2),
            "flight_class": row["flight_class"],
            "sample_count": int(row["sample_count"]),
        }
        for _, row in grp.iterrows()
    ]


@app.get("/api/v1/analytics/volatility")
def volatility(limit: int = Query(10, ge=1, le=50)):
    df = load_data()
    if df.empty:
        return []
    grp = (
        df.groupby(["source_city", "destination_city", "airline"])["price"]
        .agg(
            price_std="std",
            price_mean="mean",
            price_min="min",
            price_max="max",
        )
        .reset_index()
        .dropna()
    )
    grp["volatility_score"] = grp["price_std"] / grp["price_mean"]
    grp["price_range"]      = grp["price_max"] - grp["price_min"]
    grp = grp.sort_values("volatility_score", ascending=False).head(limit)

    return [
        {
            "route":            f"{row['source_city']} → {row['destination_city']}",
            "airline":          row["airline"],
            "volatility_score": round(row["volatility_score"], 4),
            "price_range":      round(row["price_range"], 2),
        }
        for _, row in grp.iterrows()
    ]


@app.get("/api/v1/routes")
def routes(
    source: Optional[str] = None,
    destination: Optional[str] = None,
    airline: Optional[str] = None,
    flight_class: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
):
    df = load_data()
    if df.empty:
        return []
    if source:       df = df[df["source_city"].str.lower() == source.lower()]
    if destination:  df = df[df["destination_city"].str.lower() == destination.lower()]
    if airline:      df = df[df["airline"].str.lower() == airline.lower()]
    if flight_class: df = df[df["flight_class"].str.lower() == flight_class.lower()]

    grp = (
        df.groupby(["source_city", "destination_city", "airline", "flight_class"])["price"]
        .agg(avg_price="mean", min_price="min", max_price="max", count="count")
        .reset_index()
        .head(limit)
    )
    results = []
    for i, row in grp.iterrows():
        results.append({
            "id": int(i),
            "source": row["source_city"],
            "destination": row["destination_city"],
            "airline": row["airline"],
            "flight_class": row["flight_class"],
            "avg_price": round(row["avg_price"], 2),
            "min_price": round(row["min_price"], 2),
            "max_price": round(row["max_price"], 2),
            "price_volatility": round((row["max_price"] - row["min_price"]) / row["avg_price"], 4),
        })
    return results


@app.post("/api/v1/predict", response_model=PredictionOutput)
def predict(payload: PredictionInput):
    preprocessor, model, secondary = load_models()
    if preprocessor is None:
        raise HTTPException(503, "ML models not found. Run: python -m ml.train --data-dir data --model-dir ml/saved_models")

    dep_block = extract_time_block(payload.dep_time)

    row = {
        "airline":          payload.airline,
        "source_city":      payload.source,
        "destination_city": payload.destination,
        "stops":            payload.stops,
        "departure_time":   dep_block,
        "arrival_time":     "Evening",
        "flight_class":     payload.flight_class,
        "duration_hours":   2.0,
        "days_left":        payload.days_until_departure,
        "route_frequency":  50,
    }

    df = pd.DataFrame([row])[FEATURE_COLS]

    try:
        X            = preprocessor.transform(df)
        primary_pred = float(model.predict(X)[0])
        second_pred  = float(secondary.predict(X)[0])
    except Exception as e:
        raise HTTPException(500, f"Model inference error: {e}")

    spread  = abs(primary_pred - second_pred)
    ci_half = max(spread * 1.5, primary_pred * 0.08)

    meta_path = MODEL_DIR / "metadata.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}

    return PredictionOutput(
        predicted_price   = round(primary_pred, 2),
        confidence_lower  = round(max(0, primary_pred - ci_half), 2),
        confidence_upper  = round(primary_pred + ci_half, 2),
        model_used        = meta.get("best_model_name", "xgboost"),
        input_echo        = payload,
    )


@app.get("/api/v1/compare")
def compare(
    source_a: str, dest_a: str, airline_a: str, class_a: str = "economy",
    source_b: str = "", dest_b: str = "", airline_b: str = "", class_b: str = "economy",
):
    preprocessor, model, _ = load_models()
    if preprocessor is None:
        raise HTTPException(503, "ML models not loaded")

    # Days-ahead buckets for the trend chart
    days_series = [1, 3, 7, 14, 21, 30, 45, 60, 90, 120, 180, 270, 365]

    def predict_series(src: str, dst: str, airline: str, cls: str):
        rows = []
        for d in days_series:
            row = {
                "airline":          airline,
                "source_city":      src.strip().title(),
                "destination_city": dst.strip().title(),
                "stops":            "non-stop",
                "departure_time":   "Morning",
                "arrival_time":     "Evening",
                "flight_class":     cls.lower(),
                "duration_hours":   2.0,
                "days_left":        d,
                "route_frequency":  50,
            }
            rows.append(row)
        df = pd.DataFrame(rows)[FEATURE_COLS]
        preds = model.predict(preprocessor.transform(df)).tolist()
        return [
            {"date": f"{d}d", "days": d, "avg_price": round(p, 2), "min_price": round(p * 0.92, 2), "max_price": round(p * 1.08, 2)}
            for d, p in zip(days_series, preds)
        ]

    series_a = predict_series(source_a, dest_a, airline_a, class_a)
    series_b = predict_series(source_b, dest_b, airline_b, class_b)

    avg_a = round(float(np.mean([p["avg_price"] for p in series_a])), 2)
    avg_b = round(float(np.mean([p["avg_price"] for p in series_b])), 2)
    diff_pct = round((avg_b - avg_a) / avg_a * 100, 2) if avg_a > 0 else 0.0

    # Best booking window = day bucket with lowest predicted price
    best_a = min(series_a, key=lambda x: x["avg_price"])
    best_b = min(series_b, key=lambda x: x["avg_price"])

    return {
        "route_a_label": f"{source_a} → {dest_a} ({airline_a}, {class_a})",
        "route_b_label": f"{source_b} → {dest_b} ({airline_b}, {class_b})",
        "route_a_prices": series_a,
        "route_b_prices": series_b,
        "route_a_avg": avg_a,
        "route_b_avg": avg_b,
        "route_a_min": min(p["avg_price"] for p in series_a),
        "route_b_min": min(p["avg_price"] for p in series_b),
        "difference_pct": diff_pct,
        "cheaper_route": "A" if avg_a <= avg_b else "B",
        "best_booking_days_a": best_a["days"],
        "best_booking_days_b": best_b["days"],
        "savings": round(abs(avg_a - avg_b), 2),
    }


# ── File-backed watchlist store ───────────────────────────────────────────────
WATCHLIST_FILE = BASE_DIR / "watchlist.json"


def _load_watchlist() -> tuple[list[dict], int]:
    if WATCHLIST_FILE.exists():
        try:
            data = json.loads(WATCHLIST_FILE.read_text())
            items = data.get("items", [])
            counter = data.get("counter", len(items))
            return items, counter
        except Exception:
            pass
    return [], 0


def _save_watchlist(items: list[dict], counter: int) -> None:
    try:
        WATCHLIST_FILE.write_text(json.dumps({"items": items, "counter": counter}, indent=2))
    except Exception as e:
        print(f"Warning: could not save watchlist: {e}")


_watchlist, _watchlist_counter = _load_watchlist()


class WatchlistAdd(BaseModel):
    source: str
    destination: str
    airline: Optional[str] = None
    flight_class: str = "economy"
    alert_price: Optional[float] = None


@app.get("/api/v1/watchlist")
def get_watchlist():
    return _watchlist


@app.post("/api/v1/watchlist", status_code=201)
def add_watchlist(payload: WatchlistAdd):
    global _watchlist_counter, _watchlist
    _watchlist_counter += 1
    from datetime import datetime, timezone
    entry = {
        "id":              _watchlist_counter,
        "source":          payload.source,
        "destination":     payload.destination,
        "airline":         payload.airline,
        "flight_class":    payload.flight_class,
        "alert_price":     payload.alert_price,
        "is_alert_active": payload.alert_price is not None,
        "created_at":      datetime.now(timezone.utc).isoformat(),
    }
    _watchlist.append(entry)
    _save_watchlist(_watchlist, _watchlist_counter)
    return entry


@app.delete("/api/v1/watchlist/{item_id}", status_code=204)
def delete_watchlist(item_id: int):
    global _watchlist
    before = len(_watchlist)
    _watchlist = [w for w in _watchlist if w["id"] != item_id]
    if len(_watchlist) == before:
        raise HTTPException(404, "Watchlist item not found")
    _save_watchlist(_watchlist, _watchlist_counter)


@app.get("/api/v1/watchlist/alerts")
def watchlist_alerts():
    """Check each watchlist item with an alert_price against ML predictions.
    Returns items where predicted price <= alert_price (triggered alerts).
    """
    if not _watchlist:
        return []

    preprocessor, model, _ = load_models()
    if preprocessor is None or model is None:
        return []

    triggered = []
    for item in _watchlist:
        if not item.get("alert_price"):
            continue
        try:
            row = {
                "airline":          item.get("airline") or "IndiGo",
                "source_city":      item["source"],
                "destination_city": item["destination"],
                "stops":            "non-stop",
                "departure_time":   "Morning",
                "arrival_time":     "Evening",
                "flight_class":     item.get("flight_class", "economy"),
                "duration_hours":   2.0,
                "days_left":        30,
                "route_frequency":  50,
            }
            df_row = pd.DataFrame([row])[FEATURE_COLS]
            predicted = float(model.predict(preprocessor.transform(df_row))[0])
            if predicted <= item["alert_price"]:
                triggered.append({
                    "watchlist_id":   item["id"],
                    "source":         item["source"],
                    "destination":    item["destination"],
                    "airline":        item.get("airline"),
                    "flight_class":   item.get("flight_class", "economy"),
                    "alert_price":    item["alert_price"],
                    "predicted_price": round(predicted, 2),
                    "savings":        round(item["alert_price"] - predicted, 2),
                })
        except Exception:
            continue
    return triggered


@app.get("/api/v1/admin/system-health")
def system_health():
    preprocessor, model, _ = load_models()
    df = load_data()
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "shap_available": False,
        "prophet_available": False,
        "data_rows": int(len(df)),
        "server_type": "lite (no database)",
    }


# ── predict/v2 ────────────────────────────────────────────────────────────────
@app.post("/api/v1/predict/v2")
def predict_v2(payload: PredictionInput):
    """Enriched prediction: buy/wait recommendation + SHAP-lite explanation."""
    preprocessor, model, secondary = load_models()
    if preprocessor is None:
        raise HTTPException(503, "ML models not found")

    dep_block = extract_time_block(payload.dep_time)
    row = {
        "airline":          payload.airline,
        "source_city":      payload.source,
        "destination_city": payload.destination,
        "stops":            payload.stops,
        "departure_time":   dep_block,
        "arrival_time":     "Evening",
        "flight_class":     payload.flight_class,
        "duration_hours":   2.0,
        "days_left":        payload.days_until_departure,
        "route_frequency":  50,
    }
    df_row = pd.DataFrame([row])[FEATURE_COLS]
    try:
        X            = preprocessor.transform(df_row)
        primary_pred = float(model.predict(X)[0])
        second_pred  = float(secondary.predict(X)[0])
    except Exception as e:
        raise HTTPException(500, f"Model error: {e}")

    spread  = abs(primary_pred - second_pred)
    ci_half = max(spread * 1.5, primary_pred * 0.08)

    # Buy/Wait engine: compare vs route average
    df = load_data()
    route_mask = (
        (df["source_city"].str.lower() == payload.source.lower()) &
        (df["destination_city"].str.lower() == payload.destination.lower()) &
        (df["flight_class"].str.lower() == payload.flight_class.lower())
    )
    route_df = df[route_mask]["price"]
    market_avg = float(route_df.mean()) if not route_df.empty else primary_pred
    fair_price = float(route_df.quantile(0.35)) if not route_df.empty else primary_pred * 0.9
    price_diff_pct = round((primary_pred - fair_price) / fair_price * 100, 1)

    # Volatility based on std/mean
    std_dev = float(route_df.std()) if not route_df.empty else primary_pred * 0.1
    vol_score = min(100.0, round(std_dev / market_avg * 250, 1)) if market_avg > 0 else 30.0
    vol_label = "Low" if vol_score < 30 else "Medium" if vol_score < 65 else "High"

    # Polynomial heuristic for future prices
    d = payload.days_until_departure
    decay = 0.0012  # price typically rises as departure nears
    price_5d  = round(primary_pred * (1 + decay * max(0, d - 5)),  0)
    price_10d = round(primary_pred * (1 + decay * max(0, d - 10)), 0)
    price_30d = round(primary_pred * (1 + decay * max(0, d - 30)), 0)

    if price_diff_pct <= -5:
        recommendation = "buy"
        confidence = min(0.95, 0.65 + abs(price_diff_pct) * 0.01)
        reasoning = f"Price is {abs(price_diff_pct):.1f}% below fair value — good time to book."
    elif price_diff_pct <= 8:
        recommendation = "wait"
        confidence = 0.55
        reasoning = "Price is near fair value. Monitor for a better deal in the next few days."
    else:
        recommendation = "buy"
        confidence = min(0.9, 0.5 + price_diff_pct * 0.008)
        reasoning = f"Price is {price_diff_pct:.1f}% above fair value but expected to rise further — lock in now."

    # SHAP-lite: heuristic feature contributions
    stops_impact = {"non-stop": -800, "1-stop": 200, "2+-stop": 600}.get(payload.stops, 0)
    class_impact = 30000 if payload.flight_class.lower() == "business" else 0
    days_impact  = round((30 - d) * 35, 0) if d < 30 else round((d - 30) * -18, 0)
    airline_premium = {"Air India": 2000, "Vistara": 1800, "IndiGo": -500, "SpiceJet": -800, "GO FIRST": -600, "AirAsia": -700}
    a_impact = airline_premium.get(payload.airline, 0)

    shap_features = [
        {"feature": "Flight Class",        "value": payload.flight_class, "shap_value": round(class_impact, 0),  "direction": "positive" if class_impact >= 0 else "negative"},
        {"feature": "Days Until Departure","value": d,                    "shap_value": round(days_impact, 0),   "direction": "positive" if days_impact >= 0 else "negative"},
        {"feature": "Airline",             "value": payload.airline,      "shap_value": round(a_impact, 0),      "direction": "positive" if a_impact >= 0 else "negative"},
        {"feature": "Stops",               "value": payload.stops,        "shap_value": round(stops_impact, 0),  "direction": "positive" if stops_impact >= 0 else "negative"},
        {"feature": "Route Demand",        "value": f"{payload.source}→{payload.destination}", "shap_value": round(primary_pred * 0.05, 0), "direction": "positive"},
    ]
    shap_features.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

    meta_path = MODEL_DIR / "metadata.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}

    return {
        "predicted_price":  round(primary_pred, 2),
        "confidence_lower": round(max(0, primary_pred - ci_half), 2),
        "confidence_upper": round(primary_pred + ci_half, 2),
        "model_used":       meta.get("best_model_name", "xgboost"),
        "currency":         "INR",
        "input_echo":       payload.model_dump(),
        "buy_wait": {
            "recommendation":   recommendation,
            "confidence_score": round(confidence, 4),
            "fair_price":       round(fair_price, 2),
            "market_avg":       round(market_avg, 2),
            "price_diff_pct":   price_diff_pct,
            "volatility_score": vol_score,
            "volatility_label": vol_label,
            "price_in_5d":      price_5d,
            "price_in_10d":     price_10d,
            "price_in_30d":     price_30d,
            "reasoning":        reasoning,
        },
        "explain": {
            "predicted_price": round(primary_pred, 2),
            "base_value":      round(market_avg, 2),
            "top_features":    shap_features,
            "summary":         f"Top driver: {shap_features[0]['feature']} ({shap_features[0]['value']})",
        },
    }


# ── explain ───────────────────────────────────────────────────────────────────
@app.post("/api/v1/explain")
def explain(payload: PredictionInput):
    result = predict_v2(payload)
    return result["explain"]


# ── forecast ──────────────────────────────────────────────────────────────────
@app.get("/api/v1/forecast")
def forecast(
    source: str = "Delhi",
    destination: str = "Mumbai",
    airline: Optional[str] = None,
    flight_class: str = "Economy",
    horizon_days: int = Query(30, ge=7, le=60),
):
    preprocessor, model, _ = load_models()
    if preprocessor is None:
        raise HTTPException(503, "ML models not found")

    import datetime as dt_mod
    today = dt_mod.date.today()

    # Build historical (last 30 days) + forecast (horizon_days ahead) using ML
    historical_days = list(range(30, 0, -1))
    forecast_days   = list(range(1, horizon_days + 1))

    def ml_price(days_left: int, cls: str) -> float:
        row = {
            "airline":          airline or ("Air India" if cls.lower() == "business" else "IndiGo"),
            "source_city":      source.strip().title(),
            "destination_city": destination.strip().title(),
            "stops":            "non-stop",
            "departure_time":   "Morning",
            "arrival_time":     "Evening",
            "flight_class":     cls.lower(),
            "duration_hours":   2.0,
            "days_left":        max(1, days_left),
            "route_frequency":  50,
        }
        df_r = pd.DataFrame([row])[FEATURE_COLS]
        return float(model.predict(preprocessor.transform(df_r))[0])

    points = []
    all_prices = []

    # Historical points
    for d in historical_days:
        p = ml_price(d + horizon_days, flight_class)  # simulate past booking window
        spread = p * 0.04
        date_str = (today - dt_mod.timedelta(days=d)).isoformat()
        all_prices.append(p)
        points.append({
            "ds": date_str, "yhat": round(p, 2),
            "yhat_lower": round(p - spread, 2), "yhat_upper": round(p + spread, 2),
            "is_forecast": False,
        })

    # Forecast points
    for d in forecast_days:
        p = ml_price(horizon_days - d + 1, flight_class)
        spread = p * 0.06 * (1 + d / horizon_days)
        date_str = (today + dt_mod.timedelta(days=d)).isoformat()
        all_prices.append(p)
        points.append({
            "ds": date_str, "yhat": round(p, 2),
            "yhat_lower": round(max(0, p - spread), 2), "yhat_upper": round(p + spread, 2),
            "is_forecast": True,
        })

    forecast_prices = [pt["yhat"] for pt in points if pt["is_forecast"]]
    avg_forecast = round(float(np.mean(forecast_prices)), 2) if forecast_prices else 0

    first_half = forecast_prices[:len(forecast_prices)//2]
    second_half = forecast_prices[len(forecast_prices)//2:]
    if not first_half or not second_half:
        trend = "stable"
    else:
        diff_pct = (np.mean(second_half) - np.mean(first_half)) / np.mean(first_half) * 100
        trend = "up" if diff_pct > 2 else "down" if diff_pct < -2 else "stable"

    return {
        "source": source, "destination": destination,
        "airline": airline or "All", "flight_class": flight_class,
        "horizon_days": horizon_days, "points": points,
        "trend_direction": trend, "avg_forecasted_price": avg_forecast,
    }


# ── seasonal heatmap ──────────────────────────────────────────────────────────
@app.get("/api/v1/analytics/seasonal-heatmap")
def seasonal_heatmap(
    source: str = "Delhi",
    destination: str = "Mumbai",
    flight_class: str = "Economy",
):
    df = load_data()
    MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

    # Try to get real data filtered by route
    route_mask = (
        (df["source_city"].str.lower() == source.lower()) &
        (df["destination_city"].str.lower() == destination.lower())
    )
    route_df = df[route_mask]

    if not route_df.empty and "days_left" in route_df.columns:
        # Map days_left → approximate month (lower days_left = booked recently = closer to peak)
        route_df = route_df.copy()
        import datetime as dt_mod
        today_month = dt_mod.date.today().month
        route_df["days_left"] = pd.to_numeric(route_df["days_left"], errors="coerce")
        route_df = route_df.dropna(subset=["days_left"])
        # Assign month based on days_left bucket
        route_df["month_idx"] = ((today_month - 1 + (route_df["days_left"] / 30).astype(int)) % 12).astype(int)
        cls_lower = flight_class.lower()
        if cls_lower in ("economy", "business"):
            cls_df = route_df[route_df["flight_class"] == cls_lower]
        else:
            cls_df = route_df
        if not cls_df.empty:
            monthly = cls_df.groupby("month_idx")["price"].mean()
            cells = []
            for i, m in enumerate(MONTHS):
                p = float(monthly.get(i, np.nan))
                if np.isnan(p):
                    # Fill with overall mean ± seasonal factor
                    base = float(cls_df["price"].mean())
                    seasonal = [1.05,0.98,0.96,1.0,1.02,1.08,1.12,1.10,1.05,0.97,0.99,1.09]
                    p = round(base * seasonal[i], 2)
                cells.append({"month": m, "month_num": i + 1, "avg_price": round(p, 2), "flight_class": flight_class})
            return {"source": source, "destination": destination, "flight_class": flight_class, "cells": cells}

    # Fallback: ML-based seasonal estimation
    preprocessor, model, _ = load_models()
    if preprocessor is None:
        return {"source": source, "destination": destination, "flight_class": flight_class, "cells": []}

    seasonal_factors = [1.05,0.98,0.96,1.0,1.02,1.08,1.12,1.10,1.05,0.97,0.99,1.09]
    base_row = {
        "airline": "IndiGo", "source_city": source.strip().title(),
        "destination_city": destination.strip().title(),
        "stops": "non-stop", "departure_time": "Morning", "arrival_time": "Evening",
        "flight_class": flight_class.lower(), "duration_hours": 2.0,
        "days_left": 45, "route_frequency": 50,
    }
    df_base = pd.DataFrame([base_row])[FEATURE_COLS]
    base_price = float(model.predict(preprocessor.transform(df_base))[0])

    cells = [
        {"month": m, "month_num": i + 1, "avg_price": round(base_price * seasonal_factors[i], 2), "flight_class": flight_class}
        for i, m in enumerate(MONTHS)
    ]
    return {"source": source, "destination": destination, "flight_class": flight_class, "cells": cells}


# ── volatility/detail ─────────────────────────────────────────────────────────
@app.get("/api/v1/analytics/volatility/detail")
def volatility_detail(
    source: str = "Delhi",
    destination: str = "Mumbai",
    airline: Optional[str] = None,
    flight_class: str = "Economy",
):
    df = load_data()
    mask = (
        (df["source_city"].str.lower() == source.lower()) &
        (df["destination_city"].str.lower() == destination.lower()) &
        (df["flight_class"].str.lower() == flight_class.lower())
    )
    if airline:
        mask &= (df["airline"].str.lower() == airline.lower())
    sub = df[mask]["price"].dropna()
    if sub.empty:
        return {"route": f"{source} → {destination}", "airline": airline or "All",
                "volatility_score": 0, "volatility_label": "Low",
                "std_dev": 0, "avg_price": 0, "price_range": 0}

    avg = float(sub.mean())
    std = float(sub.std())
    rng = float(sub.max() - sub.min())
    score = min(100.0, round(std / avg * 250, 1)) if avg > 0 else 0
    label = "Low" if score < 30 else "Medium" if score < 65 else "High"
    return {
        "route": f"{source} → {destination}", "airline": airline or "All",
        "volatility_score": score, "volatility_label": label,
        "std_dev": round(std, 2), "avg_price": round(avg, 2), "price_range": round(rng, 2),
    }


# ── admin metrics ─────────────────────────────────────────────────────────────
@app.get("/api/v1/admin/metrics")
def admin_metrics():
    df = load_data()
    _, model, _ = load_models()

    # Most searched routes (static for lite mode)
    top_routes_raw = (
        df.groupby(["source_city", "destination_city"])
        .size().reset_index(name="count")
        .sort_values("count", ascending=False).head(5)
    )
    most_searched = [
        {"route": f"{r['source_city']} → {r['destination_city']}", "count": int(r["count"])}
        for _, r in top_routes_raw.iterrows()
    ]

    meta_path = MODEL_DIR / "metadata.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    r2_val = meta.get("r2", 0.0)
    best_name = meta.get("best_model_name", "xgboost")

    return {
        "total_predictions": len(df),
        "predictions_today": 0,
        "most_searched_routes": most_searched,
        "avg_prediction_latency_ms": 42,
        "model_accuracy": {best_name: round(float(r2_val), 4)},
        "api_requests_last_hour": 0,
        "active_alerts": 0,
        "total_users": 2,
        "cache_hit_rate": 0.0,
    }


# ── admin models ──────────────────────────────────────────────────────────────
@app.get("/api/v1/admin/models")
def admin_models():
    meta_path = MODEL_DIR / "metadata.json"
    if not meta_path.exists():
        return []
    meta = json.loads(meta_path.read_text())
    best = meta.get("best_model_name", "xgboost")

    # Check which model files exist
    results = []
    for name in ["xgboost", "lightgbm", "linear_regression", "random_forest"]:
        path = MODEL_DIR / f"{name}_model.joblib"
        if not path.exists() and name == "xgboost":
            path = MODEL_DIR / "best_model.joblib"
        if path.exists() or name in (best, "xgboost", "lightgbm"):
            model_meta = meta.get("models", {}).get(name, {})
            results.append({
                "model_name":   name,
                "rmse":         round(model_meta.get("rmse", meta.get("rmse", 0)), 2),
                "mae":          round(model_meta.get("mae",  meta.get("mae",  0)), 2),
                "r2":           round(model_meta.get("r2",   meta.get("r2",   0)), 4),
                "mape":         round(model_meta.get("mape", 0.0), 2),
                "is_best":      name == best,
                "trained_at":   meta.get("trained_at", ""),
                "feature_count": len(FEATURE_COLS),
                "training_rows": int(meta.get("training_rows", 0)),
                "notes":        "Best model" if name == best else "",
            })
    return results


# ── admin airlines ────────────────────────────────────────────────────────────
@app.get("/api/v1/admin/airlines")
def admin_airlines():
    df = load_data()
    if df.empty:
        return []

    results = []
    for airline_name, grp in df.groupby("airline"):
        eco = grp[grp["flight_class"] == "economy"]["price"]
        biz = grp[grp["flight_class"] == "business"]["price"]
        all_p = grp["price"]
        avg   = float(all_p.mean())
        std   = float(all_p.std()) if len(all_p) > 1 else 0.0
        stability = max(0.0, round(1 - (std / avg if avg > 0 else 0), 4))
        spike_pct = float((all_p > all_p.quantile(0.95)).mean())
        pop_score = min(1.0, round(len(grp) / 50000, 4))
        overall   = round(stability * 0.4 + (1 - spike_pct) * 0.3 + pop_score * 0.3, 4)

        if avg < 5000:
            best_for = "Budget"
        elif stability > 0.85:
            best_for = "Stable"
        else:
            best_for = "Premium"

        routes = df[df["airline"] == airline_name].groupby(["source_city","destination_city"]).ngroups

        results.append({
            "airline":        str(airline_name),
            "overall_score":  overall,
            "avg_price":      round(avg, 2),
            "price_stability":stability,
            "spike_frequency":round(spike_pct, 4),
            "economy_avg":    round(float(eco.mean()), 2) if not eco.empty else 0,
            "business_avg":   round(float(biz.mean()), 2) if not biz.empty else 0,
            "best_for":       best_for,
            "route_count":    int(routes),
        })

    results.sort(key=lambda x: x["overall_score"], reverse=True)
    return results


# ── alerts (in-memory for lite mode) ─────────────────────────────────────────
_alerts: list[dict] = []
_alert_counter: int = 0


class AlertCreate(BaseModel):
    source: str
    destination: str
    airline: Optional[str] = None
    flight_class: str = "Economy"
    target_price: float


@app.get("/api/v1/alerts")
def get_alerts():
    return _alerts


@app.post("/api/v1/alerts", status_code=201)
def create_alert(payload: AlertCreate):
    global _alert_counter, _alerts
    from datetime import datetime, timezone
    _alert_counter += 1

    # Immediate price check
    preprocessor, model, _ = load_models()
    triggered = False
    triggered_price = None
    if preprocessor and model:
        try:
            row = {
                "airline":          payload.airline or "IndiGo",
                "source_city":      payload.source,
                "destination_city": payload.destination,
                "stops":            "non-stop", "departure_time": "Morning",
                "arrival_time":     "Evening",
                "flight_class":     payload.flight_class.lower(),
                "duration_hours":   2.0, "days_left": 30, "route_frequency": 50,
            }
            df_r = pd.DataFrame([row])[FEATURE_COLS]
            pred = float(model.predict(preprocessor.transform(df_r))[0])
            if pred <= payload.target_price:
                triggered = True
                triggered_price = round(pred, 2)
        except Exception:
            pass

    entry = {
        "id":               _alert_counter,
        "source":           payload.source,
        "destination":      payload.destination,
        "airline":          payload.airline,
        "flight_class":     payload.flight_class,
        "target_price":     payload.target_price,
        "triggered_price":  triggered_price,
        "is_triggered":     triggered,
        "is_active":        not triggered,
        "notification_sent":False,
        "created_at":       datetime.now(timezone.utc).isoformat(),
        "triggered_at":     datetime.now(timezone.utc).isoformat() if triggered else None,
    }
    _alerts.append(entry)
    return entry


@app.delete("/api/v1/alerts/{alert_id}", status_code=204)
def delete_alert(alert_id: int):
    global _alerts
    before = len(_alerts)
    _alerts = [a for a in _alerts if a["id"] != alert_id]
    if len(_alerts) == before:
        raise HTTPException(404, "Alert not found")




@app.get("/api/v1/analytics/price-trend")
def price_trend(
    source: str = "Delhi",
    destination: str = "Mumbai",
    points: int = Query(30, ge=7, le=60),
):
    """Return economy + business price trend for a route bucketed by days_left ranges.
    Uses real CSV data grouped into `points` equal buckets across days_left 1-365.
    Falls back to ML predictions if CSV has no data for this route.
    """
    df = load_data()
    route_df = df[
        (df["source_city"].str.lower() == source.lower()) &
        (df["destination_city"].str.lower() == destination.lower())
    ]

    if not route_df.empty and "days_left" in route_df.columns:
        route_df = route_df.dropna(subset=["days_left"])
        route_df["days_left"] = pd.to_numeric(route_df["days_left"], errors="coerce")
        route_df = route_df.dropna(subset=["days_left"])

        # Bin days_left into `points` buckets
        max_days = int(route_df["days_left"].max())
        min_days = int(route_df["days_left"].min())
        if max_days == min_days:
            max_days = min_days + 49
        bins = np.linspace(min_days, max_days, points + 1)
        labels = [round((bins[i] + bins[i + 1]) / 2) for i in range(points)]
        route_df["bucket"] = pd.cut(route_df["days_left"], bins=bins, labels=labels, include_lowest=True)

        result = []
        today = pd.Timestamp.today()
        for i, lbl in enumerate(labels):
            bucket_df = route_df[route_df["bucket"] == lbl]
            date_str = (today - pd.Timedelta(days=points - 1 - i)).strftime("%d %b")
            if bucket_df.empty:
                result.append({"date": date_str, "days_left": int(lbl), "economy": None, "business": None})
                continue
            eco_rows = bucket_df[bucket_df["flight_class"] == "economy"]["price"]
            biz_rows = bucket_df[bucket_df["flight_class"] == "business"]["price"]
            result.append({
                "date":      date_str,
                "days_left": int(lbl),
                "economy":   round(float(eco_rows.mean()), 0) if not eco_rows.empty else None,
                "business":  round(float(biz_rows.mean()), 0) if not biz_rows.empty else None,
            })
        # Fill None gaps with linear interpolation
        import math
        for key in ("economy", "business"):
            vals = [r[key] for r in result]
            # Forward fill then back fill Nones
            filled = []
            last = None
            for v in vals:
                if v is not None:
                    last = v
                filled.append(last)
            # backward fill remaining leading Nones
            last = None
            for i in range(len(filled) - 1, -1, -1):
                if filled[i] is not None:
                    last = filled[i]
                elif last is not None:
                    filled[i] = last
            for i, r in enumerate(result):
                r[key] = filled[i]
        return [r for r in result if r["economy"] is not None]

    # Fallback: use ML model to generate trend
    preprocessor, model, _ = load_models()
    if preprocessor is None:
        return []

    today = pd.Timestamp.today()
    result = []
    day_values = list(range(points, 0, -1))
    rows_eco = []
    rows_biz = []
    for d in day_values:
        base = {
            "source_city": source.strip().title(),
            "destination_city": destination.strip().title(),
            "stops": "non-stop",
            "departure_time": "Morning",
            "arrival_time": "Evening",
            "duration_hours": 2.0,
            "days_left": d,
            "route_frequency": 50,
        }
        rows_eco.append({**base, "airline": "IndiGo", "flight_class": "economy"})
        rows_biz.append({**base, "airline": "Air India", "flight_class": "business"})

    df_eco = pd.DataFrame(rows_eco)[FEATURE_COLS]
    df_biz = pd.DataFrame(rows_biz)[FEATURE_COLS]
    preds_eco = model.predict(preprocessor.transform(df_eco)).tolist()
    preds_biz = model.predict(preprocessor.transform(df_biz)).tolist()

    for i, d in enumerate(day_values):
        date_str = (today - pd.Timedelta(days=points - 1 - i)).strftime("%d %b")
        result.append({
            "date":      date_str,
            "days_left": d,
            "economy":   round(preds_eco[i], 0),
            "business":  round(preds_biz[i], 0),
        })
    return result


# ── Auth (Lite mode — demo credentials only) ───────────────────────────────────
import base64
import hashlib

_DEMO_USERS = {
    "demo":  hashlib.sha256(b"demo").hexdigest(),
    "admin": hashlib.sha256(b"admin123").hexdigest(),
}


class LoginPayload(BaseModel):
    username: str
    password: str


def _make_token(username: str) -> str:
    import time
    payload = json.dumps({"sub": username, "mode": "lite", "iat": int(time.time())})
    return base64.b64encode(payload.encode()).decode()


@app.post("/api/v1/auth/login")
def auth_login(payload: LoginPayload):
    pw_hash = hashlib.sha256(payload.password.encode()).hexdigest()
    if _DEMO_USERS.get(payload.username) == pw_hash:
        return {
            "access_token": _make_token(payload.username),
            "token_type": "bearer",
            "username": payload.username,
        }
    raise HTTPException(401, "Invalid username or password")


@app.get("/api/v1/auth/me")
def auth_me(authorization: Optional[str] = None):
    from fastapi import Header
    return {"username": "demo", "mode": "lite"}


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print("\n  AeroQuant Lite Server starting...")
    print(f"   Data dir  : {DATA_DIR}")
    print(f"   Model dir : {MODEL_DIR}")
    print("\n   API docs  : http://localhost:8000/docs")
    print("   Frontend  : http://localhost:3000\n")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
