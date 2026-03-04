"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { ForecastPoint } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  points: ForecastPoint[];
  trend: "up" | "down" | "stable";
  avgPrice: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const isForecast = payload[0]?.payload?.is_forecast;
    return (
      <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-lg min-w-[150px]">
        <p className="font-semibold text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => {
          if (p.dataKey === "yhat_upper" || p.dataKey === "yhat_lower") return null;
          return (
            <p key={i} className="text-foreground">
              {isForecast ? "Forecast" : "Historical"}: <span className="font-bold">₹{Number(p.value).toLocaleString("en-IN")}</span>
            </p>
          );
        })}
        {isForecast && payload.find((p: any) => p.dataKey === "yhat_lower") && (
          <p className="text-muted-foreground text-[10px] mt-1">
            Range: ₹{Number(payload.find((p:any) => p.dataKey === "yhat_lower")?.value || 0).toLocaleString("en-IN")} –{" "}
            ₹{Number(payload.find((p:any) => p.dataKey === "yhat_upper")?.value || 0).toLocaleString("en-IN")}
          </p>
        )}
      </div>
    );
  }
  return null;
};

const TREND_CFG = {
  up:     { icon: TrendingUp,   color: "text-red-400",    label: "Prices trending up" },
  down:   { icon: TrendingDown, color: "text-brand-green", label: "Prices trending down" },
  stable: { icon: Minus,        color: "text-blue-400",    label: "Prices stable" },
};

export function ForecastChart({ points, trend, avgPrice }: Props) {
  const cfg = TREND_CFG[trend];
  const Icon = cfg.icon;

  // Split today boundary
  const today = new Date().toISOString().slice(0, 10);
  const splitIdx = points.findIndex((p) => p.is_forecast);
  const splitDate = splitIdx >= 0 ? points[splitIdx].ds : today;

  return (
    <div className="space-y-3">
      {/* Trend badge */}
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-1.5 text-sm font-medium", cfg.color)}>
          <Icon className="w-4 h-4" />
          <span>{cfg.label}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Avg forecast: <span className="text-foreground font-semibold">{formatPrice(avgPrice)}</span>
        </span>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis
              dataKey="ds"
              tick={{ fontSize: 10, fill: "#8a8aaa" }}
              tickFormatter={(v) => v.slice(5)}   // MM-DD
              interval={Math.floor(points.length / 6)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#8a8aaa" }}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              width={44}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Confidence interval shading */}
            <Area
              dataKey="yhat_upper"
              stroke="transparent"
              fill="#3b82f6"
              fillOpacity={0.08}
              isAnimationActive={false}
            />
            <Area
              dataKey="yhat_lower"
              stroke="transparent"
              fill="#ffffff"
              fillOpacity={0}
              isAnimationActive={false}
            />

            {/* Today boundary */}
            <ReferenceLine x={splitDate} stroke="#4a4a7a" strokeDasharray="6 3" label={{ value: "Today", fill: "#8a8aaa", fontSize: 10 }} />

            {/* Historical line */}
            <Line
              dataKey="yhat"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#3b82f6" }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5"><span className="w-8 h-0.5 bg-blue-500 rounded-full" />Historical / Forecast</span>
        <span className="flex items-center gap-1.5"><span className="w-8 h-2 bg-blue-500/20 rounded-sm" />80% Confidence Interval</span>
      </div>
    </div>
  );
}
