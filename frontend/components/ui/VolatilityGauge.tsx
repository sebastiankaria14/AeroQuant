"use client";

import { cn } from "@/lib/utils";

interface Props {
  score: number;          // 0-100
  label: string;
  size?: "sm" | "md" | "lg";
}

const STOPS = [
  { pct: 0, color: "#00d09c" },
  { pct: 30, color: "#00d09c" },
  { pct: 60, color: "#f59e0b" },
  { pct: 100, color: "#ef4444" },
];

function interpolateColor(score: number) {
  if (score <= 30) return "#00d09c";
  if (score <= 60) return "#f59e0b";
  return "#ef4444";
}

export function VolatilityGauge({ score, label, size = "md" }: Props) {
  const angle = -135 + (score / 100) * 270;  // arc from -135° to +135°
  const color = interpolateColor(score);

  const sz = size === "sm" ? 80 : size === "lg" ? 140 : 110;
  const cx = sz / 2;
  const cy = sz / 2;
  const r = sz * 0.38;
  const strokeW = size === "sm" ? 6 : 8;

  // Helper to compute arc path
  function polarToCartesian(angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function describeArc(startAngle: number, endAngle: number) {
    const start = polarToCartesian(endAngle);
    const end = polarToCartesian(startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }

  const bgPath = describeArc(-135 + 90, 135 + 90);    // full 270° bg arc
  const fgPath = describeArc(-135 + 90, angle + 90);  // filled portion

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={sz} height={sz * 0.75} viewBox={`0 0 ${sz} ${sz}`} style={{ overflow: "visible" }}>
        {/* Background track */}
        <path d={bgPath} fill="none" stroke="#2a2a3a" strokeWidth={strokeW} strokeLinecap="round" />
        {/* Filled arc */}
        {score > 0 && (
          <path d={fgPath} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color}60)` }} />
        )}
        {/* Needle dot */}
        {(() => {
          const np = polarToCartesian(angle + 90);
          return <circle cx={np.x} cy={np.y} r={strokeW / 2 + 1} fill={color} />;
        })()}
        {/* Score text */}
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize={size === "sm" ? 14 : 18} fontWeight="700" fill={color}>
          {score.toFixed(0)}
        </text>
      </svg>

      {/* Labels */}
      <div className="flex justify-between w-full px-2 -mt-1">
        <span className="text-[10px] text-brand-green">Stable</span>
        <span className="text-[10px] text-muted-foreground">Moderate</span>
        <span className="text-[10px] text-red-400">Volatile</span>
      </div>

      <span
        className={cn(
          "text-xs font-semibold px-2 py-0.5 rounded-full",
          score <= 30 ? "bg-brand-green/15 text-brand-green" :
          score <= 60 ? "bg-yellow-400/15 text-yellow-400" :
          "bg-red-400/15 text-red-400"
        )}
      >
        {label}
      </span>
    </div>
  );
}
