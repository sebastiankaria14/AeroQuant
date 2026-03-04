"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Clock, ShoppingCart, AlertTriangle } from "lucide-react";
import { BuyWaitRecommendation } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props {
  data: BuyWaitRecommendation;
  className?: string;
}

const REC_CONFIG = {
  BUY_NOW: {
    label: "Buy Now",
    icon: ShoppingCart,
    color: "text-brand-green",
    bg: "bg-brand-green/10",
    border: "border-brand-green/30",
    dot: "bg-brand-green",
  },
  WAIT: {
    label: "Wait",
    icon: Clock,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/30",
    dot: "bg-yellow-400",
  },
  NEUTRAL: {
    label: "Neutral",
    icon: Minus,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/30",
    dot: "bg-blue-400",
  },
} as const;

const VOL_COLORS = {
  Stable: "text-brand-green",
  Moderate: "text-yellow-400",
  "Highly Volatile": "text-red-400",
};

export function BuyWaitCard({ data, className }: Props) {
  const cfg = REC_CONFIG[data.recommendation] ?? REC_CONFIG.NEUTRAL;
  const Icon = cfg.icon;

  const futurePrices = [
    { label: "+5 days", price: data.price_in_5d },
    { label: "+10 days", price: data.price_in_10d },
    { label: "+30 days", price: data.price_in_30d },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("glass-card p-5 space-y-4", className)}
    >
      {/* Recommendation badge */}
      <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border", cfg.bg, cfg.border)}>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", cfg.bg)}>
          <Icon className={cn("w-5 h-5", cfg.color)} />
        </div>
        <div className="flex-1">
          <p className={cn("text-lg font-bold", cfg.color)}>{cfg.label}</p>
          <p className="text-xs text-muted-foreground">
            Confidence: {(data.confidence_score * 100).toFixed(0)}%
          </p>
        </div>
        {/* Confidence bar */}
        <div className="w-16">
          <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${data.confidence_score * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={cn("h-full rounded-full", cfg.dot)}
            />
          </div>
        </div>
      </div>

      {/* Price breakdown */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-surface-secondary rounded-lg px-3 py-2">
          <p className="text-muted-foreground">Fair Price</p>
          <p className="font-semibold text-foreground mt-0.5">{formatPrice(data.fair_price)}</p>
        </div>
        <div className="bg-surface-secondary rounded-lg px-3 py-2">
          <p className="text-muted-foreground">Market Avg</p>
          <p className="font-semibold text-foreground mt-0.5">{formatPrice(data.market_avg)}</p>
        </div>
        <div className="bg-surface-secondary rounded-lg px-3 py-2">
          <p className="text-muted-foreground">vs Fair</p>
          <p className={cn("font-semibold mt-0.5", data.price_diff_pct > 0 ? "text-red-400" : "text-brand-green")}>
            {data.price_diff_pct > 0 ? "+" : ""}{data.price_diff_pct.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Volatility */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn("w-3.5 h-3.5", VOL_COLORS[data.volatility_label as keyof typeof VOL_COLORS] ?? "text-muted-foreground")} />
          <span className="text-xs text-muted-foreground">Route Volatility</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${data.volatility_score}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                data.volatility_score <= 30 ? "bg-brand-green" :
                data.volatility_score <= 60 ? "bg-yellow-400" : "bg-red-400"
              )}
            />
          </div>
          <span className={cn("text-xs font-medium", VOL_COLORS[data.volatility_label as keyof typeof VOL_COLORS] ?? "text-muted-foreground")}>
            {data.volatility_label}
          </span>
        </div>
      </div>

      {/* Future price projections */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Price Forecast</p>
        <div className="flex gap-2">
          {futurePrices.map(({ label, price }) => {
            const isHigher = price > data.market_avg;
            return (
              <div key={label} className="flex-1 bg-surface-secondary rounded-lg px-2 py-2 text-center">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("text-xs font-semibold mt-0.5", isHigher ? "text-red-400" : "text-brand-green")}>
                  {formatPrice(price)}
                </p>
                {isHigher
                  ? <TrendingUp className="w-3 h-3 text-red-400 mx-auto mt-0.5" />
                  : <TrendingDown className="w-3 h-3 text-brand-green mx-auto mt-0.5" />
                }
              </div>
            );
          })}
        </div>
      </div>

      {/* Reasoning */}
      <p className="text-xs text-muted-foreground bg-surface-secondary rounded-lg px-3 py-2 border border-border leading-relaxed">
        {data.reasoning}
      </p>
    </motion.div>
  );
}
