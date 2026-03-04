"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Search, User, LogOut, Settings, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { checkWatchlistAlerts } from "@/lib/api";

const SEARCH_SUGGESTIONS = [
  { label: "Delhi → Mumbai", source: "Delhi", destination: "Mumbai" },
  { label: "Delhi → Bangalore", source: "Delhi", destination: "Bangalore" },
  { label: "Mumbai → Hyderabad", source: "Mumbai", destination: "Hyderabad" },
  { label: "Mumbai → Chennai", source: "Mumbai", destination: "Chennai" },
  { label: "Delhi → Kolkata", source: "Delhi", destination: "Kolkata" },
  { label: "Bangalore → Mumbai", source: "Bangalore", destination: "Mumbai" },
  { label: "Chennai → Delhi", source: "Chennai", destination: "Delhi" },
  { label: "Kolkata → Bangalore", source: "Kolkata", destination: "Bangalore" },
];

export function TopBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showBell, setShowBell] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("aq_token");
      const stored = localStorage.getItem("aq_username");
      if (token && stored) setUsername(stored);
    }
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setShowBell(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUser(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: alerts = [] } = useQuery({
    queryKey: ["watchlist-alerts"],
    queryFn: checkWatchlistAlerts,
    retry: 1,
    refetchInterval: 60_000,
  });

  const filtered = query.length > 0
    ? SEARCH_SUGGESTIONS.filter((s) =>
        s.label.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_SUGGESTIONS;

  const handleSuggestion = (s: typeof SEARCH_SUGGESTIONS[0]) => {
    setQuery("");
    setSearchFocused(false);
    router.push(`/prediction?source=${s.source}&destination=${s.destination}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const match = SEARCH_SUGGESTIONS.find((s) =>
      s.label.toLowerCase().includes(query.toLowerCase())
    );
    if (match) {
      router.push(`/prediction?source=${match.source}&destination=${match.destination}`);
    } else {
      router.push(`/prediction?q=${encodeURIComponent(query)}`);
    }
    setQuery("");
    setSearchFocused(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("aq_token");
    localStorage.removeItem("aq_username");
    // Clear the auth cookie so middleware stops protecting routes
    document.cookie = "aq_token=; max-age=0; path=/; SameSite=Lax";
    setUsername(null);
    setShowUser(false);
    router.push("/");
  };

  return (
    <header className="h-16 shrink-0 bg-surface/80 backdrop-blur-sm border-b border-border/50 flex items-center px-6 gap-4 relative z-10">
      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
        <Search
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors pointer-events-none ${
            searchFocused ? "text-brand-green" : "text-muted-foreground"
          }`}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search routes, e.g. Delhi → Mumbai…"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          className="w-full pl-9 pr-4 py-2 bg-surface-secondary rounded-lg border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-green/50 transition"
        />
        {searchFocused && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-30">
            {filtered.map((s) => (
              <button
                key={s.label}
                type="button"
                onMouseDown={() => handleSuggestion(s)}
                className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-surface-secondary transition flex items-center gap-2"
              >
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {s.label}
              </button>
            ))}
            {query && !filtered.length && (
              <p className="px-4 py-3 text-xs text-muted-foreground">No matching routes</p>
            )}
          </div>
        )}
      </form>

      <div className="flex items-center gap-2 ml-auto">
        {/* Bell */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => { setShowBell((v) => !v); setShowUser(false); }}
            className="relative p-2 rounded-lg hover:bg-surface-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <Bell className="w-4 h-4" />
            {alerts.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-brand-red text-white text-[9px] font-bold flex items-center justify-center">
                {alerts.length}
              </span>
            )}
            {alerts.length === 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-green" />
            )}
          </button>

          {showBell && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-xl shadow-xl z-40 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Price Alerts</p>
                <span className="text-xs text-muted-foreground">{alerts.length} triggered</span>
              </div>
              {alerts.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-muted-foreground">No alerts triggered right now</p>
                  <Link
                    href="/watchlist"
                    onClick={() => setShowBell(false)}
                    className="inline-block mt-2 text-xs text-brand-green hover:underline"
                  >
                    Manage watchlist →
                  </Link>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto custom-scroll">
                  {alerts.map((a, i) => (
                    <Link
                      href="/watchlist"
                      key={i}
                      onClick={() => setShowBell(false)}
                      className="block px-4 py-3 hover:bg-surface-secondary transition border-b border-border/30 last:border-0"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-brand-orange shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {a.source} → {a.destination}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ₹{a.predicted_price.toLocaleString("en-IN")} · below ₹{a.alert_price.toLocaleString("en-IN")} target
                          </p>
                          <p className="text-xs text-brand-green font-medium mt-0.5">
                            Save ₹{a.savings.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User */}
        <div ref={userRef} className="relative">
          <button
            onClick={() => { setShowUser((v) => !v); setShowBell(false); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-secondary transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-brand-green/20 border border-brand-green/30 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-brand-green" />
            </div>
            <span className="text-sm text-foreground hidden sm:block capitalize">
              {username ?? "Demo"}
            </span>
          </button>

          {showUser && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-xl shadow-xl z-40 overflow-hidden py-1">
              <div className="px-4 py-2.5 border-b border-border/50">
                <p className="text-sm font-medium text-foreground capitalize">{username ?? "Demo User"}</p>
                <p className="text-xs text-muted-foreground">Lite mode</p>
              </div>
              <Link
                href="/settings"
                onClick={() => setShowUser(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-surface-secondary transition"
              >
                <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                Settings
              </Link>
              {username ? (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-brand-red hover:bg-brand-red/10 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setShowUser(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-brand-green hover:bg-brand-green/10 transition"
                >
                  <User className="w-3.5 h-3.5" />
                  Sign in
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
