"use client";

import { VolatilityItem } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface VolatilityBarProps {
  item: VolatilityItem;
}

const getColor = (score: number) => {
  if (score > 0.5) return "bg-brand-red";
  if (score > 0.25) return "bg-brand-orange";
  return "bg-brand-green";
};

export function VolatilityBar({ item }: VolatilityBarProps) {
  const pct = Math.min(item.volatility_score * 100, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="text-foreground font-medium truncate max-w-[60%]">{item.route}</span>
        <span className="text-muted-foreground font-mono">{item.volatility_score.toFixed(3)}</span>
      </div>
      <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${getColor(item.volatility_score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{item.airline}</span>
        <span>Range: {formatPrice(item.price_range)}</span>
      </div>
    </div>
  );
}
