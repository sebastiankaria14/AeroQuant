# ✈ AeroQuant Pro — Flight Price Intelligence Platform

> **v2.0.0** · AI-powered flight fare forecasting, market analytics, price alerts, and ML explainability  
> Built with **Next.js 14 · FastAPI · XGBoost · LightGBM · Prophet · SHAP · PostgreSQL · Redis**

---

## 📐 System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         Internet / Client                          │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
                        ┌──────▼──────┐
                        │    Nginx    │  ← Reverse proxy + rate limit
                        └──────┬──────┘
               ┌───────────────┼───────────────┐
               │                               │
        ┌──────▼──────┐                ┌───────▼──────┐
        │  Next.js 14 │                │   FastAPI    │
        │  (Frontend) │                │  (Backend)   │
        └─────────────┘                └──────┬───────┘
                                              │
                          ┌───────────────────┼───────────────────┐
                          │                   │                   │
                   ┌──────▼──────┐   ┌────────▼────┐   ┌────────▼────┐
                   │  ML Service │   │  Analytics  │   │ User/Auth   │
                   │  XGBoost    │   │  Service    │   │  Service    │
                   │  LightGBM   │   │             │   │  JWT        │
                   └─────────────┘   └─────────────┘   └─────────────┘
                                              │
                          ┌───────────────────┼───────────────────┐
                          │                                       │
                   ┌──────▼──────┐                       ┌───────▼──────┐
                   │ PostgreSQL  │                       │    Redis     │
                   │  (Primary)  │                       │   (Cache)    │
                   └─────────────┘                       └─────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose ≥ v2
- Node.js 20 (for local dev)
- Python 3.11 (for local dev)

### 1. Clone & configure

```bash
git clone https://github.com/yourorg/aeroquant.git
cd aeroquant
cp .env.example .env
# Edit .env — change SECRET_KEY, passwords, etc.
```

### 2. Add datasets

```bash
# Copy the three CSV files into the backend/data directory:
mkdir -p backend/data
cp /path/to/Clean_Dataset.csv  backend/data/
cp /path/to/economy.csv        backend/data/
cp /path/to/business.csv       backend/data/
```

### 3. Train the ML model (first time only)

```bash
cd backend
pip install -r requirements.txt
python -m ml.train --data-dir data --model-dir ml/saved_models
```

### 4. Start everything with Docker Compose

```bash
docker compose up --build -d
```

| Service    | URL                      |
|------------|--------------------------|
| Frontend   | http://localhost         |
| API Docs   | http://localhost/api/docs|
| Grafana    | http://localhost:3001    |
| Prometheus | http://localhost:9090    |

### 5. Seed the database

```bash
docker compose exec backend python -m scripts.seed_db
```

---

## 🛠 Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Start Postgres & Redis (or use Docker for just those services)
docker compose up postgres redis -d

# Run migrations / init DB
python -c "import asyncio; from app.db.session import init_db; asyncio.run(init_db())"

# Train models
python -m ml.train --data-dir data --model-dir ml/saved_models

# Seed DB
python -m scripts.seed_db

# Start API
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > .env.local
npm run dev
```

---

## 📁 Project Structure

```
aeroquant/
├── .github/
│   └── workflows/
│       └── ci-cd.yml              # GitHub Actions CI/CD pipeline
│
├── backend/
│   ├── app/
│   │   ├── api/routes/            # FastAPI routers
│   │   │   ├── analytics.py
│   │   │   ├── auth.py
│   │   │   ├── compare.py
│   │   │   ├── predict.py
│   │   │   ├── routes.py
│   │   │   └── watchlist.py
│   │   ├── core/
│   │   │   ├── config.py          # Pydantic settings
│   │   │   ├── logging.py         # structlog setup
│   │   │   └── security.py        # JWT + bcrypt
│   │   ├── db/
│   │   │   ├── models.py          # SQLAlchemy ORM models
│   │   │   └── session.py         # Async engine + session
│   │   ├── ml/
│   │   │   └── predictor.py       # Inference wrapper
│   │   ├── schemas/
│   │   │   └── schemas.py         # Pydantic I/O schemas
│   │   ├── services/
│   │   │   └── cache.py           # Redis cache helpers
│   │   └── main.py                # FastAPI app factory
│   ├── db/
│   │   └── init.sql               # PostgreSQL schema + seeds
│   ├── ml/
│   │   ├── saved_models/          # Trained model artefacts (gitignored)
│   │   └── train.py               # Full ML training pipeline
│   ├── scripts/
│   │   └── seed_db.py             # Populate DB from CSVs
│   ├── tests/
│   │   └── test_api.py
│   ├── alembic.ini
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── admin/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── compare/page.tsx
│   │   ├── prediction/page.tsx
│   │   ├── watchlist/page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx               # Dashboard
│   ├── components/
│   │   ├── charts/
│   │   │   └── PriceTrendChart.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   ├── ui/
│   │   │   ├── RouteTable.tsx
│   │   │   ├── StatCard.tsx
│   │   │   └── VolatilityBar.tsx
│   │   └── Providers.tsx
│   ├── lib/
│   │   ├── api.ts                 # Axios API client + typed helpers
│   │   └── utils.ts               # CN, formatPrice, etc.
│   ├── Dockerfile
│   ├── next.config.js
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf                 # Reverse proxy + rate limiting
│
├── monitoring/
│   └── prometheus.yml
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🤖 ML Pipeline

| Step | Description |
|------|-------------|
| **Data loading** | Reads `Clean_Dataset.csv`, `economy.csv`, `business.csv` |
| **Feature eng.** | Duration parsing, time blocks, route frequency, stop normalization |
| **Preprocessing** | OrdinalEncoder + StandardScaler via ColumnTransformer pipeline |
| **Training** | XGBoost (500 trees, early stopping) + LightGBM (500 trees) |
| **Evaluation** | RMSE, MAE, R² on held-out 15% test split |
| **Selection** | Best model by RMSE is saved as `best_model.joblib` |
| **Inference** | Confidence interval from ensemble delta between XGB & LGB |
| **Serialization** | `joblib` artefacts + metadata JSON |

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/predict` | Predict fare price |
| `GET` | `/api/v1/routes` | List/search airline routes |
| `GET` | `/api/v1/analytics/top-routes` | Highest average fares |
| `GET` | `/api/v1/analytics/volatility` | Price volatility ranking |
| `GET` | `/api/v1/analytics/summary` | Platform-wide stats |
| `GET` | `/api/v1/compare` | Compare two routes |
| `GET` | `/api/v1/watchlist` | Get user watchlist |
| `POST` | `/api/v1/watchlist` | Add to watchlist |
| `DELETE` | `/api/v1/watchlist/{id}` | Remove from watchlist |
| `POST` | `/api/v1/auth/register` | Register user |
| `POST` | `/api/v1/auth/login` | Login (returns JWT) |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/metrics` | Prometheus metrics |

**Interactive docs** → `http://localhost/api/docs`

---

## 🗄 Database Schema

```sql
users              -- Auth accounts
flight_routes      -- Aggregated route stats (avg/min/max price, volatility)
price_records      -- Individual fare time-series per route
watchlists         -- User saved routes with optional price alerts
prediction_history -- Audit log of every ML prediction
```

---

## ☁ AWS Deployment

```bash
# On EC2 (Ubuntu 22.04 LTS, t3.medium or larger)
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker

git clone https://github.com/yourorg/aeroquant /opt/aeroquant
cd /opt/aeroquant
cp .env.example .env
# Edit .env with production values

docker compose up -d --build
docker compose exec backend python -m ml.train --data-dir data --model-dir ml/saved_models
docker compose exec backend python -m scripts.seed_db
```

**For HTTPS**, place SSL certs at `nginx/ssl/fullchain.pem` and `nginx/ssl/privkey.pem`  
and uncomment the HTTPS server block in `nginx/nginx.conf`.

---

## 📈 Scaling Strategy

| Concern | Solution |
|---------|----------|
| API horizontal scale | Multiple `backend` replicas behind Nginx upstream |
| DB read scale | PostgreSQL read replicas (RDS Multi-AZ) |
| Prediction caching | Redis: 2-minute TTL per unique input hash |
| Static assets | CDN (CloudFront) in front of Next.js |
| Model storage | S3 bucket; S3 URL in `metadata.json` |
| Background tasks | Add Celery + Redis broker for async jobs |
| Rate limiting | `slowapi` (in-app) + Nginx `limit_req` |

---

## 🔒 Security

- **JWT HS256** with configurable expiry (default 24 h)
- **bcrypt** password hashing with 12 rounds  
- **Rate limiting** on all endpoints (200 req/min default, 10/min on auth)  
- **CORS** whitelist via `CORS_ORIGINS` env variable  
- **Gzip** compression on responses  
- **Security headers** (X-Frame-Options, X-Content-Type-Options, etc.)

---

## 🆕 v2.0 New Features

| # | Feature | Where |
|---|---------|-------|
| 1 | **Buy / Wait Engine** | `/predict/v2` → confidence-scored recommendation |
| 2 | **Volatility Index** | SVG arc gauge on Prediction + Analytics pages |
| 3 | **30–60 Day Forecast** | `/forecast` → Prophet model with CI shading |
| 4 | **SHAP Explainability** | `/explain` → feature-level impact bar chart |
| 5 | **Price Alerts** | `/alerts` → trigger when route drops below target |
| 6 | **Airline Leaderboard** | `/admin/airlines` → score, stability, spikes |
| 7 | **Seasonal Heatmap** | `/analytics/seasonal-heatmap` → 12-month colour grid |
| 8 | **Multi-Model Benchmark** | 4 models compared: LinearReg / RF / XGBoost / LightGBM |
| 9 | **Price Simulator** | Interactive slider recalculator on Prediction page |
| 10 | **Admin Intelligence Panel** | KPIs, route ranking, model accuracy, system health |

### Train / retrain models

```bash
# Docker (one-shot)
docker compose --profile train run model_trainer

# Local
cd backend && python ml/train.py
```

Models are saved to `backend/ml/saved_models/` and loaded hot by the API.

### New API endpoints (v2)

```
POST /api/v1/predict/v2           # Enriched prediction
POST /api/v1/explain              # SHAP explanation
GET  /api/v1/forecast             # 30–60 day Prophet forecast
GET  /api/v1/alerts               # List alerts
POST /api/v1/alerts               # Create alert
DEL  /api/v1/alerts/{id}          # Delete alert
GET  /api/v1/analytics/seasonal-heatmap
GET  /api/v1/analytics/volatility/detail
GET  /api/v1/analytics/price-trend
GET  /api/v1/admin/metrics
GET  /api/v1/admin/models
GET  /api/v1/admin/airlines
GET  /api/v1/admin/system-health
```

---

## 🧪 Running Tests

```bash
cd backend
pip install pytest pytest-asyncio aiosqlite httpx
pytest tests/ -v
```

---

## 📊 Monitoring

- **Prometheus** scrapes the `/api/metrics` endpoint automatically  
- **Grafana** at port 3001 (default login: `admin` / `admin`)  
- Add FastAPI dashboard from Grafana dashboard ID `17175`

---

## 📜 License

MIT © AeroQuant 2025
