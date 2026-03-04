"use client";

import { motion } from "framer-motion";
import { ModelMetrics } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

interface Props {
  models: ModelMetrics[];
}

function MetricBadge({ value, lower = false, unit = "" }: { value: number | null; lower?: boolean; unit?: string }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
  return <span className={cn("text-sm font-semibold", lower ? "text-foreground" : "text-foreground")}>{value.toFixed(lower ? 0 : 4)}{unit}</span>;
}

export function ModelComparisonTable({ models }: Props) {
  if (!models.length) return (
    <p className="text-sm text-muted-foreground text-center py-4">No model metrics available yet. Run training to populate.</p>
  );

  const sorted = [...models].sort((a, b) => (a.rmse ?? 9999) - (b.rmse ?? 9999));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {["Model", "RMSE", "MAE", "R²", "MAPE", "Status"].map((h) => (
              <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((m, i) => (
            <motion.tr
              key={m.model_name}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "transition-colors hover:bg-surface-secondary",
                m.is_best && "bg-brand-green/5"
              )}
            >
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  {m.is_best && <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                  <span className={cn("font-medium", m.is_best ? "text-brand-green" : "text-foreground")}>
                    {m.model_name}
                  </span>
                </div>
              </td>
              <td className="px-3 py-3"><MetricBadge value={m.rmse} lower unit="₹" /></td>
              <td className="px-3 py-3"><MetricBadge value={m.mae} lower unit="₹" /></td>
              <td className="px-3 py-3">
                <span className={cn("font-semibold text-sm", (m.r2 ?? 0) >= 0.9 ? "text-brand-green" : (m.r2 ?? 0) >= 0.7 ? "text-yellow-400" : "text-red-400")}>
                  {m.r2 !== null ? m.r2.toFixed(4) : "—"}
                </span>
              </td>
              <td className="px-3 py-3"><MetricBadge value={m.mape} lower={false} unit="%" /></td>
              <td className="px-3 py-3">
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  m.is_best ? "bg-brand-green/15 text-brand-green" : "bg-surface-tertiary text-muted-foreground"
                )}>
                  {m.is_best ? "BEST" : "compared"}
                </span>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
