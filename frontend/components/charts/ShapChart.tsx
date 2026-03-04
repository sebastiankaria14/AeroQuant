"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { ShapFeature } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface Props {
  features: ShapFeature[];
  baseValue: number;
  predictedPrice: number;
  summary: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as ShapFeature;
    return (
      <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
        <p className="font-semibold text-foreground">{d.feature}</p>
        <p className="text-muted-foreground">Value: {String(d.value)}</p>
        <p className={d.shap_value >= 0 ? "text-red-400" : "text-brand-green"}>
          Impact: {d.shap_value >= 0 ? "+" : ""}₹{d.shap_value.toFixed(0)}
        </p>
      </div>
    );
  }
  return null;
};

export function ShapChart({ features, baseValue, predictedPrice, summary }: Props) {
  const data = [...features].sort((a, b) => b.shap_value - a.shap_value);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Base price: <span className="text-foreground font-medium">{formatPrice(baseValue)}</span></span>
        <span>Predicted: <span className="text-brand-green font-semibold">{formatPrice(predictedPrice)}</span></span>
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 80, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "#8a8aaa" }}
              tickFormatter={(v) => `₹${v}`}
            />
            <YAxis
              type="category"
              dataKey="feature"
              tick={{ fontSize: 11, fill: "#c0c0d0" }}
              width={78}
            />
            <ReferenceLine x={0} stroke="#4a4a6a" strokeDasharray="4 2" />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="shap_value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.shap_value >= 0 ? "#ef4444" : "#00d09c"}
                  opacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-muted-foreground bg-surface-secondary rounded-lg px-3 py-2 border border-border">
        <span className="text-foreground font-medium">AI Insight: </span>{summary}
      </p>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-400 opacity-85" />
          Increases price
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-brand-green opacity-85" />
          Decreases price
        </span>
      </div>
    </div>
  );
}
