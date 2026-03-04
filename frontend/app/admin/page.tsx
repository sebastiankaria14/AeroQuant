"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAdminMetrics,
  fetchModelMetrics,
  fetchAirlineScores,
  fetchSystemHealth,
} from "@/lib/api";
import {
  ShieldCheck, Database, Cpu, Activity, AlertCircle, CheckCircle2,
  TrendingUp, Users, Bell, Zap, BarChart2, Clock,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { ModelComparisonTable } from "@/components/ui/ModelComparisonTable";
import { AirlineScoreTable } from "@/components/ui/AirlineScoreTable";
import { cn } from "@/lib/utils";

function StatTile({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: any; color: string; sub?: string }) {
  return (
    <div className="glass-card p-5 flex items-start gap-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", `${color}/15`)}>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={cn("text-xl font-bold mt-0.5", color)}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { data: health, isLoading: healthLoading, isError: healthError } = useQuery({
    queryKey: ["system-health"],
    queryFn: fetchSystemHealth,
    retry: 1,
    refetchInterval: 30_000,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: fetchAdminMetrics,
    retry: 1,
    refetchInterval: 60_000,
  });

  const { data: modelMetrics = [] } = useQuery({
    queryKey: ["model-metrics"],
    queryFn: fetchModelMetrics,
    retry: 1,
  });

  const { data: airlines = [] } = useQuery({
    queryKey: ["airline-scores"],
    queryFn: fetchAirlineScores,
    retry: 1,
  });

  const apiOk = !healthLoading && !healthError && health?.status === "ok";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-brand-green" />
          <h1 className="text-2xl font-bold text-foreground">Admin Intelligence Panel</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Platform analytics, model performance, and system health</p>
      </motion.div>

      {/* System health strip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm",
          apiOk ? "bg-brand-green/5 border-brand-green/20" : "bg-red-400/5 border-red-400/20"
        )}
      >
        {apiOk
          ? <CheckCircle2 className="w-4 h-4 text-brand-green shrink-0" />
          : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        }
        <span className={apiOk ? "text-brand-green font-medium" : "text-red-400 font-medium"}>
          {healthLoading ? "Checking API…" : apiOk ? "All systems operational" : "API connection failed"}
        </span>
        {health && (
          <span className="text-muted-foreground text-xs ml-2">
            SHAP: {health.shap_available ? "✓" : "✗"} · Prophet: {health.prophet_available ? "✓" : "✗"} · {health.server_type}
          </span>
        )}
      </motion.div>

      {/* KPI stat tiles */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        <StatTile
          label="Total Predictions"
          value={metricsLoading ? "…" : (metrics?.total_predictions ?? 0).toLocaleString()}
          icon={TrendingUp}
          color="text-brand-green"
          sub="all time"
        />
        <StatTile
          label="Predictions Today"
          value={metricsLoading ? "…" : (metrics?.predictions_today ?? 0)}
          icon={Activity}
          color="text-brand-blue"
          sub="since midnight"
        />
        <StatTile
          label="Total Users"
          value={metricsLoading ? "…" : (metrics?.total_users ?? 0)}
          icon={Users}
          color="text-purple-400"
          sub="registered accounts"
        />
        <StatTile
          label="Active Alerts"
          value={metricsLoading ? "…" : (metrics?.active_alerts ?? 0)}
          icon={Bell}
          color="text-yellow-400"
          sub="price alerts set"
        />
        <StatTile
          label="Avg Latency"
          value={metricsLoading ? "…" : `${metrics?.avg_prediction_latency_ms ?? 0}ms`}
          icon={Clock}
          color="text-brand-green"
          sub="prediction endpoint"
        />
        <StatTile
          label="Cache Hit Rate"
          value={metricsLoading ? "…" : `${((metrics?.cache_hit_rate ?? 0) * 100).toFixed(0)}%`}
          icon={Zap}
          color="text-brand-blue"
          sub="Redis efficiency"
        />
        <StatTile
          label="API Req / hr"
          value={metricsLoading ? "…" : (metrics?.api_requests_last_hour ?? 0)}
          icon={BarChart2}
          color="text-orange-400"
          sub="last 60 min"
        />
        <StatTile
          label="ML Model"
          value={health?.model_loaded ? "Loaded" : "Offline"}
          icon={Cpu}
          color={health?.model_loaded ? "text-brand-green" : "text-red-400"}
          sub="XGBoost / LightGBM"
        />
      </motion.div>

      {/* Most searched routes */}
      {metrics?.most_searched_routes && metrics.most_searched_routes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-5"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3">Most Searched Routes</h2>
          <div className="space-y-2">
            {metrics.most_searched_routes.map((r, i) => {
              const pct = Math.round((r.count / metrics.most_searched_routes[0].count) * 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-muted-foreground text-right shrink-0">{i + 1}</span>
                  <span className="text-sm text-foreground w-36 shrink-0 truncate">{r.route}</span>
                  <div className="flex-1 h-2 bg-surface-tertiary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, delay: i * 0.05 }}
                      className="h-full bg-brand-green rounded-full"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right shrink-0">{r.count}×</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Model accuracy */}
      {metrics?.model_accuracy && Object.keys(metrics.model_accuracy).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-5"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3">Live Model Accuracy (R²)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(metrics.model_accuracy).map(([model, r2]) => (
              <div key={model} className="bg-surface-secondary rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground capitalize">{model}</p>
                <p className={cn("text-lg font-bold mt-1", r2 >= 0.9 ? "text-brand-green" : r2 >= 0.7 ? "text-yellow-400" : "text-red-400")}>
                  {r2.toFixed(3)}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Model comparison table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-5"
      >
        <h2 className="text-sm font-semibold text-foreground mb-1">Model Benchmark</h2>
        <p className="text-xs text-muted-foreground mb-4">LinearRegression · RandomForest · XGBoost · LightGBM</p>
        <ModelComparisonTable models={modelMetrics} />
      </motion.div>

      {/* Airline performance */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass-card p-5"
      >
        <h2 className="text-sm font-semibold text-foreground mb-1">Airline Performance Scores</h2>
        <p className="text-xs text-muted-foreground mb-4">Score = weighted function of price, stability, spikes, popularity</p>
        <AirlineScoreTable airlines={airlines} />
      </motion.div>
    </div>
  );
}
