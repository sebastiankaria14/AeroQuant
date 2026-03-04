from __future__ import annotations

import time
import uuid

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.routes import analytics, auth, compare, forecast, predict, routes, watchlist, explain, admin, alerts
from app.core.config import settings
from app.core.logging import configure_logging
from app.db.session import init_db

configure_logging()
log = structlog.get_logger()

# ─── Rate Limiter ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ─── App Factory ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="AeroQuant Pro API",
    description="Flight Price Intelligence Platform — powered by ML",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    default_response_class=ORJSONResponse,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Middleware ───────────────────────────────────────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next) -> Response:
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = f"{duration:.4f}s"
    log.info(
        "request_completed",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration=round(duration, 4),
    )
    return response


# ─── Prometheus Metrics ───────────────────────────────────────────────────────
Instrumentator().instrument(app).expose(app, endpoint="/api/metrics")

# ─── Routers ──────────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX + "/auth", tags=["Authentication"])
app.include_router(predict.router, prefix=API_PREFIX, tags=["Prediction"])
app.include_router(routes.router, prefix=API_PREFIX, tags=["Routes"])
app.include_router(analytics.router, prefix=API_PREFIX + "/analytics", tags=["Analytics"])
app.include_router(compare.router, prefix=API_PREFIX, tags=["Compare"])
app.include_router(watchlist.router, prefix=API_PREFIX + "/watchlist", tags=["Watchlist"])
app.include_router(forecast.router, prefix=API_PREFIX, tags=["Forecast"])
app.include_router(explain.router, prefix=API_PREFIX, tags=["Explainability"])
app.include_router(admin.router, prefix=API_PREFIX, tags=["Admin"])
app.include_router(alerts.router, prefix=API_PREFIX, tags=["Alerts"])


# ─── Lifecycle ────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup() -> None:
    log.info("aeroquant_starting", environment=settings.ENVIRONMENT)
    await init_db()
    log.info("database_initialized")


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": "AeroQuant Pro API", "version": "2.0.0"}
