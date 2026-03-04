"""
AeroQuant ML Training Pipeline
================================
Trains LinearRegression + RandomForest + XGBoost + LightGBM price regressors
on Clean_Dataset.csv, economy.csv, and business.csv.
Saves the best model and all benchmark metrics to disk.

Usage:
    python -m ml.train --data-dir /app/data --model-dir /app/ml/saved_models
"""
from __future__ import annotations

import argparse
import json
import os
import warnings
from pathlib import Path
from typing import Tuple

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as _np_metrics
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler

warnings.filterwarnings("ignore")

# ─── Constants ────────────────────────────────────────────────────────────────
SEED = 42
CATEGORICAL_COLS = ["airline", "source_city", "destination_city", "stops", "departure_time", "arrival_time", "flight_class"]
NUMERICAL_COLS = ["duration_hours", "days_left"]
TARGET_COL = "price"

CITY_ORDER = ["Delhi", "Mumbai", "Bangalore", "Hyderabad", "Kolkata", "Chennai"]
TIME_ORDER = ["Early_Morning", "Morning", "Afternoon", "Evening", "Night", "Late_Night"]


# ─── Data Loading ─────────────────────────────────────────────────────────────
def load_clean_dataset(data_dir: Path) -> pd.DataFrame:
    path = data_dir / "Clean_Dataset.csv"
    df = pd.read_csv(path)
    df.columns = df.columns.str.strip()
    df["flight_class"] = df["class"].str.strip().str.lower()
    df = df.rename(columns={
        "source_city": "source_city",
        "destination_city": "destination_city",
        "departure_time": "departure_time",
        "arrival_time": "arrival_time",
        "stops": "stops",
        "duration": "duration_str",
        "days_left": "days_left",
        "price": "price",
        "airline": "airline",
    })
    return df


def load_economy_csv(data_dir: Path) -> pd.DataFrame:
    path = data_dir / "economy.csv"
    if not path.exists():
        return pd.DataFrame()
    df = pd.read_csv(path)
    df.columns = df.columns.str.strip()
    df["flight_class"] = "economy"

    def parse_price(p):
        try:
            return float(str(p).replace(",", "").strip())
        except Exception:
            return np.nan

    df["price"] = df["price"].apply(parse_price)
    return df


def load_business_csv(data_dir: Path) -> pd.DataFrame:
    path = data_dir / "business.csv"
    if not path.exists():
        return pd.DataFrame()
    df = pd.read_csv(path)
    df.columns = df.columns.str.strip()
    df["flight_class"] = "business"

    def parse_price(p):
        try:
            return float(str(p).replace(",", "").strip())
        except Exception:
            return np.nan

    df["price"] = df["price"].apply(parse_price)
    return df


# ─── Feature Engineering ──────────────────────────────────────────────────────
def parse_duration(duration_str: str) -> float:
    """Convert '2h 15m' → 2.25 hours."""
    try:
        parts = str(duration_str).lower().replace("h", " ").replace("m", " ").split()
        hours = int(parts[0]) if len(parts) > 0 else 0
        minutes = int(parts[1]) if len(parts) > 1 else 0
        return hours + minutes / 60.0
    except Exception:
        return np.nan


def extract_time_block(time_str: str) -> str:
    """Map HH:MM → time-of-day block."""
    try:
        h = int(str(time_str).split(":")[0])
        if h < 6:
            return "Early_Morning"
        elif h < 12:
            return "Morning"
        elif h < 16:
            return "Afternoon"
        elif h < 20:
            return "Evening"
        elif h < 23:
            return "Night"
        else:
            return "Late_Night"
    except Exception:
        return "Morning"


def normalize_stops(stops: str) -> str:
    s = str(stops).strip().lower()
    if "non" in s or "0" in s:
        return "non-stop"
    elif "1" in s:
        return "1-stop"
    else:
        return "2+-stop"


def feature_engineer_clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "duration_str" in df.columns:
        df["duration_hours"] = df["duration_str"].apply(parse_duration)
    elif "time_taken" in df.columns:
        df["duration_hours"] = df["time_taken"].apply(parse_duration)
    else:
        df["duration_hours"] = 2.0

    # ── days_left: derive from days_left col or set default ──────────────────
    if "days_left" not in df.columns:
        df["days_left"] = 30

    # ── normalize stops ───────────────────────────────────────────────────────
    if "stops" not in df.columns and "stop" in df.columns:
        df["stops"] = df["stop"].apply(normalize_stops)
    else:
        df["stops"] = df.get("stops", pd.Series(["non-stop"] * len(df))).apply(normalize_stops)

    # ── city normalization ────────────────────────────────────────────────────
    if "from" in df.columns:
        df["source_city"] = df["from"].str.strip()
    if "to" in df.columns:
        df["destination_city"] = df["to"].str.strip()

    # ── time blocks ───────────────────────────────────────────────────────────
    if "departure_time" not in df.columns and "dep_time" in df.columns:
        df["departure_time"] = df["dep_time"].apply(extract_time_block)
    elif "departure_time" in df.columns:
        pass  # already a block label in Clean_Dataset
    else:
        df["departure_time"] = "Morning"

    if "arrival_time" not in df.columns and "arr_time" in df.columns:
        df["arrival_time"] = df["arr_time"].apply(extract_time_block)
    else:
        df["arrival_time"] = df.get("arrival_time", "Evening")

    # ── route frequency (popularity feature) ─────────────────────────────────
    if "source_city" in df.columns and "destination_city" in df.columns:
        route_freq = (
            df.groupby(["source_city", "destination_city"])
            .size()
            .rename("route_frequency")
        )
        df = df.join(route_freq, on=["source_city", "destination_city"])
    else:
        df["route_frequency"] = 1

    df["airline"] = df["airline"].str.strip()
    df["flight_class"] = df["flight_class"].str.strip().str.lower()

    # ── drop NaN targets ──────────────────────────────────────────────────────
    df = df.dropna(subset=["price"])
    df = df[df["price"] > 0]

    return df


# ─── Build Feature Matrix ─────────────────────────────────────────────────────
FEATURE_COLS = [
    "airline", "source_city", "destination_city", "stops",
    "departure_time", "arrival_time", "flight_class",
    "duration_hours", "days_left", "route_frequency",
]


def build_features(df: pd.DataFrame):
    df = df.copy()
    for col in FEATURE_COLS:
        if col not in df.columns:
            df[col] = "Unknown" if df[col].dtype == object else 0
    X = df[FEATURE_COLS].copy()
    y = df[TARGET_COL].values
    return X, y


# ─── Preprocessing Pipelines ─────────────────────────────────────────────────
CAT_COLS = ["airline", "source_city", "destination_city", "stops",
            "departure_time", "arrival_time", "flight_class"]
NUM_COLS = ["duration_hours", "days_left", "route_frequency"]


def build_preprocessor():
    cat_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
    ])
    num_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])
    return ColumnTransformer([
        ("cat", cat_pipeline, CAT_COLS),
        ("num", num_pipeline, NUM_COLS),
    ])


# ─── Model Training ───────────────────────────────────────────────────────────
def train_xgboost(X_train, y_train, X_val, y_val):
    model = xgb.XGBRegressor(
        n_estimators=500,
        learning_rate=0.05,
        max_depth=8,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=SEED,
        n_jobs=-1,
        eval_metric="rmse",
        early_stopping_rounds=30,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )
    return model


def train_lightgbm(X_train, y_train, X_val, y_val):
    model = lgb.LGBMRegressor(
        n_estimators=500,
        learning_rate=0.05,
        num_leaves=63,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=SEED,
        n_jobs=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        callbacks=[lgb.early_stopping(30, verbose=False), lgb.log_evaluation(-1)],
    )
    return model


def evaluate(model, X_test, y_test, name: str) -> dict:
    preds = model.predict(X_test)
    rmse = float(_np_metrics.sqrt(mean_squared_error(y_test, preds)))
    mae = float(mean_absolute_error(y_test, preds))
    r2 = float(r2_score(y_test, preds))
    # MAPE — avoid division by zero
    mask = y_test != 0
    mape = float(np.mean(np.abs((y_test[mask] - preds[mask]) / y_test[mask])) * 100) if mask.any() else 0.0
    print(f"\n[{name}]  RMSE={rmse:.2f}  MAE={mae:.2f}  R²={r2:.4f}  MAPE={mape:.2f}%")
    return {"model": name, "rmse": rmse, "mae": mae, "r2": r2, "mape": mape}


def train_linear_regression(X_train, y_train):
    model = LinearRegression(n_jobs=-1)
    model.fit(X_train, y_train)
    return model


def train_random_forest(X_train, y_train, X_val, y_val):
    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=4,
        random_state=SEED,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    return model


# ─── Main ─────────────────────────────────────────────────────────────────────
def main(data_dir: str, model_dir: str):
    data_path = Path(data_dir)
    model_path = Path(model_dir)
    model_path.mkdir(parents=True, exist_ok=True)

    print("Loading datasets …")
    frames = []

    # Clean_Dataset is the primary rich dataset
    clean = load_clean_dataset(data_path)
    clean = feature_engineer_clean(clean)
    frames.append(clean)

    econ = load_economy_csv(data_path)
    if not econ.empty:
        econ = feature_engineer_clean(econ)
        frames.append(econ)

    biz = load_business_csv(data_path)
    if not biz.empty:
        biz = feature_engineer_clean(biz)
        frames.append(biz)

    df = pd.concat(frames, ignore_index=True)
    print(f"Total samples: {len(df)}")

    X, y = build_features(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=SEED
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_train, y_train, test_size=0.15, random_state=SEED
    )

    print(f"Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}")

    # Fit preprocessor
    preprocessor = build_preprocessor()
    X_train_t = preprocessor.fit_transform(X_train)
    X_val_t = preprocessor.transform(X_val)
    X_test_t = preprocessor.transform(X_test)

    print("\nTraining Linear Regression …")
    lr_model = train_linear_regression(X_train_t, y_train)
    lr_metrics = evaluate(lr_model, X_test_t, y_test, "LinearRegression")

    print("Training Random Forest …")
    rf_model = train_random_forest(X_train_t, y_train, X_val_t, y_val)
    rf_metrics = evaluate(rf_model, X_test_t, y_test, "RandomForest")

    print("\nTraining XGBoost …")
    xgb_model = train_xgboost(X_train_t, y_train, X_val_t, y_val)
    xgb_metrics = evaluate(xgb_model, X_test_t, y_test, "XGBoost")

    print("Training LightGBM …")
    lgb_model = train_lightgbm(X_train_t, y_train, X_val_t, y_val)
    lgb_metrics = evaluate(lgb_model, X_test_t, y_test, "LightGBM")

    all_metrics = [lr_metrics, rf_metrics, xgb_metrics, lgb_metrics]
    best_m = min(all_metrics, key=lambda m: m["rmse"])
    best_name = best_m["model"].lower().replace(" ", "_")

    model_map = {
        "linearregression": lr_model,
        "randomforest": rf_model,
        "xgboost": xgb_model,
        "lightgbm": lgb_model,
    }
    best_model = model_map.get(best_name, xgb_model)
    print(f"\nBest model: {best_name.upper()}  (RMSE={best_m['rmse']:.2f})")

    # ── Save artefacts ────────────────────────────────────────────────────────
    joblib.dump(preprocessor, model_path / "preprocessor.joblib")
    joblib.dump(xgb_model, model_path / "xgboost_model.joblib")
    joblib.dump(lgb_model, model_path / "lightgbm_model.joblib")
    joblib.dump(rf_model, model_path / "randomforest_model.joblib")
    joblib.dump(lr_model, model_path / "linearregression_model.joblib")
    joblib.dump(best_model, model_path / "best_model.joblib")

    # Save feature metadata
    meta = {
        "best_model_name": best_name,
        "feature_cols": FEATURE_COLS,
        "cat_cols": CAT_COLS,
        "num_cols": NUM_COLS,
        "metrics": {
            "linear_regression": lr_metrics,
            "random_forest": rf_metrics,
            "xgboost": xgb_metrics,
            "lightgbm": lgb_metrics,
            "best": best_m,
        },
        "unique_airlines": sorted(df["airline"].dropna().unique().tolist()),
        "unique_sources": sorted(df["source_city"].dropna().unique().tolist()),
        "unique_destinations": sorted(df["destination_city"].dropna().unique().tolist()),
    }
    with open(model_path / "metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\nAll artefacts saved to: {model_path}")
    print("=" * 60)
    for m in all_metrics:
        marker = " ← BEST" if m["model"].lower().replace(" ", "_") == best_name else ""
        print(f"  {m['model']:22s}  RMSE={m['rmse']:8.2f}  R²={m['r2']:.4f}{marker}")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AeroQuant ML Training Pipeline")
    parser.add_argument("--data-dir", default="data", help="Directory containing CSV datasets")
    parser.add_argument("--model-dir", default="ml/saved_models", help="Where to save trained models")
    args = parser.parse_args()
    main(args.data_dir, args.model_dir)
