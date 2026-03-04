"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { LineChart, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { fetchForecast, fetchSeasonalHeatmap } from "@/lib/api";
import { ForecastChart } from "@/components/charts/ForecastChart";
import { SeasonalHeatmap } from "@/components/charts/SeasonalHeatmap";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

const CITIES = ["Delhi", "Mumbai", "Bangalore", "Hyderabad", "Kolkata", "Chennai"];
const AIRLINES = ["Any", "Air India", "IndiGo", "SpiceJet", "Vistara", "GO FIRST", "AirAsia"];

const selectClass = "px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-green/50 transition";

export default function ForecastPage() {
  const [source, setSource] = useState("Delhi");
  const [destination, setDestination] = useState("Mumbai");
  const [airline, setAirline] = useState("Any");
  const [flightClass, setFlightClass] = useState<"economy" | "business">("economy");
  const [horizon, setHorizon] = useState(30);

  const queryKey = ["forecast", source, destination, airline, flightClass, horizon];

  const { data: forecast, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      fetchForecast({
        source,
        destination,
        airline: airline === "Any" ? undefined : airline,
        flight_class: flightClass,
        horizon,
      }),
    enabled: source !== destination,
    staleTime: 300_000,
  });

  const { data: heatmap } = useQuery({
    queryKey: ["heatmap", source, destination, flightClass],
    queryFn: () => fetchSeasonalHeatmap(source, destination, flightClass),
    enabled: source !== destination,
    staleTime: 600_000,
  });

  const TREND_CFG = {
    up:     { icon: TrendingUp,   color: "text-red-400",    label: "Upward trend" },
    down:   { icon: TrendingDown, color: "text-brand-green", label: "Downward trend" },
    stable: { icon: Minus,        color: "text-blue-400",    label: "Stable" },
  };

  const trendKey = (forecast?.trend_direction ?? "stable") as keyof typeof TREND_CFG;
  const trendCfg = TREND_CFG[trendKey];
  const TrendIcon = trendCfg.icon;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2">
          <LineChart className="w-6 h-6 text-brand-green" />
          <h1 className="text-2xl font-bold text-foreground">30–60 Day Forecast</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Prophet-powered price forecasting with confidence intervals
        </p>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-4"
      >
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-muted-foreground mb-1">From</p>
            <select className={selectClass} value={source} onChange={(e) => setSource(e.target.value)}>
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">To</p>
            <select className={selectClass} value={destination} onChange={(e) => setDestination(e.target.value)}>
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Airline</p>
            <select className={selectClass} value={airline} onChange={(e) => setAirline(e.target.value)}>
              {AIRLINES.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Class</p>
            <select
              className={selectClass}
              value={flightClass}
              onChange={(e) => setFlightClass(e.target.value as "economy" | "business")}
            >
              <option value="economy">Economy</option>
              <option value="business">Business</option>
            </select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Horizon: {horizon}d</p>
            <input
              type="range" min={7} max={60} step={1}
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              className="w-32 accent-brand-green h-2 cursor-pointer mt-2"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-green/10 hover:bg-brand-green/20 border border-brand-green/30 text-brand-green text-sm font-medium transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </motion.div>

      {source === destination && (
        <div className="glass-card p-4 text-sm text-yellow-400 text-center">
          Source and destination must be different.
        </div>
      )}

      {/* Forecast Chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6 space-y-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {source} → {destination}
              {airline !== "Any" && <span className="text-muted-foreground font-normal ml-1.5">· {airline}</span>}
            </h2>
            <p className="text-xs text-muted-foreground capitalize">{flightClass} · {horizon}-day forecast</p>
          </div>
          {forecast && (
            <div className="flex items-center gap-4 text-sm">
              <div className={cn("flex items-center gap-1.5 font-medium", trendCfg.color)}>
                <TrendIcon className="w-4 h-4" />
                {trendCfg.label}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Avg forecast</p>
                <p className="font-bold text-foreground">{formatPrice(forecast.avg_forecasted_price)}</p>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading forecast…
          </div>
        ) : forecast ? (
          <ForecastChart
            points={forecast.points}
            trend={forecast.trend_direction}
            avgPrice={forecast.avg_forecasted_price}
          />
        ) : (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
            Select a valid route to see the forecast.
          </div>
        )}
      </motion.div>

      {/* Seasonal Heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6 space-y-4"
      >
        <div>
          <h2 className="text-sm font-semibold text-foreground">Seasonal Price Heatmap</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Monthly average fare — green = cheap, red = expensive</p>
        </div>
        {heatmap ? (
          <SeasonalHeatmap cells={heatmap.cells} />
        ) : (
          <div className="text-sm text-muted-foreground">Loading heatmap…</div>
        )}
      </motion.div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: "Prophet Model", desc: "Facebook's open-source time-series forecasting with yearly, weekly, and custom seasonality." },
          { title: "Confidence Interval", desc: "The shaded area shows the 80% prediction interval — real prices are expected to fall within this band." },
          { title: "Trend Analysis", desc: "Up/down/stable trend is determined by comparing the first and second half of the forecast period." },
        ].map(({ title, desc }) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4"
          >
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
