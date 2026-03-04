"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { predictPriceV2, PredictionInput, PredictionOutputV2 } from "@/lib/api";
import { formatPriceFull } from "@/lib/utils";
import { Sliders, Loader2, RefreshCw } from "lucide-react";
import { BuyWaitCard } from "./BuyWaitCard";
import { cn } from "@/lib/utils";

const AIRLINES = ["Air India", "IndiGo", "SpiceJet", "Vistara", "GO FIRST", "AirAsia"];
const CITIES  = ["Delhi", "Mumbai", "Bangalore", "Hyderabad", "Kolkata", "Chennai"];
const STOPS   = ["non-stop", "1-stop", "2+-stop"];

const labelClass = "block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide";
const selectClass = "w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-green/50 transition";

export function PriceSimulator() {
  const [form, setForm] = useState<PredictionInput>({
    airline: "IndiGo",
    source: "Delhi",
    destination: "Mumbai",
    stops: "non-stop",
    days_until_departure: 30,
    dep_time: "10:00",
    flight_class: "economy",
  });
  const [result, setResult] = useState<PredictionOutputV2 | null>(null);

  const mutation = useMutation({
    mutationFn: predictPriceV2,
    onSuccess: setResult,
  });

  const set = useCallback(
    (key: keyof PredictionInput, val: string | number) =>
      setForm((f) => {
        const next = { ...f, [key]: val };
        if (next.source !== next.destination) mutation.mutate(next);
        return next;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Sliders className="w-4 h-4 text-brand-green" />
        <h3 className="text-sm font-semibold text-foreground">Price Simulator</h3>
        <span className="text-[10px] text-muted-foreground bg-surface-tertiary rounded-full px-2 py-0.5">Live</span>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>From</label>
          <select className={selectClass} value={form.source} onChange={(e) => set("source", e.target.value)}>
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>To</label>
          <select className={selectClass} value={form.destination} onChange={(e) => set("destination", e.target.value)}>
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Airline</label>
          <select className={selectClass} value={form.airline} onChange={(e) => set("airline", e.target.value)}>
            {AIRLINES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Class</label>
          <select className={selectClass} value={form.flight_class} onChange={(e) => set("flight_class", e.target.value)}>
            <option value="economy">Economy</option>
            <option value="business">Business</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Stops</label>
          <select className={selectClass} value={form.stops} onChange={(e) => set("stops", e.target.value)}>
            {STOPS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Days until departure: {form.days_until_departure}</label>
          <input
            type="range" min={1} max={90} step={1}
            value={form.days_until_departure}
            onChange={(e) => set("days_until_departure", Number(e.target.value))}
            className="w-full h-2 accent-brand-green cursor-pointer mt-2"
          />
        </div>
      </div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {mutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Recalculating…
          </div>
        )}
        {result && !mutation.isPending && (
          <motion.div
            key={result.predicted_price}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-foreground">{formatPriceFull(result.predicted_price)}</span>
              <span className="text-xs text-muted-foreground bg-surface-secondary rounded-full px-2 py-0.5">
                {result.model_used}
              </span>
              <span className="text-xs text-muted-foreground">
                ±{formatPriceFull(result.confidence_upper - result.predicted_price)}
              </span>
            </div>
            <BuyWaitCard data={result.buy_wait} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
