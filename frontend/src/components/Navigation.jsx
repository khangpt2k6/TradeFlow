import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Activity, House, List, X } from "react-bootstrap-icons";

const TRADING_LIKE = ["/", "/trading", "/portfolio", "/trade-history", "/funding"];

const formatClock = (d) =>
  d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

const Navigation = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const location = useLocation();
  const onTradingShell = TRADING_LIKE.includes(location.pathname);
  const onWelcome = location.pathname === "/welcome";
  const inBrandShell = onTradingShell || onWelcome;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const tabClass = (active) =>
    `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[11.5px] font-bold uppercase tracking-wider transition ${
      active
        ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 shadow-[0_6px_22px_rgba(16,185,129,0.18)]"
        : "border border-transparent text-tf-dim hover:border-tf-border hover:bg-white/5 hover:text-tf-text"
    }`;

  return (
    <nav className="sticky top-0 z-40 border-b border-tf-border bg-tf-panel/95 backdrop-blur shadow-[0_8px_32px_rgba(0,0,0,0.55)]">
      <div className="mx-auto grid max-w-[1760px] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-2.5">
        <Link to="/welcome" className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[radial-gradient(120%_120%_at_30%_20%,rgba(34,197,94,0.18),rgba(56,189,248,0.05)_55%,transparent_70%)] shadow-[inset_0_0_0_1px_rgba(56,189,248,0.12),0_8px_24px_rgba(0,0,0,0.45)]" aria-hidden>
            <svg viewBox="0 0 36 36" width="30" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="tf-logo-grad" x1="0" y1="36" x2="36" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#22c55e" />
                  <stop offset="1" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
              <rect x="1" y="1" width="34" height="34" rx="9" stroke="url(#tf-logo-grad)" strokeWidth="1.5" />
              <path d="M4 22 L11 22 L14 14 L19 26 L23 10 L27 18 L32 18" stroke="url(#tf-logo-grad)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[1.1rem] font-extrabold tracking-tight text-tf-text">
              Trade<span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">Flow</span>
            </span>
            <span className="mt-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.22em] text-tf-mute">
              Market simulator · Paper engine
            </span>
          </span>
        </Link>

        <div className="hidden justify-center gap-1.5 md:flex" role="navigation" aria-label="Main">
          <Link to="/welcome" className={tabClass(onWelcome)} aria-current={onWelcome ? "page" : undefined}>
            <House size={14} aria-hidden />
            <span>Overview</span>
          </Link>
          <Link to="/trading" className={tabClass(onTradingShell)} aria-current={onTradingShell ? "page" : undefined}>
            <Activity size={14} aria-hidden />
            <span>Trading</span>
          </Link>
        </div>

        <div className="flex items-center gap-2.5">
          {inBrandShell && (
            <>
              <span
                className="hidden flex-col items-end rounded-md border border-sky-500/20 bg-gradient-to-b from-[#0d1626]/90 to-[#080c14]/95 px-2.5 py-1 font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] md:inline-flex"
                title="Session clock (local)"
              >
                <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-tf-mute">Session</span>
                <span className="text-[13px] font-bold tabular-nums tracking-wider text-tf-text">{formatClock(now)}</span>
              </span>
              <span
                className="hidden items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-900/35 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-200 md:inline-flex"
                title={onTradingShell ? "Market + engine simulation" : "Product overview"}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]" aria-hidden />
                {onTradingShell ? "Live sim" : "Platform"}
              </span>
            </>
          )}
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-tf-dim hover:bg-white/5 hover:text-tf-text md:hidden"
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X size={22} /> : <List size={22} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="flex flex-col border-t border-tf-border bg-tf-panel/95 md:hidden">
          <Link
            to="/welcome"
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold ${onWelcome ? "border-l-[3px] border-emerald-400 bg-emerald-400/10 pl-[calc(1rem-3px)] text-emerald-100" : "text-tf-text hover:bg-white/5"}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <House size={18} aria-hidden />
            <span>Overview</span>
          </Link>
          <Link
            to="/trading"
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold ${onTradingShell ? "border-l-[3px] border-emerald-400 bg-emerald-400/10 pl-[calc(1rem-3px)] text-emerald-100" : "text-tf-text hover:bg-white/5"}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Activity size={18} aria-hidden />
            <span>Trading</span>
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
