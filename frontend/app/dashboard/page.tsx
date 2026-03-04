"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Activity, Plane } from "lucide-react";
import { fetchSummary, fetchTopRoutes, fetchVolatility } from "@/lib/api";
import { formatPrice, formatPriceFull } from "@/lib/utils";
import { StatCard } from "@/components/ui/StatCard";
import { RouteTable } from "@/components/ui/RouteTable";
import { VolatilityBar } from "@/components/ui/VolatilityBar";
import { PriceTrendChart } from "@/components/charts/PriceTrendChart";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4 },
  }),
};

export default function DashboardPage() {
  const { data: summary, isLoading: loadingSummary, isError: summaryError } = useQuery({
    queryKey: ["summary"],
    queryFn: fetchSummary,
    retry: 1,
  });

  const { data: topRoutes = [], isLoading: loadingRoutes, isError: routesError } = useQuery({
    queryKey: ["top-routes"],
    queryFn: () => fetchTopRoutes(8),
    retry: 1,
  });

  const { data: volatility = [], isLoading: loadingVol, isError: volError } = useQuery({
    queryKey: ["volatility"],
    queryFn: () => fetchVolatility(6),
    retry: 1,
  });

  const stats = [
    {
      label: "Total Routes Tracked",
      value: summaryError ? "Error" : summary ? summary.total_routes.toLocaleString() : "—",
      icon: Plane,
      color: "brand-green",
      sub: "across all airlines",
    },
    {
      label: "Avg Economy Fare",
      value: summaryError ? "Error" : summary ? formatPrice(summary.avg_economy_price) : "—",
      icon: TrendingUp,
      color: "brand-blue",
      sub: "all routes combined",
    },
    {
      label: "Avg Business Fare",
      value: summaryError ? "Error" : summary ? formatPrice(summary.avg_business_price) : "—",
      icon: TrendingDown,
      color: "brand-purple",
      sub: "premium cabin avg",
    },
    {
      label: "Price Records",
      value: summaryError ? "Error" : summary ? summary.total_records.toLocaleString() : "—",
      icon: Activity,
      color: "brand-orange",
      sub: "predictions logged",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}>
        <h1 className="text-2xl font-bold text-foreground">Flight Market Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time price intelligence across Indian aviation routes
        </p>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial="hidden" animate="visible" custom={i + 1} variants={fadeUp}>
            <StatCard {...stat} loading={loadingSummary} />
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <motion.div className="xl:col-span-2" initial="hidden" animate="visible" custom={5} variants={fadeUp}>
          <PriceTrendChart />
        </motion.div>

        <motion.div initial="hidden" animate="visible" custom={6} variants={fadeUp} className="glass-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Price Volatility Index</h2>
          {loadingVol ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-10 w-full" />
              ))}
            </div>
          ) : volError ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <svg className="w-8 h-8 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008G12v-.008z" /></svg>
              <p className="text-xs text-muted-foreground">Backend offline</p>
            </div>
          ) : (
            <div className="space-y-3">
              {volatility.map((v) => (
                <VolatilityBar key={`${v.route}-${v.airline}`} item={v} />
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Top Routes Table */}
      <motion.div initial="hidden" animate="visible" custom={7} variants={fadeUp} className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Most Expensive Routes</h2>
          <span className="text-xs text-muted-foreground">by avg. fare (INR)</span>
        </div>
        {routesError ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <svg className="w-8 h-8 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008z" /></svg>
            <p className="text-xs text-muted-foreground">Backend offline — start server_lite.py</p>
          </div>
        ) : (
          <RouteTable rows={topRoutes} loading={loadingRoutes} />
        )}
      </motion.div>

      {/* Bottom insight bar */}
      {summary && (
        <motion.div
          initial="hidden"
          animate="visible"
          custom={8}
          variants={fadeUp}
          className="glass-card p-4 flex flex-wrap gap-6 text-sm"
        >
          <span className="text-muted-foreground">
            Cheapest Airline:{" "}
            <span className="text-brand-green font-semibold">{summary.cheapest_airline}</span>
          </span>
          <span className="text-muted-foreground">
            Most Expensive Route:{" "}
            <span className="text-brand-red font-semibold">{summary.most_expensive_route}</span>
          </span>
        </motion.div>
      )}
    </div>
  );
}
