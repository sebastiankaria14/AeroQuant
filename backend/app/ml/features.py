"""Shared feature-engineering helpers used by both training and inference."""
from __future__ import annotations

import numpy as np

FEATURE_COLS = [
    "airline", "source_city", "destination_city", "stops",
    "departure_time", "arrival_time", "flight_class",
    "duration_hours", "days_left", "route_frequency",
]

CAT_COLS = ["airline", "source_city", "destination_city", "stops",
            "departure_time", "arrival_time", "flight_class"]
NUM_COLS = ["duration_hours", "days_left", "route_frequency"]


def extract_time_block(time_str: str) -> str:
    """Map HH:MM → labelled time-of-day block (matches training vocabulary)."""
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
    if "non" in s or s == "0":
        return "non-stop"
    elif "1" in s:
        return "1-stop"
    else:
        return "2+-stop"


def parse_duration(duration_str: str) -> float:
    """Convert '2h 15m' or '2:15' → decimal hours."""
    try:
        parts = str(duration_str).lower().replace("h", " ").replace("m", " ").split()
        hours = int(parts[0]) if len(parts) > 0 else 0
        minutes = int(parts[1]) if len(parts) > 1 else 0
        return hours + minutes / 60.0
    except Exception:
        return np.nan
