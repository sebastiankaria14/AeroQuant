"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2, TrendingUp, Info, Brain, ShoppingCart } from "lucide-react";
import { predictPriceV2, PredictionInput, PredictionOutputV2 } from "@/lib/api";
import { formatPriceFull } from "@/lib/utils";
import toast from "react-hot-toast";
import { BuyWaitCard } from "@/components/ui/BuyWaitCard";
import { ShapChart } from "@/components/charts/ShapChart";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const AIRLINES = ["Air India", "IndiGo", "SpiceJet", "Vistara", "GO FIRST", "AirAsia"];
const CITIES = ["Delhi", "Mumbai", "Bangalore", "Hyderabad", "Kolkata", "Chennai"];
const STOPS = ["non-stop", "1-stop", "2+-stop"];
const TIME_OPTIONS = [
  "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00",
];

const inputClass =
  "w-full px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-green/50 transition";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide";

function PredictionContent() {
  const searchParams = useSearchParams();

  const [form, setForm] = useState<PredictionInput>({
    airline: "IndiGo",
    source: "Delhi",
    destination: "Mumbai",
    stops: "non-stop",
    days_until_departure: 30,
    dep_time: "10:00",
    flight_class: "economy",
  });

  useEffect(() => {
    const src = searchParams.get("source");
    const dst = searchParams.get("destination");
    if (src || dst) {
      setForm((f) => ({
        ...f,
        ...(src && CITIES.includes(src) ? { source: src } : {}),
        ...(dst && CITIES.includes(dst) ? { destination: dst } : {}),
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [result, setResult] = useState<PredictionOutputV2 | null>(null);
  const [activeTab, setActiveTab] = useState<"result" | "explain">("result");

  const mutation = useMutation({
    mutationFn: predictPriceV2,
    onSuccess: (data) => {
      setResult(data);
      setActiveTab("result");
      toast.success("Prediction complete!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const set = (key: keyof PredictionInput, val: string | number) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.source === form.destination) {
      toast.error("Source and destination cannot be the same.");
      return;
    }
    mutation.mutate(form);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Price Prediction</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ML-powered fare forecasting with Buy/Wait intelligence & SHAP explainability
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Form ─────────────────────────────────────────────────────── */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 glass-card p-6 space-y-5"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Airline</label>
              <select className={inputClass} value={form.airline} onChange={(e) => set("airline", e.target.value)}>
                {AIRLINES.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Class</label>
              <select className={inputClass} value={form.flight_class} onChange={(e) => set("flight_class", e.target.value)}>
                <option value="economy">Economy</option>
                <option value="business">Business</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>From</label>
              <select className={inputClass} value={form.source} onChange={(e) => set("source", e.target.value)}>
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>To</label>
              <select className={inputClass} value={form.destination} onChange={(e) => set("destination", e.target.value)}>
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Stops</label>
              <select className={inputClass} value={form.stops} onChange={(e) => set("stops", e.target.value)}>
                {STOPS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Departure Time</label>
              <select className={inputClass} value={form.dep_time} onChange={(e) => set("dep_time", e.target.value)}>
                {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Days Until Departure: <span className="text-brand-green">{form.days_until_departure}</span>
            </label>
            <input
              type="range"
              min={1}
              max={365}
              value={form.days_until_departure}
              onChange={(e) => set("days_until_departure", parseInt(e.target.value))}
              className="w-full accent-brand-green"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1 day</span>
              <span>1 year</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-3 rounded-xl bg-brand-green hover:bg-brand-green-dark text-surface font-semibold text-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {mutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Predicting…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Predict Price</>
            )}
          </button>
        </motion.form>

        {/* ── Result panel ──────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Price hero */}
                <div className="glass-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-brand-green" />
                      <h2 className="font-semibold text-foreground">Predicted Fare</h2>
                    </div>
                    <span className="text-xs bg-surface-tertiary text-muted-foreground rounded-full px-2 py-0.5 capitalize">
                      {result.model_used}
                    </span>
                  </div>

                  <div className="text-center py-2">
                    <motion.p
                      key={result.predicted_price}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-5xl font-bold text-foreground font-mono"
                    >
                      {formatPriceFull(result.predicted_price)}
                    </motion.p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {result.input_echo.airline} · {result.input_echo.source} → {result.input_echo.destination} · {result.input_echo.flight_class}
                    </p>
                    <div className="flex items-center gap-2 justify-center mt-2 text-xs text-muted-foreground">
                      <span className="text-brand-green">{formatPriceFull(result.confidence_lower)}</span>
                      <span className="text-muted-foreground/50">–</span>
                      <span className="text-red-400">{formatPriceFull(result.confidence_upper)}</span>
                      <span className="text-[10px]">(CI)</span>
                    </div>
                  </div>
                </div>

                {/* Tab bar */}
                <div className="flex gap-1 bg-surface-secondary p-1 rounded-xl">
                  {[
                    { id: "result", label: "Buy/Wait", icon: ShoppingCart },
                    { id: "explain", label: "AI Explain (SHAP)", icon: Brain },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id as typeof activeTab)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
                        activeTab === id
                          ? "bg-surface text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <AnimatePresence mode="wait">
                  {activeTab === "result" ? (
                    <motion.div key="bw" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <BuyWaitCard data={result.buy_wait} />
                    </motion.div>
                  ) : (
                    <motion.div key="shap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="glass-card p-5"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <Brain className="w-4 h-4 text-brand-green" />
                        <h3 className="text-sm font-semibold text-foreground">Feature Importance (SHAP)</h3>
                      </div>
                      <ShapChart
                        features={result.explain.top_features}
                        baseValue={result.explain.base_value}
                        predictedPrice={result.predicted_price}
                        summary={result.explain.summary}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-8 flex flex-col items-center justify-center text-center gap-4"
              >
                <Sparkles className="w-12 h-12 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-medium text-foreground">Awaiting prediction</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Configure your flight and click <span className="text-brand-green">Predict Price</span>
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 w-full max-w-xs text-xs text-muted-foreground">
                  {[["Buy/Wait", "Intelligence engine"], ["SHAP", "Explainability"], ["CI", "Confidence range"]].map(([t, s]) => (
                    <div key={t} className="bg-surface-secondary rounded-lg p-2 text-center">
                      <p className="font-semibold text-brand-green">{t}</p>
                      <p className="text-[10px] mt-0.5">{s}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function PredictionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading…</div>}>
      <PredictionContent />
    </Suspense>
  );
}
