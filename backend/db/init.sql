-- ═══════════════════════════════════════════════════════════════════════════
-- AeroQuant Database Schema
-- PostgreSQL 16
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fuzzy search

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    username        VARCHAR(100) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- ─── Flight Routes (aggregated) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flight_routes (
    id               SERIAL PRIMARY KEY,
    source           VARCHAR(100) NOT NULL,
    destination      VARCHAR(100) NOT NULL,
    airline          VARCHAR(100) NOT NULL,
    flight_class     VARCHAR(20)  NOT NULL DEFAULT 'economy',
    stops            VARCHAR(50),
    avg_price        NUMERIC(12, 2),
    min_price        NUMERIC(12, 2),
    max_price        NUMERIC(12, 2),
    price_volatility NUMERIC(10, 6),
    sample_count     INTEGER DEFAULT 0,
    last_updated     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_route UNIQUE (source, destination, airline, flight_class)
);

CREATE INDEX IF NOT EXISTS idx_routes_source      ON flight_routes (source);
CREATE INDEX IF NOT EXISTS idx_routes_destination ON flight_routes (destination);
CREATE INDEX IF NOT EXISTS idx_routes_airline     ON flight_routes (airline);
CREATE INDEX IF NOT EXISTS idx_routes_class       ON flight_routes (flight_class);

-- ─── Price Records (time-series) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_records (
    id               SERIAL PRIMARY KEY,
    route_id         INTEGER NOT NULL REFERENCES flight_routes(id) ON DELETE CASCADE,
    price            NUMERIC(12, 2) NOT NULL,
    dep_time         VARCHAR(10),
    arr_time         VARCHAR(10),
    duration_minutes INTEGER,
    stops            VARCHAR(50),
    recorded_date    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pr_route_id     ON price_records (route_id);
CREATE INDEX IF NOT EXISTS idx_pr_recorded     ON price_records (recorded_date DESC);

-- ─── Watchlists ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlists (
    id              SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source          VARCHAR(100) NOT NULL,
    destination     VARCHAR(100) NOT NULL,
    airline         VARCHAR(100),
    flight_class    VARCHAR(20) NOT NULL DEFAULT 'economy',
    alert_price     NUMERIC(12, 2),
    is_alert_active BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_watchlist UNIQUE (user_id, source, destination, airline, flight_class)
);

CREATE INDEX IF NOT EXISTS idx_wl_user ON watchlists (user_id);

-- ─── Prediction History ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prediction_history (
    id                      SERIAL PRIMARY KEY,
    user_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
    airline                 VARCHAR(100) NOT NULL,
    source                  VARCHAR(100) NOT NULL,
    destination             VARCHAR(100) NOT NULL,
    stops                   VARCHAR(50)  NOT NULL,
    flight_class            VARCHAR(20)  NOT NULL,
    days_until_departure    INTEGER NOT NULL,
    dep_time_block          VARCHAR(20),
    predicted_price         NUMERIC(12, 2) NOT NULL,
    confidence_lower        NUMERIC(12, 2),
    confidence_upper        NUMERIC(12, 2),
    model_used              VARCHAR(50),
    -- v2 fields
    recommendation          VARCHAR(20),
    confidence_score        NUMERIC(5, 4),
    fair_price              NUMERIC(12, 2),
    market_avg              NUMERIC(12, 2),
    price_diff_pct          NUMERIC(8, 2),
    volatility_score        NUMERIC(5, 2),
    shap_values             JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ph_user       ON prediction_history (user_id);
CREATE INDEX IF NOT EXISTS idx_ph_created    ON prediction_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ph_route      ON prediction_history (source, destination);

-- ─── Airline Metrics ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS airline_metrics (
    id                  SERIAL PRIMARY KEY,
    airline             VARCHAR(100) NOT NULL UNIQUE,
    avg_price           NUMERIC(12, 2),
    price_stability     NUMERIC(6, 4),
    spike_frequency     NUMERIC(6, 4),
    popularity_score    NUMERIC(6, 4),
    overall_score       NUMERIC(6, 4),
    best_for            VARCHAR(50),
    economy_avg         NUMERIC(12, 2),
    business_avg        NUMERIC(12, 2),
    route_count         INTEGER DEFAULT 0,
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_am_score ON airline_metrics (overall_score DESC);

-- ─── Model Metrics ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_metrics (
    id              SERIAL PRIMARY KEY,
    model_name      VARCHAR(100) NOT NULL,
    rmse            NUMERIC(12, 4),
    mae             NUMERIC(12, 4),
    r2              NUMERIC(8, 6),
    mape            NUMERIC(8, 4),
    is_best         BOOLEAN DEFAULT FALSE,
    trained_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    feature_count   INTEGER,
    training_rows   INTEGER,
    notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_mm_trained ON model_metrics (trained_at DESC);
CREATE INDEX IF NOT EXISTS idx_mm_best    ON model_metrics (is_best);

-- ─── Forecast Cache ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forecast_cache (
    id              SERIAL PRIMARY KEY,
    cache_key       VARCHAR(64) NOT NULL UNIQUE,
    source          VARCHAR(100) NOT NULL,
    destination     VARCHAR(100) NOT NULL,
    airline         VARCHAR(100),
    flight_class    VARCHAR(20),
    forecast_json   JSONB NOT NULL,
    horizon_days    INTEGER NOT NULL DEFAULT 30,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fc_key        ON forecast_cache (cache_key);
CREATE INDEX IF NOT EXISTS idx_fc_computed   ON forecast_cache (computed_at DESC);

-- ─── Price Alerts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_alerts (
    id                  SERIAL PRIMARY KEY,
    user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
    watchlist_id        INTEGER REFERENCES watchlists(id) ON DELETE CASCADE,
    source              VARCHAR(100) NOT NULL,
    destination         VARCHAR(100) NOT NULL,
    airline             VARCHAR(100),
    flight_class        VARCHAR(20) NOT NULL DEFAULT 'Economy',
    target_price        NUMERIC(12, 2) NOT NULL,
    triggered_price     NUMERIC(12, 2),
    is_triggered        BOOLEAN DEFAULT FALSE,
    is_active           BOOLEAN DEFAULT TRUE,
    notification_sent   BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    triggered_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pa_user    ON price_alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_pa_active  ON price_alerts (is_active);
CREATE INDEX IF NOT EXISTS idx_pa_route   ON price_alerts (source, destination);

-- ─── Seed Demo User ───────────────────────────────────────────────────────────
-- Password: demo1234  (bcrypt hash)
INSERT INTO users (id, email, username, hashed_password, is_active, is_admin)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'demo@aeroquant.io',
    'demo',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    TRUE,
    FALSE
)
ON CONFLICT (id) DO NOTHING;

-- Admin user
INSERT INTO users (id, email, username, hashed_password, is_active, is_admin)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'admin@aeroquant.io',
    'admin',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    TRUE,
    TRUE
)
ON CONFLICT (id) DO NOTHING;
