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

  return (
    <nav className={`navbar-glass${inBrandShell ? " navbar-glass--terminal" : ""}`}>
      <div className="navbar-container navbar-container--shell">
        <Link to="/welcome" className="navbar-brand navbar-brand--lockup">
          <span className="navbar-logo-mark" aria-hidden>
            <svg viewBox="0 0 36 36" width="30" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="tf-logo-grad" x1="0" y1="36" x2="36" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#22c55e" />
                  <stop offset="1" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
              <rect x="1" y="1" width="34" height="34" rx="9" stroke="url(#tf-logo-grad)" strokeWidth="1.5" />
              <path
                d="M4 22 L11 22 L14 14 L19 26 L23 10 L27 18 L32 18"
                stroke="url(#tf-logo-grad)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="navbar-brand-copy">
            <span className="navbar-brand-text">
              Trade<span className="navbar-brand-accent">Flow</span>
            </span>
            <span className="navbar-brand-tagline">Market simulator · Paper engine</span>
          </span>
        </Link>

        <div className="navbar-nav-cluster" role="navigation" aria-label="Main">
          <Link
            to="/welcome"
            className={`nav-tab ${onWelcome ? "is-active" : ""}`}
            aria-current={onWelcome ? "page" : undefined}
          >
            <House size={15} aria-hidden />
            <span>Overview</span>
          </Link>
          <Link
            to="/trading"
            className={`nav-tab ${onTradingShell ? "is-active" : ""}`}
            aria-current={onTradingShell ? "page" : undefined}
          >
            <Activity size={15} aria-hidden />
            <span>Trading</span>
          </Link>
        </div>

        <div className="navbar-right">
          {inBrandShell && (
            <>
              <span className="navbar-clock hidden md:inline-flex" title="Session clock (local)">
                <span className="navbar-clock__label">SESSION</span>
                <span className="navbar-clock__value">{formatClock(now)}</span>
              </span>
              <span
                className="navbar-status-pill hidden md:inline-flex"
                title={onTradingShell ? "Market + engine simulation" : "Product overview"}
              >
                <span className="navbar-status-dot" aria-hidden />
                {onTradingShell ? "Live sim" : "Platform"}
              </span>
            </>
          )}
          <button
            className="mobile-menu-toggle"
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X size={24} /> : <List size={24} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="mobile-menu">
          <Link
            to="/welcome"
            className={`mobile-nav-link ${onWelcome ? "is-active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <House size={18} aria-hidden />
            <span>Overview</span>
          </Link>
          <Link
            to="/trading"
            className={`mobile-nav-link ${onTradingShell ? "is-active" : ""}`}
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
