"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { TrendingUp, Eye, EyeOff, Loader2, ArrowRight, Chrome } from "lucide-react";
import { login } from "@/lib/api";
import toast from "react-hot-toast";

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-surface-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-green/50 transition";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("registered=1")) {
      toast.success("Account created! Sign in to continue.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      localStorage.setItem("aq_token", data.access_token);
      localStorage.setItem("aq_username", data.username);
      // Set cookie so middleware can verify auth on protected routes
      const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
      document.cookie = `aq_token=${data.access_token}; path=/; max-age=${maxAge}; SameSite=Lax`;
      toast.success(`Welcome back, ${data.username}!`);
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err?.message ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => { setEmail("demo"); setPassword("demo"); };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-brand-green/6 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/4 w-[350px] h-[350px] bg-brand-blue/4 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2.5 mb-8"
        >
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-brand-green flex items-center justify-center group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5 text-surface" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Aero<span className="text-brand-green">Quant</span>
            </span>
          </Link>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
          className="glass-card p-8"
        >
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Welcome back &mdash; enter your credentials
            </p>
          </div>

          {/* Google / OAuth mock */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="button"
            onClick={() => toast("Google auth coming soon", { icon: "🔑" })}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border border-border hover:border-white/20 hover:bg-surface-secondary text-sm font-medium text-foreground transition mb-5"
          >
            <Chrome className="w-4 h-4 text-brand-blue" />
            Continue with Google
          </motion.button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-surface text-muted-foreground">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Email / Username
              </label>
              <input
                type="text"
                placeholder="demo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className={inputClass}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <Link href="/forgot-password" className="text-xs text-brand-green hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={inputClass + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  aria-label="Toggle password visibility"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-surface-secondary accent-brand-green cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs text-muted-foreground cursor-pointer select-none">
                Remember me for 30 days
              </label>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full group flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-green hover:bg-brand-green-dark text-surface font-semibold text-sm transition disabled:opacity-60 shadow-[0_0_20px_rgba(0,208,156,0.20)] hover:shadow-[0_0_30px_rgba(0,208,156,0.35)]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </motion.button>
          </form>

          {/* Demo hint */}
          <div className="mt-5 rounded-xl bg-surface-secondary border border-border/50 p-4">
            <p className="text-xs text-muted-foreground mb-2">Demo credentials</p>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-foreground">demo</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground">demo</span>
              <button
                type="button"
                onClick={fillDemo}
                className="ml-auto text-brand-green hover:underline text-xs"
              >
                Fill &rarr;
              </button>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-xs text-muted-foreground mt-5"
        >
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-brand-green hover:underline font-medium">
            Sign up free
          </Link>
        </motion.p>
      </div>
    </div>
  );
}
