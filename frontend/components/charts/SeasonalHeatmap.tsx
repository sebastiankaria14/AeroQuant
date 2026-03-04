"use client";

import { motion } from "framer-motion";
import { HeatmapCell } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props {
  cells: HeatmapCell[];
}

function heatColor(price: number, min: number, max: number): string {
  if (max === min) return "hsl(151,78%,40%)";
  const t = (price - min) / (max - min);
  // Green (low) → Yellow (mid) → Red (high)
  const r = Math.round(t < 0.5 ? t * 2 * 245 : 245);
  const g = Math.round(t < 0.5 ? 208 : (1 - t) * 2 * 208);
  const b = 60;
  return `rgb(${r},${g},${b})`;
}

export function SeasonalHeatmap({ cells }: Props) {
  if (!cells.length) return null;
  const prices = cells.map((c) => c.avg_price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
        {cells.map((cell, i) => {
          const bg = heatColor(cell.avg_price, min, max);
          const isHigh = cell.avg_price === max;
          const isLow = cell.avg_price === min;
          return (
            <motion.div
              key={cell.month}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              title={`${cell.month_label}: ${formatPrice(cell.avg_price)}`}
              className={cn(
                "relative rounded-xl p-2 cursor-default border",
                isHigh ? "border-red-400/40" : isLow ? "border-brand-green/40" : "border-transparent"
              )}
              style={{ backgroundColor: bg + "22" }}
            >
              <p className="text-xs font-semibold text-foreground text-center">{cell.month_label}</p>
              <p className="text-[10px] text-center mt-0.5 font-medium whitespace-nowrap"
                style={{ color: bg }}>
                ₹{(cell.avg_price / 1000).toFixed(1)}k
              </p>
              {isHigh && <span className="absolute -top-1 -right-1 text-[8px] bg-red-400 text-white rounded-full w-3 h-3 flex items-center justify-center">↑</span>}
              {isLow  && <span className="absolute -top-1 -right-1 text-[8px] bg-brand-green text-surface rounded-full w-3 h-3 flex items-center justify-center">↓</span>}
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex-1 h-2 rounded-full" style={{ background: "linear-gradient(to right, rgb(0,208,156), rgb(245,208,60), rgb(245,60,60))" }} />
        <span>Low → High</span>
      </div>
    </div>
  );
}
