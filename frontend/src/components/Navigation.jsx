import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Activity, House, List, X } from "react-bootstrap-icons";

const TRADING_LIKE = ["/", "/trading", "/portfolio", "/trade-history", "/funding"];

const Navigation = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const onTradingShell = TRADING_LIKE.includes(location.pathname);
  const onWelcome = location.pathname === "/welcome";
  const inBrandShell = onTradingShell || onWelcome;

  return (
    <nav className={`navbar-glass${inBrandShell ? " navbar-glass--terminal" : ""}`}>
      <div className="navbar-container navbar-container--shell">
        <Link to="/welcome" className="navbar-brand navbar-brand--lockup">
          <div className="navbar-logo-mark" aria-hidden>
            <span className="navbar-logo-glyph">T</span>
            <span className="navbar-logo-glyph">F</span>
          </div>
          <div className="navbar-brand-copy">
            <span className="navbar-brand-text">TradeFlow</span>
            <span className="navbar-brand-tagline">Market simulator</span>
          </div>
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
            <span
              className="navbar-status-pill hidden md:inline-flex"
              title={onTradingShell ? "Market + engine simulation" : "Product overview"}
            >
              <span className="navbar-status-dot" aria-hidden />
              {onTradingShell ? "Live sim" : "Platform"}
            </span>
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
