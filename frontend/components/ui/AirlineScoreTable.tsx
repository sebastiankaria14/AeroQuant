"use client";

import { motion } from "framer-motion";
import { AirlineScore } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

interface Props {
  airlines: AirlineScore[];
}

const BEST_FOR_COLORS: Record<string, string> = {
  Budget:  "bg-brand-green/15 text-brand-green",
  Stable:  "bg-blue-400/15 text-blue-400",
  Premium: "bg-purple-400/15 text-purple-400",
};

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 8 ? "#00d09c" : score >= 6 ? "#f59e0b" : "#ef4444";
  return (
    <div className="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

export function AirlineScoreTable({ airlines }: Props) {
  return (
    <div className="space-y-3">
      {airlines.map((a, i) => (
        <motion.div
          key={a.airline}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-4 p-3 rounded-xl bg-surface-secondary border border-border hover:border-brand-green/20 transition-colors"
        >
          {/* Rank */}
          <div className="w-6 h-6 rounded-full bg-surface-tertiary flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
            {i + 1}
          </div>

          {/* Airline name */}
          <div className="w-24 shrink-0">
            <p className="text-sm font-medium text-foreground truncate">{a.airline}</p>
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", BEST_FOR_COLORS[a.best_for] ?? "bg-surface-tertiary text-muted-foreground")}>
              {a.best_for}
            </span>
          </div>

          {/* Score */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-sm font-bold text-foreground">{a.overall_score.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">/10</span>
              </div>
              <span className="text-xs text-muted-foreground">{formatPrice(a.avg_price)}</span>
            </div>
            <ScoreBar score={a.overall_score} />
          </div>

          {/* Stability + Spikes */}
          <div className="hidden sm:grid grid-cols-2 gap-3 text-xs shrink-0">
            <div className="text-center">
              <p className="text-muted-foreground">Stability</p>
              <p className="font-semibold text-foreground">{(a.price_stability * 100).toFixed(0)}%</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Spikes</p>
              <p className="font-semibold text-foreground">{(a.spike_frequency * 100).toFixed(0)}%</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
