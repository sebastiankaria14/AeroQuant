"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle2, Loader2, Mail, Plane } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Please enter your email address."); return; }

    setLoading(true);
    // Simulate API call — no real reset endpoint in lite mode
    await new Promise((r) => setTimeout(r, 1400));
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0d1117]">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-brand-green/10 blur-[120px]" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-brand-blue/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center gap-2 mb-8"
        >
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-brand-green/20 border border-brand-green/30 flex items-center justify-center group-hover:bg-brand-green/30 transition-colors">
              <Plane className="w-5 h-5 text-brand-green" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Aero<span className="text-brand-green">Quant</span>
            </span>
          </Link>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass-card rounded-2xl p-8 border border-white/10 shadow-2xl"
        >
          <AnimatePresence mode="wait">
            {!sent ? (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-brand-blue/15 border border-brand-blue/25 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-brand-blue" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">Forgot password?</h1>
                    <p className="text-xs text-neutral-400">We'll send you a reset link</p>
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      placeholder="you@example.com"
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-brand-green/50 transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-brand-green hover:bg-brand-green-dark text-black font-semibold text-sm transition-all duration-200 shadow-lg shadow-brand-green/25 hover:shadow-brand-green/40 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                    ) : (
                      "Send Reset Link"
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-brand-green/15 border border-brand-green/30 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-brand-green" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Check your inbox</h2>
                <p className="text-neutral-400 text-sm mb-1">
                  We sent a password reset link to
                </p>
                <p className="text-brand-green text-sm font-medium mb-6">{email}</p>
                <p className="text-neutral-500 text-xs">
                  Didn't receive it? Check your spam folder or{" "}
                  <button
                    onClick={() => setSent(false)}
                    className="text-brand-green hover:underline"
                  >
                    try again
                  </button>
                  .
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Back to login */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex justify-center mt-6"
        >
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
