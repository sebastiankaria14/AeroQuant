"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Bell, ShieldCheck, Info, ChevronRight, Check, LineChart, Brain } from "lucide-react";
import toast from "react-hot-toast";

const sectionClass = "glass-card p-5 space-y-4";
const labelClass   = "text-sm font-medium text-foreground";
const subClass     = "text-xs text-muted-foreground mt-0.5";

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
        value ? "bg-brand-green" : "bg-surface-tertiary border border-border"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
          value ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SettingRow({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className={labelClass}>{label}</p>
        {sub && <p className={subClass}>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    priceAlerts: true,
    weeklyDigest: false,
    newRoutes: true,
  });

  const [display, setDisplay] = useState({
    compactMode: false,
    showConfidenceIntervals: true,
    currencyINR: true,
  });

  const [ml, setMl] = useState({
    autoRefreshPredictions: false,
    showModelName: true,
    showShapExplain: true,
    showBuyWait: true,
  });

  const [forecast, setForecast] = useState({
    defaultHorizon: "30" as "30" | "60",
    defaultClass: "Economy" as "Economy" | "Business",
    showConfidenceBands: true,
  });

  const saved = () => toast.success("Settings saved");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-green" />
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Manage preferences and application behaviour</p>
      </motion.div>

      {/* Notifications */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className={sectionClass}
      >
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-brand-orange" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Notifications</h2>
        </div>

        <SettingRow label="Price Alerts" sub="Notify when watchlist routes drop below alert price">
          <Toggle value={notifications.priceAlerts} onChange={(v) => setNotifications({ ...notifications, priceAlerts: v })} />
        </SettingRow>

        <div className="border-t border-border/50" />

        <SettingRow label="Weekly Market Digest" sub="Summary of price trends every Monday">
          <Toggle value={notifications.weeklyDigest} onChange={(v) => setNotifications({ ...notifications, weeklyDigest: v })} />
        </SettingRow>

        <div className="border-t border-border/50" />

        <SettingRow label="New Route Alerts" sub="Get notified when new routes are added">
          <Toggle value={notifications.newRoutes} onChange={(v) => setNotifications({ ...notifications, newRoutes: v })} />
        </SettingRow>
      </motion.section>

      {/* Display */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className={sectionClass}
      >
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-brand-blue" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Display</h2>
        </div>

        <SettingRow label="Compact Mode" sub="Reduce padding and chart heights">
          <Toggle value={display.compactMode} onChange={(v) => setDisplay({ ...display, compactMode: v })} />
        </SettingRow>

        <div className="border-t border-border/50" />

        <SettingRow label="Show Confidence Intervals" sub="Display ML prediction bands on charts">
          <Toggle value={display.showConfidenceIntervals} onChange={(v) => setDisplay({ ...display, showConfidenceIntervals: v })} />
        </SettingRow>

        <div className="border-t border-border/50" />

        <SettingRow label="Currency" sub="Prices displayed in">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-secondary border border-border text-sm font-medium text-foreground">
            <Check className="w-3 h-3 text-brand-green" />
            INR ₹
          </span>
        </SettingRow>
      </motion.section>

      {/* ML Settings */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className={sectionClass}
      >
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-brand-purple" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Model &amp; Prediction</h2>
        </div>

        <SettingRow label="Auto-Refresh Predictions" sub="Re-run predictions every 15 minutes">
          <Toggle value={ml.autoRefreshPredictions} onChange={(v) => setMl({ ...ml, autoRefreshPredictions: v })} />
        </SettingRow>

        <div className="border-t border-border/50" />

        <SettingRow label="Show Model Name" sub="Display which model generated each prediction">
          <Toggle value={ml.showModelName} onChange={(v) => setMl({ ...ml, showModelName: v })} />
        </SettingRow>

        <div className="border-t border-border/50" />

        <SettingRow label="SHAP Explanations" sub="Show feature-level AI explainability after each prediction">
          <Toggle value={ml.showShapExplain} onChange={(v) => setMl({ ...ml, showShapExplain: v })} />
        </SettingRow>

        <div className="border-t border-border/50" />

        <SettingRow label="Buy / Wait Recommendation" sub="Show Buy or Wait card with confidence score">
          <Toggle value={ml.showBuyWait} onChange={(v) => setMl({ ...ml, showBuyWait: v })} />
        </SettingRow>
      </motion.section>

      {/* Forecast Settings */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.19 }}
        className={sectionClass}
      >
        <div className="flex items-center gap-2 mb-2">
          <LineChart className="w-4 h-4 text-brand-green" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Forecast</h2>
        </div>

        <SettingRow label="Default Horizon" sub="Days ahead when opening the Forecast page">
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(["30", "60"] as const).map((h) => (
              <button
                key={h}
                onClick={() => setForecast({ ...forecast, defaultHorizon: h })}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  forecast.defaultHorizon === h
                    ? "bg-brand-green text-surface"
                    : "bg-surface-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {h}d
              </button>
            ))}
          </div>
        </SettingRow>

        <div className="border-t border-border/50" />

        <SettingRow label="Default Class" sub="Economy or Business shown by default">
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(["Economy", "Business"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setForecast({ ...forecast, defaultClass: c })}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  forecast.defaultClass === c
                    ? "bg-brand-green text-surface"
                    : "bg-surface-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </SettingRow>

        <div className="border-t border-border/50" />

        <SettingRow label="Confidence Bands" sub="Show upper/lower confidence interval shading on forecast chart">
          <Toggle value={forecast.showConfidenceBands} onChange={(v) => setForecast({ ...forecast, showConfidenceBands: v })} />
        </SettingRow>
      </motion.section>

      {/* About */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={sectionClass}
      >
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2">About</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Version", value: "2.0.0" },
            { label: "ML Models", value: "XGBoost + LightGBM" },
            { label: "Dataset", value: "300,153 flights" },
            { label: "Forecast", value: "Prophet" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface-secondary rounded-xl p-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xs font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary hover:bg-surface-tertiary transition"
        >
          <div>
            <p className="text-sm font-medium text-foreground">API Reference</p>
            <p className="text-xs text-muted-foreground">localhost:8000/docs</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </a>
      </motion.section>

      {/* Save */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.24 }}
        className="flex justify-end"
      >
        <button
          onClick={saved}
          className="px-6 py-2.5 rounded-lg bg-brand-green hover:bg-brand-green-dark text-surface font-semibold text-sm transition"
        >
          Save Preferences
        </button>
      </motion.div>
    </div>
  );
}
