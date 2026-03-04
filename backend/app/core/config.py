from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── App ──────────────────────────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # ── Security ─────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change_me_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost",
        "https://aeroquant.io",
    ]

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://aeroquant:aeroquant_secret@localhost:5432/aeroquant_db"

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://:redis_secret@localhost:6379/0"
    CACHE_TTL: int = 300  # 5 minutes

    # ── AWS ───────────────────────────────────────────────────────────────────
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET: str = "aeroquant-models"

    # ── ML ────────────────────────────────────────────────────────────────────
    MODEL_DIR: str = "ml/saved_models"
    DATA_DIR: str = "data"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
