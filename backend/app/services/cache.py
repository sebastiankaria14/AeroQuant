from __future__ import annotations

import json
from typing import Any, Optional

import redis.asyncio as aioredis
import structlog

from app.core.config import settings

log = structlog.get_logger()
_redis: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis


async def cache_get(key: str) -> Optional[Any]:
    try:
        r = await get_redis()
        value = await r.get(key)
        if value:
            return json.loads(value)
    except Exception as exc:
        log.warning("cache_get_failed", key=key, error=str(exc))
    return None


async def cache_set(key: str, value: Any, ttl: int = settings.CACHE_TTL) -> None:
    try:
        r = await get_redis()
        await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception as exc:
        log.warning("cache_set_failed", key=key, error=str(exc))


async def cache_delete(key: str) -> None:
    try:
        r = await get_redis()
        await r.delete(key)
    except Exception as exc:
        log.warning("cache_delete_failed", key=key, error=str(exc))
