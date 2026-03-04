"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookmarkCheck, Plus, Trash2, Bell, BellOff, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { fetchWatchlist, addToWatchlist, removeFromWatchlist, checkWatchlistAlerts } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

const AIRLINES = ["Any", "Air India", "IndiGo", "SpiceJet", "Vistara", "GO FIRST", "AirAsia"];
const CITIES = ["Delhi", "Mumbai", "Bangalore", "Hyderabad", "Kolkata", "Chennai"];

const inputClass = "w-full px-3 py-2.5 rounded-lg bg-surface-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-green/50 transition";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide";

export default function WatchlistPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    source: "Delhi",
    destination: "Mumbai",
    airline: "IndiGo",
    flight_class: "economy",
    alert_price: "",
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: fetchWatchlist,
    retry: 1,
  });

  // Check triggered alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ["watchlist-alerts"],
    queryFn: checkWatchlistAlerts,
    retry: 1,
    refetchInterval: 60_000,
    enabled: items.length > 0,
  });

  // Show toast per triggered alert (only once per session)
  useEffect(() => {
    if (alerts.length === 0) return;
    alerts.forEach((a) => {
      toast(
        `\u26a0\ufe0f Alert: ${a.source} \u2192 ${a.destination} — \u20b9${a.predicted_price.toLocaleString("en-IN")} (below \u20b9${a.alert_price.toLocaleString("en-IN")})`,
        { icon: "\uD83D\uDD14", duration: 6000 }
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.length]);

  const triggeredIds = new Set(alerts.map((a) => a.watchlist_id));

  const addMutation = useMutation({
    mutationFn: (payload: Parameters<typeof addToWatchlist>[0]) => addToWatchlist(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      toast.success("Added to watchlist!");
      setShowForm(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: removeFromWatchlist,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      toast.success("Removed from watchlist");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.source === form.destination) {
      toast.error("Source and destination can't be the same");
      return;
    }
    addMutation.mutate({
      source: form.source,
      destination: form.destination,
      airline: form.airline === "Any" ? null : form.airline,
      flight_class: form.flight_class,
      alert_price: form.alert_price ? parseFloat(form.alert_price) : null,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Watchlist</h1>
          <p className="text-sm text-muted-foreground mt-1">Track routes and get alerted on price drops</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-green hover:bg-brand-green-dark text-surface font-semibold text-sm transition"
        >
          <Plus className="w-4 h-4" />
          Add Route
        </motion.button>
      </motion.div>

      {/* Add Route Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            onSubmit={handleAdd}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-5 overflow-hidden"
          >
            <h2 className="text-sm font-semibold text-foreground mb-4">New Watchlist Entry</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>From</label>
                <select className={inputClass} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>To</label>
                <select className={inputClass} value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Airline</label>
                <select className={inputClass} value={form.airline} onChange={(e) => setForm({ ...form, airline: e.target.value })}>
                  {AIRLINES.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Class</label>
                <select className={inputClass} value={form.flight_class} onChange={(e) => setForm({ ...form, flight_class: e.target.value })}>
                  <option value="economy">Economy</option>
                  <option value="business">Business</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Alert Price (₹, optional)</label>
                <input
                  type="number"
                  placeholder="e.g. 8000"
                  className={inputClass}
                  value={form.alert_price}
                  onChange={(e) => setForm({ ...form, alert_price: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={addMutation.isPending}
                className="px-5 py-2 rounded-lg bg-brand-green hover:bg-brand-green-dark text-surface font-semibold text-sm transition disabled:opacity-60"
              >
                {addMutation.isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-lg bg-surface-secondary hover:bg-surface-tertiary text-foreground text-sm transition"
              >
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Watchlist items */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-12 flex flex-col items-center gap-3 text-center"
        >
          <BookmarkCheck className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">Your watchlist is empty.<br />Add routes to start tracking prices.</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-4 flex items-center gap-4"
              >
                <div className="w-9 h-9 rounded-lg bg-brand-green/10 border border-brand-green/20 flex items-center justify-center shrink-0">
                  <BookmarkCheck className="w-4 h-4 text-brand-green" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm">
                      {item.source} → {item.destination}
                    </p>
                    {triggeredIds.has(item.id) && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-red/15 border border-brand-red/30 text-xs text-brand-red font-semibold">
                        <AlertTriangle className="w-3 h-3" />
                        ALERT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.airline ?? "Any airline"} · <span className="capitalize">{item.flight_class}</span>
                  </p>
                </div>

                {item.alert_price && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-brand-orange/10 border border-brand-orange/20 text-xs text-brand-orange">
                    {item.is_alert_active ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                    Alert: {formatPrice(item.alert_price)}
                  </div>
                )}

                <button
                  onClick={() => removeMutation.mutate(item.id)}
                  disabled={removeMutation.isPending}
                  className="p-2 rounded-lg text-muted-foreground hover:text-brand-red hover:bg-brand-red/10 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
