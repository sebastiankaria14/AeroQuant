"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  Plane,
  TrendingUp,
  BarChart3,
  Zap,
  GitCompare,
  LineChart,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Globe2,
} from "lucide-react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";

// ─── Fade-in helpers ─────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 0.61, 0.36, 1] } },
};
const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

function FadeSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────
const STATS = [
  { value: "95%",   label: "Prediction Accuracy",   icon: CheckCircle2 },
  { value: "10K+",  label: "Routes Analyzed",        icon: Globe2 },
  { value: "6",     label: "Airline Models",         icon: Sparkles },
  { value: "Live",  label: "Forecast Engine",        icon: Zap },
];

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: TrendingUp,
    color: "from-brand-green/20 to-brand-green/5",
    border: "border-brand-green/20",
    iconColor: "text-brand-green",
    title: "Smart Price Prediction",
    description:
      "XGBoost + LightGBM ensemble models trained on 300K+ flight records predict fares with ±7.8% MAPE.",
  },
  {
    icon: BarChart3,
    color: "from-brand-purple/20 to-brand-purple/5",
    border: "border-brand-purple/20",
    iconColor: "text-brand-purple",
    title: "Volatility Index",
    description:
      "Real-time route volatility scoring helps you identify high-risk booking windows before prices spike.",
  },
  {
    icon: LineChart,
    color: "from-brand-blue/20 to-brand-blue/5",
    border: "border-brand-blue/20",
    iconColor: "text-brand-blue",
    title: "30-Day Price Forecast",
    description:
      "ML-driven time series forecasts with confidence intervals — see where prices are heading before you commit.",
  },
  {
    icon: GitCompare,
    color: "from-brand-orange/20 to-brand-orange/5",
    border: "border-brand-orange/20",
    iconColor: "text-brand-orange",
    title: "Airline Benchmarking",
    description:
      "Side-by-side airline comparisons across price stability, route coverage, and overall value score.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-green flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-surface" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Aero<span className="text-brand-green">Quant</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#stats"    className="hover:text-foreground transition">Stats</a>
            <a href="#how"      className="hover:text-foreground transition">How it works</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-green text-surface hover:bg-brand-green-dark transition shadow-[0_0_20px_rgba(0,208,156,0.25)] hover:shadow-[0_0_28px_rgba(0,208,156,0.4)]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-0 px-6 text-center relative">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-brand-green/8 rounded-full blur-[120px]" />
          <div className="absolute top-64 left-1/4 w-[400px] h-[300px] bg-brand-blue/6 rounded-full blur-[100px]" />
          <div className="absolute top-64 right-1/4 w-[400px] h-[300px] bg-brand-purple/6 rounded-full blur-[100px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
          className="relative z-10 max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-green/10 border border-brand-green/20 text-brand-green text-xs font-medium mb-8"
          >
            <Sparkles className="w-3 h-3" />
            AI-Powered · Built for Indian Aviation
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
            className="text-[clamp(2.6rem,7vw,5.5rem)] font-extrabold leading-[1.08] tracking-tight text-foreground mb-6"
          >
            Predict Flight Prices
            <br />
            <span className="bg-gradient-to-r from-brand-green via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Intelligently
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10"
          >
            AI-powered forecasting, real-time volatility analysis, and smart
            buy&nbsp;/&nbsp;wait decisions — so you always book at the right price.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/signup"
              className="group flex items-center gap-2 px-8 py-3.5 rounded-xl bg-brand-green text-surface text-base font-semibold shadow-[0_0_30px_rgba(0,208,156,0.30)] hover:shadow-[0_0_50px_rgba(0,208,156,0.45)] hover:bg-brand-green-dark transition-all duration-300"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 rounded-xl border border-border text-base font-medium text-muted-foreground hover:text-foreground hover:border-white/20 hover:bg-surface-secondary transition-all duration-200"
            >
              Log in
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── ContainerScroll / Dashboard Preview ──────────────────────────── */}
      <section className="relative">
        <ContainerScroll
          titleComponent={
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-sm text-muted-foreground mb-4"
            >
              Trusted by analysts and frequent flyers across Indian aviation
            </motion.p>
          }
        >
          <Image
            src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1400&q=80"
            alt="Airplane wing above clouds"
            width={1400}
            height={900}
            className="w-full h-full object-cover rounded-xl"
            priority
          />
        </ContainerScroll>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section id="stats" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {STATS.map(({ value, label, icon: Icon }) => (
              <motion.div
                key={label}
                variants={fadeUp}
                className="glass-card p-6 text-center group hover:border-brand-green/30 transition-colors"
              >
                <Icon className="w-5 h-5 text-brand-green mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <p className="text-3xl font-extrabold text-foreground tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-6 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-purple/5 rounded-full blur-[120px]" />
        </div>
        <div className="max-w-6xl mx-auto relative z-10">
          <FadeSection className="text-center mb-16">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-green mb-3">
              Platform Features
            </p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              Everything you need to book smarter
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              From raw ML predictions to actionable recommendations — AeroQuant gives
              you the edge every time.
            </p>
          </FadeSection>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid md:grid-cols-2 gap-6"
          >
            {FEATURES.map(({ icon: Icon, color, border, iconColor, title, description }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className={`p-6 rounded-2xl border bg-gradient-to-br ${color} ${border} backdrop-blur-sm cursor-default group`}
              >
                <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center mb-4 border border-white/5 group-hover:scale-110 transition-transform">
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How it Works ─────────────────────────────────────────────────── */}
      <section id="how" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeSection className="text-center mb-16">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-green mb-3">
              How it Works
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight text-foreground">
              Three steps to your best fare
            </h2>
          </FadeSection>
          <div className="relative">
            <div className="hidden md:block absolute left-8 top-8 bottom-8 w-px bg-gradient-to-b from-brand-green/40 via-brand-blue/30 to-brand-purple/20" />
            <div className="space-y-8">
              {[
                {
                  step: "01", icon: Plane, color: "text-brand-green",
                  bg: "bg-brand-green/10 border-brand-green/20",
                  title: "Enter your route",
                  desc: "Select source, destination, airline, and travel class. Supports all major Indian routes.",
                },
                {
                  step: "02", icon: Sparkles, color: "text-brand-blue",
                  bg: "bg-brand-blue/10 border-brand-blue/20",
                  title: "Get an AI prediction",
                  desc: "Our ensemble model returns an instant price estimate with confidence bounds and a Buy/Wait recommendation.",
                },
                {
                  step: "03", icon: ShieldCheck, color: "text-brand-purple",
                  bg: "bg-brand-purple/10 border-brand-purple/20",
                  title: "Track & get alerted",
                  desc: "Add routes to your watchlist and receive alerts when prices drop below your target threshold.",
                },
              ].map(({ step, icon: Icon, color, bg, title, desc }) => (
                <FadeSection key={step}>
                  <div className="flex items-start gap-6">
                    <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center shrink-0 ${bg}`}>
                      <Icon className={`w-6 h-6 ${color}`} />
                    </div>
                    <div className="pt-2">
                      <span className="text-xs font-mono text-muted-foreground">{step}</span>
                      <h3 className="text-lg font-semibold text-foreground mt-0.5 mb-1">{title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                  </div>
                </FadeSection>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <FadeSection>
          <div className="max-w-3xl mx-auto text-center glass-card p-12 md:p-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-green/5 via-transparent to-brand-blue/5 pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-green/8 rounded-full blur-[80px] pointer-events-none" />
            <Sparkles className="w-8 h-8 text-brand-green mx-auto mb-5" />
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-4">
              Start booking at the right price
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Join analysts and frequent flyers who use AeroQuant to save money on every booking.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="group flex items-center gap-2 px-8 py-3.5 rounded-xl bg-brand-green text-surface font-semibold shadow-[0_0_30px_rgba(0,208,156,0.25)] hover:shadow-[0_0_50px_rgba(0,208,156,0.4)] hover:bg-brand-green-dark transition-all"
              >
                Create free account
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="px-8 py-3.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
              >
                Already have an account?
              </Link>
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/50 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-green flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-surface" />
            </div>
            <span className="text-sm font-semibold">
              Aero<span className="text-brand-green">Quant</span>
            </span>
            <span className="text-xs text-muted-foreground ml-2">v2.0.0</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link href="/login"  className="hover:text-foreground transition">Log in</Link>
            <Link href="/signup" className="hover:text-foreground transition">Sign up</Link>
            <span>ML-powered · Indian Aviation</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} AeroQuant. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
