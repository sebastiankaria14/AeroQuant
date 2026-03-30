"""
AeroQuant Predictor
====================
Loads trained models and produces price predictions with:
- Confidence intervals via dual-model spread
- SHAP explainability
- Buy/Wait recommendation engine
- Volatility scoring
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

from app.core.config import settings
from app.ml.features import FEATURE_COLS, extract_time_block

# ── Optional SHAP import ──────────────────────────────────────────────────────
try:
    import shap as _shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False


# ── Volatility thresholds ─────────────────────────────────────────────────────
def _volatility_label(score: float) -> str:
    if score <= 30:
        return "Stable"
    elif score <= 60:
        return "Moderate"
    return "Highly Volatile"


def _compute_volatility(std_dev: float, avg_price: float) -> float:
    """Normalise coefficient of variation to 0-100 scale."""
    if avg_price <= 0:
        return 0.0
    cv = (std_dev / avg_price) * 100
    return round(min(cv * 2.5, 100.0), 2)  # scale: CV of 40% → score 100


class Predictor:
    def __init__(self, model_dir: str = settings.MODEL_DIR):
        self.model_dir = Path(model_dir)
        self.preprocessor = None
        self.model = None
        self.secondary_model = None
        self.meta: dict = {}
        self.model_name: str = "xgboost"
        self._shap_explainer = None
        self._models_loaded = False

    def _ensure_models_loaded(self) -> None:
        if self._models_loaded:
            return

        model_path = self.model_dir
        self.preprocessor = joblib.load(model_path / "preprocessor.joblib")
        self.model = joblib.load(model_path / "best_model.joblib")

        with open(model_path / "metadata.json") as f:
            self.meta = json.load(f)

        self.model_name = self.meta.get("best_model_name", "xgboost")
        secondary_name = "lightgbm" if self.model_name == "xgboost" else "xgboost"
        secondary_path = model_path / f"{secondary_name}_model.joblib"
        self.secondary_model = joblib.load(secondary_path) if secondary_path.exists() else self.model

        if SHAP_AVAILABLE:
            try:
                self._shap_explainer = _shap.TreeExplainer(self.model)
            except Exception:
                self._shap_explainer = None

        self._models_loaded = True

    # ── Helpers ───────────────────────────────────────────────────────────────
    def time_to_block(self, time_str: str) -> str:
        return extract_time_block(time_str)

    def _build_row(self, payload) -> dict:
        dep_block = extract_time_block(payload.dep_time)
        return {
            "airline": payload.airline,
            "source_city": payload.source,
            "destination_city": payload.destination,
            "stops": payload.stops,
            "departure_time": dep_block,
            "arrival_time": "Evening",
            "flight_class": payload.flight_class,
            "duration_hours": 2.0,
            "days_left": payload.days_until_departure,
            "route_frequency": 50,
        }

    def _raw_predict(self, row: dict) -> tuple[float, float]:
        """Return (primary_pred, secondary_pred)."""
        self._ensure_models_loaded()
        assert self.preprocessor is not None
        assert self.model is not None
        assert self.secondary_model is not None
        df = pd.DataFrame([row])[FEATURE_COLS]
        X = self.preprocessor.transform(df)
        return float(self.model.predict(X)[0]), float(self.secondary_model.predict(X)[0])

    # ── SHAP ──────────────────────────────────────────────────────────────────
    def explain(self, payload) -> "ExplainOutput":
        from app.schemas.schemas import ExplainOutput, ShapFeature

        self._ensure_models_loaded()
        assert self.preprocessor is not None

        row = self._build_row(payload)
        df = pd.DataFrame([row])[FEATURE_COLS]
        X = self.preprocessor.transform(df)
        primary_pred, _ = self._raw_predict(row)

        top_features: list[ShapFeature] = []
        base_value = primary_pred * 0.5  # fallback
        summary = "Prediction based on ML model analysis."

        if self._shap_explainer is not None:
            try:
                shap_vals = self._shap_explainer.shap_values(X)
                if isinstance(shap_vals, list):
                    shap_vals = shap_vals[0]
                vals = shap_vals[0]
                base_value = float(self._shap_explainer.expected_value
                                   if not isinstance(self._shap_explainer.expected_value, list)
                                   else self._shap_explainer.expected_value[0])
                sorted_idx = np.argsort(np.abs(vals))[::-1]
                feature_names = FEATURE_COLS
                for idx in sorted_idx[:5]:
                    fname = feature_names[idx]
                    sval = float(vals[idx])
                    top_features.append(
                        ShapFeature(
                            feature=fname.replace("_", " ").title(),
                            value=row[fname],
                            shap_value=round(sval, 2),
                            direction="positive" if sval > 0 else "negative",
                        )
                    )
                top3 = top_features[:3]
                parts = [f"{f.feature} ({'+' if f.shap_value >= 0 else ''}₹{f.shap_value:.0f})" for f in top3]
                summary = f"Top drivers: {', '.join(parts)}."
            except Exception:
                pass

        if not top_features:
            # Fallback – heuristic feature importance
            for fname, fval in [("Days Left", row["days_left"]), ("Airline", row["airline"]), ("Stops", row["stops"])]:
                top_features.append(ShapFeature(feature=fname, value=fval, shap_value=0.0, direction="positive"))

        return ExplainOutput(
            predicted_price=round(primary_pred, 2),
            base_value=round(base_value, 2),
            top_features=top_features,
            summary=summary,
        )

    # ── Buy / Wait Engine ─────────────────────────────────────────────────────
    def buy_wait(self, payload, primary_pred: float, secondary_pred: float) -> "BuyWaitRecommendation":
        from app.schemas.schemas import BuyWaitRecommendation

        days = payload.days_until_departure
        # Simulate future prices using a simple decay/growth heuristic
        # (In production, use Prophet forecast; here we use polynomial approx)
        def future_price(offset_days: int) -> float:
            future_days = max(days - offset_days, 0)
            # Price generally increases as departure nears, with a knee around 14 days
            ratio = 1.0
            if future_days < 7:
                ratio = 1.18
            elif future_days < 14:
                ratio = 1.10
            elif future_days < 21:
                ratio = 1.05
            elif future_days < 30:
                ratio = 1.02
            return round(primary_pred * ratio, 2)

        spread = abs(primary_pred - secondary_pred)
        ci_half = max(spread * 1.5, primary_pred * 0.08)
        std_dev_est = ci_half / 1.96
        volatility = _compute_volatility(std_dev_est, primary_pred)

        # Market average from secondary model blend
        market_avg = round((primary_pred + secondary_pred) / 2, 2)
        # Fair price: slight discount from market
        fair_price = round(market_avg * 0.97, 2)
        price_diff_pct = round((primary_pred - fair_price) / fair_price * 100, 2)

        p5 = future_price(5)
        p10 = future_price(10)
        p30 = future_price(30)

        # Decision logic
        if days < 5:
            rec = "BUY_NOW"
            conf = 0.92
            reason = "Departure is imminent — prices spike in the last 5 days. Buy now."
        elif price_diff_pct < -5:
            rec = "BUY_NOW"
            conf = 0.85
            reason = f"Price is {abs(price_diff_pct):.1f}% below fair value — strong buying opportunity."
        elif volatility > 60 and price_diff_pct > 5:
            rec = "WAIT"
            conf = 0.75
            reason = f"High volatility route. Price is {price_diff_pct:.1f}% above fair value — likely to dip."
        elif p10 < primary_pred * 0.97:
            rec = "WAIT"
            conf = 0.70
            reason = "Our 10-day forecast suggests prices will drop by ~3%. Consider waiting."
        else:
            rec = "NEUTRAL"
            conf = 0.60
            reason = "Price is near fair value. Booking now vs. waiting has minimal expected difference."

        return BuyWaitRecommendation(
            recommendation=rec,
            confidence_score=round(conf, 2),
            fair_price=fair_price,
            market_avg=market_avg,
            price_diff_pct=price_diff_pct,
            volatility_score=volatility,
            volatility_label=_volatility_label(volatility),
            price_in_5d=p5,
            price_in_10d=p10,
            price_in_30d=p30,
            reasoning=reason,
        )

    # ── Main predict (v1 – backwards-compat) ─────────────────────────────────
    def predict(self, payload) -> "PredictionOutput":
        from app.schemas.schemas import PredictionOutput

        row = self._build_row(payload)
        primary_pred, secondary_pred = self._raw_predict(row)
        spread = abs(primary_pred - secondary_pred)
        ci_half = max(spread * 1.5, primary_pred * 0.08)

        return PredictionOutput(
            predicted_price=round(primary_pred, 2),
            confidence_lower=round(max(0, primary_pred - ci_half), 2),
            confidence_upper=round(primary_pred + ci_half, 2),
            model_used=self.model_name,
            input_echo=payload,
        )

    # ── Enriched predict (v2) ─────────────────────────────────────────────────
    def predict_v2(self, payload) -> "PredictionOutputV2":
        from app.schemas.schemas import PredictionOutputV2

        row = self._build_row(payload)
        primary_pred, secondary_pred = self._raw_predict(row)
        spread = abs(primary_pred - secondary_pred)
        ci_half = max(spread * 1.5, primary_pred * 0.08)

        bw = self.buy_wait(payload, primary_pred, secondary_pred)
        exp = self.explain(payload)

        return PredictionOutputV2(
            predicted_price=round(primary_pred, 2),
            confidence_lower=round(max(0, primary_pred - ci_half), 2),
            confidence_upper=round(primary_pred + ci_half, 2),
            model_used=self.model_name,
            input_echo=payload,
            buy_wait=bw,
            explain=exp,
        )


@lru_cache(maxsize=1)
def get_predictor() -> Predictor:
    return Predictor()

