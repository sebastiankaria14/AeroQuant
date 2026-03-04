"use client";

import { formatPrice } from "@/lib/utils";
import { TopRouteItem } from "@/lib/api";

interface RouteTableProps {
  rows: TopRouteItem[];
  loading?: boolean;
}

export function RouteTable({ rows, loading }: RouteTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
            <th className="pb-2 pr-4">#</th>
            <th className="pb-2 pr-4">Route</th>
            <th className="pb-2 pr-4">Airline Class</th>
            <th className="pb-2 pr-4 text-right">Avg Fare</th>
            <th className="pb-2 text-right">Samples</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {rows.map((r, i) => (
            <tr
              key={`${r.source}-${r.destination}-${i}`}
              className="text-foreground hover:bg-surface-secondary/40 transition-colors"
            >
              <td className="py-2.5 pr-4 text-muted-foreground font-mono text-xs">{i + 1}</td>
              <td className="py-2.5 pr-4 font-medium">
                {r.source} <span className="text-muted-foreground">→</span> {r.destination}
              </td>
              <td className="py-2.5 pr-4">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  r.flight_class === "business"
                    ? "bg-brand-purple/10 text-brand-purple border border-brand-purple/20"
                    : "bg-brand-blue/10 text-brand-blue border border-brand-blue/20"
                }`}>
                  {r.flight_class}
                </span>
              </td>
              <td className="py-2.5 pr-4 text-right font-mono font-semibold text-brand-green">
                {formatPrice(r.avg_price)}
              </td>
              <td className="py-2.5 text-right text-muted-foreground text-xs">
                {r.sample_count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8">No route data available</p>
      )}
    </div>
  );
}
