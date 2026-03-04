"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  BookmarkCheck,
  GitCompare,
  LayoutDashboard,
  Sparkles,
  TrendingUp,
  Settings,
  ShieldCheck,
  LineChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    group: "Menu",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Prediction", href: "/prediction", icon: Sparkles },
      { label: "Forecast", href: "/forecast", icon: LineChart },
      { label: "Compare", href: "/compare", icon: GitCompare },
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Watchlist", href: "/watchlist", icon: BookmarkCheck },
    ],
  },
  {
    group: "Account",
    items: [
      { label: "Admin", href: "/admin", icon: ShieldCheck },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-surface border-r border-border/50 overflow-y-auto custom-scroll">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-6 border-b border-border/50">
        <div className="w-8 h-8 rounded-lg bg-brand-green flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-surface" />
        </div>
        <span className="text-lg font-bold text-foreground tracking-tight">
          Aero<span className="text-brand-green">Quant</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-6">
        {NAV_ITEMS.map((group) => (
          <div key={group.group}>
            <p className="px-2 mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ label, href, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <li key={href}>
                    <Link href={href}>
                      <motion.span
                        whileHover={{ x: 2 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative",
                          active
                            ? "bg-brand-green/10 text-brand-green"
                            : "text-muted-foreground hover:text-foreground hover:bg-surface-tertiary"
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="sidebar-pill"
                            className="absolute inset-0 bg-brand-green/10 rounded-lg border border-brand-green/20"
                          />
                        )}
                        <Icon className="w-4 h-4 shrink-0 relative z-10" />
                        <span className="relative z-10">{label}</span>
                      </motion.span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer tag */}
      <div className="px-5 py-4 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          ML-powered · v2.0.0
        </p>
      </div>
    </aside>
  );
}
