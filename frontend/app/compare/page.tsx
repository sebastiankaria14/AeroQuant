"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  GitCompare, Loader2, Trophy, Calendar,
  Plane, Info, CheckCircle2,
} from "lucide-react";
import { compareRoutes, CompareResult } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import toast from "react-hot-toast";

const AIRLINES = ["Air India", "IndiGo", "SpiceJet", "Vistara", "GO FIRST", "AirAsia"];
const CITIES   = ["Delhi", "Mumbai", "Bangalore", "Hyderabad", "Kolkata", "Chennai"];

const inputClass =
  "w-full px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-green/50 transition";
const labelClass =
  "block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide";

interface RouteForm {
  source: string; destination: string; airline: string; flight_class: string;
}

const defaultRoute = (i: number): RouteForm => ({
  source:       i === 0 ? "Delhi"  : "Mumbai",
  destination:  i === 0 ? "Mumbai" : "Delhi",
  airline:      i === 0 ? "IndiGo" : "Air India",
  flight_class: "economy",
});

const KEY_DAYS = [1, 7, 14, 30, 60, 90, 180, 365];

export default function ComparePage() {
  const [routeA, setRouteA] = useState<RouteForm>(defaultRoute(0));
  const [routeB, setRouteB] = useState<RouteForm>(defaultRoute(1));
  const [result, setResult] = useState<CompareResult | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      compareRoutes({
        source_a: routeA.source,  dest_a: routeA.destination,
        airline_a: routeA.airline, class_a: routeA.flight_class,
        source_b: routeB.source,  dest_b: routeB.destination,
        airline_b: routeB.airline, class_b: routeB.flight_class,
      }),
    onSuccess: (data) => { setResult(data); toast.success("Comparison ready!"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCompare = () => {
    if (routeA.source === routeA.destination || routeB.source === routeB.destination) {
      toast.error("Source and destination cannot be the same.");
      return;
    }
    mutation.mutate();
  };

  const chartData = result
    ? result.route_a_prices.map((a, i) => ({
        label: a.date,
        days:  a.days,
        "Route A": a.avg_price,
        "Route B": result.route_b_prices[i]?.avg_price ?? null,
      }))
    : [];

  const breakdownRows = KEY_DAYS.map((d) => {
    const a = result?.route_a_prices.find((p) => p.days === d);
    const b = result?.route_b_prices.find((p) => p.days === d);
    return { days: d, priceA: a?.avg_price, priceB: b?.avg_price };
  }).filter((r) => r.priceA !== undefined);

  const winnerLabel = result
    ? result.cheaper_route === "A" ? result.route_a_label : result.route_b_label
    : "";

  const renderForm = (idx: number, form: RouteForm, setForm: (f: RouteForm) => void) => (
    <div className={`glass-card p-5 border-t-2 ${idx === 0 ? "border-brand-green" : "border-brand-blue"}`}>
      <h3 className={`text-sm font-semibold mb-4 ${idx === 0 ? "text-brand-green" : "text-brand-blue"}`}>
        Route {idx === 0 ? "A" : "B"}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>From</label>
          <select className={inputClass} value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>To</label>
          <select className={inputClass} value={form.destination}
            onChange={(e) => setForm({ ...form, destination: e.target.value })}>
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Airline</label>
          <select className={inputClass} value={form.airline}
            onChange={(e) => setForm({ ...form, airline: e.target.value })}>
            {AIRLINES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Class</label>
          <select className={inputClass} value={form.flight_class}
            onChange={(e) => setForm({ ...form, flight_class: e.target.value })}>
            <option value="economy">Economy</option>
            <option value="business">Business</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Compare Routes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ML-powered price comparison — see which route is cheaper at every booking window
        </p>
      </motion.div>

      {/* Route pickers */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {renderForm(0, routeA, setRouteA)}
        {renderForm(1, routeB, setRouteB)}
      </motion.div>

      {/* Compare button */}
      <motion.button
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.14 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleCompare}
        disabled={mutation.isPending}
        className="flex items-center gap-2 px-7 py-3 rounded-xl bg-brand-green hover:bg-brand-green-dark text-surface font-semibold text-sm transition disabled:opacity-60 shadow-lg shadow-brand-green/20"
      >
        {mutation.isPending
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <GitCompare className="w-4 h-4" />}
        Compare Now
      </motion.button>

      {/* ── Results ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* Winner Banner */}
            <div className={`rounded-xl p-5 border flex items-center gap-4 ${
              result.cheaper_route === "A"
                ? "bg-brand-green/10 border-brand-green/30"
                : "bg-brand-blue/10 border-brand-blue/30"
            }`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                result.cheaper_route === "A" ? "bg-brand-green/20" : "bg-brand-blue/20"
              }`}>
                <Trophy className={`w-6 h-6 ${result.cheaper_route === "A" ? "text-brand-green" : "text-brand-blue"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Better Deal</p>
                <p className="text-foreground font-bold truncate">Route {result.cheaper_route} &mdash; {winnerLabel}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Saves you{" "}
                  <span className="text-brand-green font-semibold">{formatPrice(result.savings)}</span>
                  {" "}on average · book{" "}
                  {result.cheaper_route === "A" ? result.best_booking_days_a : result.best_booking_days_b} days
                  {" "}ahead for the lowest fare
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Avg difference</p>
                <p className={`text-2xl font-bold ${result.difference_pct > 0 ? "text-brand-red" : "text-brand-green"}`}>
                  {result.difference_pct > 0 ? "+" : ""}{result.difference_pct.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Price cards */}
            <div className="grid grid-cols-2 gap-4">
              {/* Route A */}
              <div className={`glass-card p-5 border-t-2 ${result.cheaper_route === "A" ? "border-brand-green" : "border-surface-tertiary"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-brand-green uppercase tracking-wide">Route A</span>
                  {result.cheaper_route === "A" && (
                    <span className="flex items-center gap-1 text-xs text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Best value
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mb-3">{result.route_a_label}</p>
                <div className="flex items-end gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Price</p>
                    <p className="text-3xl font-bold text-foreground">{formatPrice(result.route_a_avg)}</p>
                  </div>
                  <div className="pb-1">
                    <p className="text-xs text-muted-foreground">Min</p>
                    <p className="text-sm font-semibold text-brand-green">{formatPrice(result.route_a_min)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  Book <span className="text-foreground font-medium">{result.best_booking_days_a} days</span> ahead for best fare
                </div>
              </div>

              {/* Route B */}
              <div className={`glass-card p-5 border-t-2 ${result.cheaper_route === "B" ? "border-brand-blue" : "border-surface-tertiary"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-brand-blue uppercase tracking-wide">Route B</span>
                  {result.cheaper_route === "B" && (
                    <span className="flex items-center gap-1 text-xs text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Best value
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mb-3">{result.route_b_label}</p>
                <div className="flex items-end gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Price</p>
                    <p className="text-3xl font-bold text-foreground">{formatPrice(result.route_b_avg)}</p>
                  </div>
                  <div className="pb-1">
                    <p className="text-xs text-muted-foreground">Min</p>
                    <p className="text-sm font-semibold text-brand-blue">{formatPrice(result.route_b_min)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  Book <span className="text-foreground font-medium">{result.best_booking_days_b} days</span> ahead for best fare
                </div>
              </div>
            </div>

            {/* Price Trend Chart */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-semibold text-foreground">Price vs. Days Until Departure</h2>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" /> ML-predicted — earlier booking = lower fare
                </span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} />
                  <YAxis
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    tickLine={false} axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: "#242938", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}
                    formatter={(v: number, name: string) => [`₹${v.toLocaleString("en-IN")}`, name]}
                  />
                  <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
                  <Line type="monotone" dataKey="Route A" stroke="#00d09c" dot={false} strokeWidth={2.5}
                    name={`Route A (${routeA.airline})`} />
                  <Line type="monotone" dataKey="Route B" stroke="#3b82f6" dot={false} strokeWidth={2.5}
                    strokeDasharray="5 3" name={`Route B (${routeB.airline})`} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Breakdown Table */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Price Breakdown by Booking Window</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                      <th className="pb-2 pr-4">Days Before Flight</th>
                      <th className="pb-2 pr-4 text-brand-green">Route A</th>
                      <th className="pb-2 pr-4 text-brand-blue">Route B</th>
                      <th className="pb-2">Cheaper</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {breakdownRows.map(({ days, priceA, priceB }) => {
                      const cheaper =
                        priceA !== undefined && priceB !== undefined
                          ? priceA <= priceB ? "A" : "B"
                          : null;
                      return (
                        <tr key={days} className="hover:bg-surface-secondary/40 transition-colors">
                          <td className="py-2.5 pr-4 text-muted-foreground font-medium">
                            {days === 1 ? "1 day" : `${days} days`}
                          </td>
                          <td className={`py-2.5 pr-4 font-mono ${cheaper === "A" ? "text-brand-green font-semibold" : "text-foreground"}`}>
                            {priceA !== undefined ? formatPrice(priceA) : "—"}
                          </td>
                          <td className={`py-2.5 pr-4 font-mono ${cheaper === "B" ? "text-brand-blue font-semibold" : "text-foreground"}`}>
                            {priceB !== undefined ? formatPrice(priceB) : "—"}
                          </td>
                          <td className="py-2.5">
                            {cheaper && priceA !== undefined && priceB !== undefined && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                cheaper === "A"
                                  ? "bg-brand-green/10 text-brand-green"
                                  : "bg-brand-blue/10 text-brand-blue"
                              }`}>
                                Route {cheaper} &minus;{formatPrice(Math.abs(priceA - priceB))}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recommendation */}
            <div className="glass-card p-5 border border-brand-green/10 bg-brand-green/5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-green/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Plane className="w-4 h-4 text-brand-green" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">Our Recommendation</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Based on XGBoost ML predictions,{" "}
                    <span className="text-foreground font-medium">{winnerLabel}</span> is the better
                    deal — averaging{" "}
                    <span className="text-brand-green font-semibold">
                      {formatPrice(result.cheaper_route === "A" ? result.route_a_avg : result.route_b_avg)}
                    </span>{" "}
                    vs{" "}
                    <span className="text-brand-red font-semibold">
                      {formatPrice(result.cheaper_route === "A" ? result.route_b_avg : result.route_a_avg)}
                    </span>
                    . You save{" "}
                    <span className="text-brand-green font-semibold">{formatPrice(result.savings)}</span>.
                    {" "}Book{" "}
                    <span className="text-foreground font-medium">
                      {result.cheaper_route === "A" ? result.best_booking_days_a : result.best_booking_days_b} days
                    </span>{" "}
                    before departure to lock in the lowest predicted fare.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
