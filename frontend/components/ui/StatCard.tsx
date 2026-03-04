"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  sub?: string;
  loading?: boolean;
}

const colorMap: Record<string, string> = {
  "brand-green": "text-brand-green bg-brand-green/10 border-brand-green/20",
  "brand-blue": "text-brand-blue bg-brand-blue/10 border-brand-blue/20",
  "brand-purple": "text-brand-purple bg-brand-purple/10 border-brand-purple/20",
  "brand-orange": "text-brand-orange bg-brand-orange/10 border-brand-orange/20",
};

export function StatCard({ label, value, icon: Icon, color, sub, loading }: StatCardProps) {
  const iconClass = colorMap[color] ?? "text-brand-green bg-brand-green/10 border-brand-green/20";

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate pr-2">
          {label}
        </p>
        <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", iconClass)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {loading ? (
        <div className="skeleton h-7 w-24 rounded" />
      ) : (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl font-bold text-foreground font-mono"
        >
          {value}
        </motion.p>
      )}
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
