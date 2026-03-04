"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  fetchTopRoutes,
  fetchVolatility,
  fetchSummary,
  fetchSeasonalHeatmap,
  fetchAirlineScores,
} from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { Download } from "lucide-react";
import toast from "react-hot-toast";
import { SeasonalHeatmap } from "@/components/charts/SeasonalHeatmap";
import { AirlineScoreTable } from "@/components/ui/AirlineScoreTable";

const COLORS = ["#00d09c", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#10b981", "#f97316"];

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) { toast.error("No data to export"); return; }
  const headers = Object.keys(data[0]);
  const rows = data.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename} downloaded!`);
}

export default function AnalyticsPage() {
  const [heatSource, setHeatSource] = useState("Delhi");
  const [heatDest, setHeatDest] = useState("Mumbai");

  const { data: topRoutes = [], isLoading: loadingRoutes, isError: routeErr } = useQuery({
    queryKey: ["top-routes-analytics"],
    queryFn: () => fetchTopRoutes(15),
    retry: 1,
  });

  const { data: volatility = [], isLoading: loadingVol, isError: volErr } = useQuery({
    queryKey: ["volatility-analytics"],
    queryFn: () => fetchVolatility(10),
    retry: 1,
  });

  const { data: summary } = useQuery({
    queryKey: ["summary"],
    queryFn: fetchSummary,
    retry: 1,
  });

  const { data: heatmap, isLoading: heatLoading } = useQuery({
    queryKey: ["seasonal-heatmap", heatSource, heatDest],
    queryFn: () => fetchSeasonalHeatmap(heatSource, heatDest),
    retry: 1,
  });

  const { data: airlines = [], isLoading: airlinesLoading } = useQuery({
    queryKey: ["airline-scores-analytics"],
    queryFn: fetchAirlineScores,
    retry: 1,
  });

  const topRoutesChartData = topRoutes.map((r) => ({
    route: `${r.source.slice(0, 3)}→${r.destination.slice(0, 3)}`,
    price: r.avg_price,
    class: r.flight_class,
    full: `${r.source} → ${r.destination}`,
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Deep-dive into fare trends across routes and airlines</p>
        </div>
        <button
          onClick={() => downloadCSV(topRoutes as unknown as Record<string, unknown>[], "aeroquant_top_routes.csv")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-secondary hover:bg-surface-tertiary border border-border text-sm text-foreground transition"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </motion.div>

      {/* Summary strip */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {[
            { label: "Total Routes", value: summary.total_routes.toLocaleString() },
            { label: "Avg Economy", value: formatPrice(summary.avg_economy_price) },
            { label: "Avg Business", value: formatPrice(summary.avg_business_price) },
            { label: "Cheapest Airline", value: summary.cheapest_airline },
          ].map(({ label, value }) => (
            <div key={label} className="glass-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{value}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Top Routes Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-5"
      >
        <h2 className="text-sm font-semibold text-foreground mb-4">Top Expensive Routes (Avg Fare)</h2>
        {loadingRoutes ? (
          <div className="skeleton h-64 w-full" />
        ) : routeErr || topRoutesChartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <p className="text-sm">{routeErr ? "Backend offline — start the server to load chart data" : "No route data available"}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topRoutesChartData} margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="route" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} />
              <YAxis
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ background: "#242938", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}
                formatter={(v: number, _: string, p) => [`₹${v.toLocaleString("en-IN")}`, p.payload.full]}
                labelStyle={{ display: "none" }}
              />
              <Bar dataKey="price" radius={[6, 6, 0, 0]}>
                {topRoutesChartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Volatility table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Price Volatility Ranking</h2>
          <button
            onClick={() => downloadCSV(volatility as unknown as Record<string, unknown>[], "aeroquant_volatility.csv")}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
        {loadingVol ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
          </div>
        ) : volErr || volatility.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <p className="text-sm">{volErr ? "Backend offline — start server_lite.py to load data" : "No volatility data available"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                  <th className="pb-2 pr-4">Route</th>
                  <th className="pb-2 pr-4">Airline</th>
                  <th className="pb-2 pr-4">Volatility</th>
                  <th className="pb-2">Price Range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {volatility.map((v, i) => (
                  <tr key={i} className="text-foreground hover:bg-surface-secondary/50 transition-colors">
                    <td className="py-2.5 pr-4">{v.route}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{v.airline}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-20 h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-orange rounded-full"
                            style={{ width: `${Math.min(v.volatility_score * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono">{v.volatility_score.toFixed(3)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-brand-green">{formatPrice(v.price_range)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Seasonal heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Seasonal Price Calendar</h2>
            <p className="text-xs text-muted-foreground">Monthly average fares — darker = costlier</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata"].map((city) => (
              <button
                key={city}
                onClick={() => setHeatSource(city)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                  heatSource === city
                    ? "bg-brand-green/20 border-brand-green/40 text-brand-green"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
        {heatLoading ? (
          <div className="skeleton h-32 w-full" />
        ) : heatmap ? (
          <SeasonalHeatmap cells={heatmap.cells} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No data for this route</p>
        )}
      </motion.div>

      {/* Airline leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass-card p-5"
      >
        <h2 className="text-sm font-semibold text-foreground mb-1">Airline Performance Leaderboard</h2>
        <p className="text-xs text-muted-foreground mb-4">Ranked by price score, stability and spike frequency</p>
        {airlinesLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
        ) : (
          <AirlineScoreTable airlines={airlines} />
        )}
      </motion.div>
    </div>
  );
}
