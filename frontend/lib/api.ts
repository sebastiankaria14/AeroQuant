import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "/api/v1",
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT if present
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("aq_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail ?? err.message ?? "Unknown error";
    return Promise.reject(new Error(msg));
  }
);

// ─── Core types ───────────────────────────────────────────────────────────────
export interface PredictionInput {
  airline: string;
  source: string;
  destination: string;
  stops: string;
  days_until_departure: number;
  dep_time: string;
  flight_class: "economy" | "business";
}

export interface PredictionOutput {
  predicted_price: number;
  confidence_lower: number;
  confidence_upper: number;
  model_used: string;
  currency: string;
  input_echo: PredictionInput;
}

// ─── Buy/Wait recommendation ──────────────────────────────────────────────────
export interface BuyWaitRecommendation {
  recommendation: "BUY_NOW" | "WAIT" | "NEUTRAL";
  confidence_score: number;
  fair_price: number;
  market_avg: number;
  price_diff_pct: number;
  volatility_score: number;
  volatility_label: "Stable" | "Moderate" | "Highly Volatile";
  price_in_5d: number;
  price_in_10d: number;
  price_in_30d: number;
  reasoning: string;
}

// ─── SHAP explainability ──────────────────────────────────────────────────────
export interface ShapFeature {
  feature: string;
  value: string | number;
  shap_value: number;
  direction: "positive" | "negative";
}

export interface ExplainOutput {
  predicted_price: number;
  base_value: number;
  top_features: ShapFeature[];
  summary: string;
}

// ─── V2 enriched prediction ───────────────────────────────────────────────────
export interface PredictionOutputV2 extends PredictionOutput {
  buy_wait: BuyWaitRecommendation;
  explain: ExplainOutput;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
export interface RouteOut {
  id: number;
  source: string;
  destination: string;
  airline: string;
  flight_class: string;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  price_volatility: number | null;
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface AnalyticsSummary {
  total_routes: number;
  total_records: number;
  avg_economy_price: number;
  avg_business_price: number;
  cheapest_airline: string;
  most_expensive_route: string;
}

export interface TopRouteItem {
  source: string;
  destination: string;
  avg_price: number;
  flight_class: string;
  sample_count: number;
}

export interface VolatilityItem {
  route: string;
  airline: string;
  volatility_score: number;
  price_range: number;
}

export interface VolatilityDetail extends VolatilityItem {
  volatility_label: "Stable" | "Moderate" | "Highly Volatile";
  std_dev: number;
  avg_price: number;
}

export interface PriceTrendPoint {
  date: string;
  days_left: number;
  economy: number | null;
  business: number | null;
}

// ─── Forecast ────────────────────────────────────────────────────────────────
export interface ForecastPoint {
  ds: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
  is_forecast: boolean;
}

export interface ForecastResponse {
  source: string;
  destination: string;
  airline: string | null;
  flight_class: string;
  horizon_days: number;
  points: ForecastPoint[];
  trend_direction: "up" | "down" | "stable";
  avg_forecasted_price: number;
}

// ─── Seasonal heatmap ─────────────────────────────────────────────────────────
export interface HeatmapCell {
  month: number;
  month_label: string;
  source: string;
  destination: string;
  avg_price: number;
  sample_count: number;
}

export interface SeasonalHeatmapResponse {
  cells: HeatmapCell[];
  source: string;
  destination: string;
}

// ─── Airline metrics ──────────────────────────────────────────────────────────
export interface AirlineScore {
  airline: string;
  overall_score: number;
  avg_price: number;
  price_stability: number;
  spike_frequency: number;
  economy_avg: number | null;
  business_avg: number | null;
  best_for: "Budget" | "Stable" | "Premium";
  route_count: number;
}

// ─── Admin metrics ────────────────────────────────────────────────────────────
export interface AdminMetrics {
  total_predictions: number;
  predictions_today: number;
  most_searched_routes: { route: string; count: number }[];
  avg_prediction_latency_ms: number;
  model_accuracy: Record<string, number>;
  api_requests_last_hour: number;
  active_alerts: number;
  total_users: number;
  cache_hit_rate: number;
}

export interface ModelMetrics {
  model_name: string;
  rmse: number | null;
  mae: number | null;
  r2: number | null;
  mape: number | null;
  is_best: boolean;
  trained_at: string;
}

// ─── Watchlist / Alerts ───────────────────────────────────────────────────────
export interface WatchlistItem {
  id: number;
  source: string;
  destination: string;
  airline: string | null;
  flight_class: string;
  alert_price: number | null;
  is_alert_active: boolean;
  created_at: string;
}

export interface PriceAlert {
  id: number;
  source: string;
  destination: string;
  airline: string | null;
  flight_class: string;
  target_price: number;
  triggered_price: number | null;
  is_triggered: boolean;
  is_active: boolean;
  created_at: string;
}

export interface WatchlistAlert {
  watchlist_id: number;
  source: string;
  destination: string;
  airline: string | null;
  flight_class: string;
  alert_price: number;
  predicted_price: number;
  savings: number;
}

// ─── Compare ──────────────────────────────────────────────────────────────────
export interface CompareResult {
  route_a_label: string;
  route_b_label: string;
  route_a_prices: { date: string; days: number; avg_price: number; min_price: number; max_price: number }[];
  route_b_prices: { date: string; days: number; avg_price: number; min_price: number; max_price: number }[];
  route_a_avg: number;
  route_b_avg: number;
  route_a_min: number;
  route_b_min: number;
  difference_pct: number;
  cheaper_route: "A" | "B";
  best_booking_days_a: number;
  best_booking_days_b: number;
  savings: number;
}

export interface SystemHealth {
  status: string;
  model_loaded: boolean;
  shap_available: boolean;
  prophet_available: boolean;
  server_type: string;
}

export interface LoginResult {
  access_token: string;
  token_type: string;
  username: string;
}

// ─── API functions ────────────────────────────────────────────────────────────

// Prediction
export const predictPrice = (input: PredictionInput) =>
  api.post<PredictionOutput>("/predict", input).then((r) => r.data);

export const predictPriceV2 = (input: PredictionInput) =>
  api.post<PredictionOutputV2>("/predict/v2", input).then((r) => r.data);

export const explainPrediction = (input: PredictionInput) =>
  api.post<ExplainOutput>("/explain", input).then((r) => r.data);

// Forecast
export const fetchForecast = (params: {
  source: string;
  destination: string;
  airline?: string;
  flight_class?: string;
  horizon?: number;
}) => api.get<ForecastResponse>("/forecast", { params }).then((r) => r.data);

// Routes
export const fetchRoutes = (params?: Record<string, string>) =>
  api.get<RouteOut[]>("/routes", { params }).then((r) => r.data);

// Analytics
export const fetchSummary = () =>
  api.get<AnalyticsSummary>("/analytics/summary").then((r) => r.data);

export const fetchTopRoutes = (limit = 10) =>
  api.get<TopRouteItem[]>("/analytics/top-routes", { params: { limit } }).then((r) => r.data);

export const fetchVolatility = (limit = 10) =>
  api.get<VolatilityItem[]>("/analytics/volatility", { params: { limit } }).then((r) => r.data);

export const fetchVolatilityDetail = (limit = 10) =>
  api.get<VolatilityDetail[]>("/analytics/volatility/detail", { params: { limit } }).then((r) => r.data);

export const fetchPriceTrend = (source = "Delhi", destination = "Mumbai", points = 30) =>
  api.get<PriceTrendPoint[]>("/analytics/price-trend", { params: { source, destination, points } }).then((r) => r.data);

export const fetchSeasonalHeatmap = (source: string, destination: string, flight_class = "economy") =>
  api.get<SeasonalHeatmapResponse>("/analytics/seasonal-heatmap", { params: { source, destination, flight_class } }).then((r) => r.data);

// Watchlist
export const fetchWatchlist = () =>
  api.get<WatchlistItem[]>("/watchlist").then((r) => r.data);

export const addToWatchlist = (payload: Omit<WatchlistItem, "id" | "is_alert_active" | "created_at">) =>
  api.post<WatchlistItem>("/watchlist", payload).then((r) => r.data);

export const removeFromWatchlist = (id: number) =>
  api.delete(`/watchlist/${id}`);

export const checkWatchlistAlerts = () =>
  api.get<WatchlistAlert[]>("/watchlist/alerts").then((r) => r.data);

// Price Alerts
export const fetchAlerts = () =>
  api.get<PriceAlert[]>("/alerts").then((r) => r.data);

export const createAlert = (payload: { source: string; destination: string; airline?: string; flight_class: string; target_price: number }) =>
  api.post<PriceAlert>("/alerts", payload).then((r) => r.data);

export const deleteAlert = (id: number) =>
  api.delete(`/alerts/${id}`);

// Compare
export const compareRoutes = (params: Record<string, string>) =>
  api.get<CompareResult>("/compare", { params }).then((r) => r.data);

// Admin
export const fetchAdminMetrics = () =>
  api.get<AdminMetrics>("/admin/metrics").then((r) => r.data);

export const fetchModelMetrics = () =>
  api.get<ModelMetrics[]>("/admin/models").then((r) => r.data);

export const fetchAirlineScores = () =>
  api.get<AirlineScore[]>("/admin/airlines").then((r) => r.data);

export const fetchSystemHealth = () =>
  api.get<SystemHealth>("/admin/system-health").then((r) => r.data);

// Auth
export const login = (username: string, password: string) =>
  api.post<LoginResult>("/auth/login", { username, password }).then((r) => r.data);


// ─── API helpers ──────────────────────────────────────────────────────────────
export interface PredictionInput {
  airline: string;
  source: string;
  destination: string;
  stops: string;
  days_until_departure: number;
  dep_time: string;
  flight_class: "economy" | "business";
}

export interface PredictionOutput {
  predicted_price: number;
  confidence_lower: number;
  confidence_upper: number;
  model_used: string;
  currency: string;
  input_echo: PredictionInput;
}

export interface RouteOut {
  id: number;
  source: string;
  destination: string;
  airline: string;
  flight_class: string;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  price_volatility: number | null;
}

export interface AnalyticsSummary {
  total_routes: number;
  total_records: number;
  avg_economy_price: number;
  avg_business_price: number;
  cheapest_airline: string;
  most_expensive_route: string;
}

export interface TopRouteItem {
  source: string;
  destination: string;
  avg_price: number;
  flight_class: string;
  sample_count: number;
}

export interface VolatilityItem {
  route: string;
  airline: string;
  volatility_score: number;
  price_range: number;
}

export interface WatchlistItem {
  id: number;
  source: string;
  destination: string;
  airline: string | null;
  flight_class: string;
  alert_price: number | null;
  is_alert_active: boolean;
  created_at: string;
}

export interface CompareResult {
  route_a_label: string;
  route_b_label: string;
  route_a_prices: { date: string; days: number; avg_price: number; min_price: number; max_price: number }[];
  route_b_prices: { date: string; days: number; avg_price: number; min_price: number; max_price: number }[];
  route_a_avg: number;
  route_b_avg: number;
  route_a_min: number;
  route_b_min: number;
  difference_pct: number;
  cheaper_route: "A" | "B";
  best_booking_days_a: number;
  best_booking_days_b: number;
  savings: number;
}

