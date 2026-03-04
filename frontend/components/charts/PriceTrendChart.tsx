"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChevronDown } from "lucide-react";
import { fetchPriceTrend } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

const ROUTES = [
  { label: "Delhi → Mumbai", source: "Delhi", destination: "Mumbai" },
  { label: "Delhi → Bangalore", source: "Delhi", destination: "Bangalore" },
  { label: "Mumbai → Hyderabad", source: "Mumbai", destination: "Hyderabad" },
  { label: "Mumbai → Kolkata", source: "Mumbai", destination: "Kolkata" },
  { label: "Delhi → Chennai", source: "Delhi", destination: "Chennai" },
  { label: "Bangalore → Delhi", source: "Bangalore", destination: "Delhi" },
];

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2.5 text-xs shadow-xl border border-border/50">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        p.value != null && (
          <div key={p.dataKey} className="flex justify-between gap-4">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-mono text-foreground">{formatPrice(p.value)}</span>
          </div>
        )
      ))}
    </div>
  );
};

export function PriceTrendChart() {
  const [view, setView] = useState<"both" | "economy" | "business">("both");
  const [routeIdx, setRouteIdx] = useState(0);
  const [showRoutes, setShowRoutes] = useState(false);
  const route = ROUTES[routeIdx];

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["price-trend", route.source, route.destination],
    queryFn: () => fetchPriceTrend(route.source, route.destination, 30),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="glass-card p-5 h-full">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        {/* Route selector */}
        <div className="relative">
          <button
            onClick={() => setShowRoutes((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-brand-green transition"
          >
            Price Trend · {route.label}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRoutes ? "rotate-180" : ""}`} />
          </button>
          {showRoutes && (
            <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-xl shadow-xl z-20 min-w-[200px] py-1 overflow-hidden">
              {ROUTES.map((r, i) => (
                <button
                  key={r.label}
                  onClick={() => { setRouteIdx(i); setShowRoutes(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition ${
                    i === routeIdx
                      ? "text-brand-green bg-brand-green/10"
                      : "text-foreground hover:bg-surface-secondary"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View toggle */}
        <div className="flex gap-1 text-xs">
          {(["both", "economy", "business"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded-full transition capitalize ${
                view === v
                  ? "bg-brand-green/15 text-brand-green border border-brand-green/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-[250px]">
          <div className="skeleton h-full w-full rounded-lg" />
        </div>
      ) : isError || data.length === 0 ? (
        <div className="h-[250px] flex flex-col items-center justify-center gap-2 text-center">
          <svg className="w-8 h-8 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-muted-foreground">Backend offline</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data} margin={{ left: -8 }}>
            <defs>
              <linearGradient id="gradEcon" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00d09c" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#00d09c" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradBiz" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={4}
            />
            <YAxis
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CUSTOM_TOOLTIP />} />
            {(view === "both" || view === "economy") && (
              <Area
                type="monotone"
                dataKey="economy"
                name="Economy"
                stroke="#00d09c"
                strokeWidth={2}
                fill="url(#gradEcon)"
                dot={false}
                activeDot={{ r: 4, fill: "#00d09c" }}
                connectNulls
              />
            )}
            {(view === "both" || view === "business") && (
              <Area
                type="monotone"
                dataKey="business"
                name="Business"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#gradBiz)"
                dot={false}
                activeDot={{ r: 4, fill: "#8b5cf6" }}
                connectNulls
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}

      {!isLoading && !isError && data.length > 0 && (
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 rounded bg-brand-green inline-block" /> Economy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 rounded bg-brand-purple inline-block" /> Business
          </span>
          <span className="ml-auto text-[10px]">Avg price by booking lead-time · Live data</span>
        </div>
      )}
    </div>
  );
}
