import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, List, X } from "react-bootstrap-icons";

const Navigation = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="navbar-glass">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <div className="navbar-logo-icon">V</div>
          <span>TradeFlow</span>
        </Link>

        <div className="navbar-menu-desktop">
          <Link to="/trading" className="nav-link">
            <Activity size={16} />
            <span>Trading</span>
          </Link>
        </div>

        <div className="navbar-right">
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
            to="/trading"
            className="mobile-nav-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Activity size={18} />
            <span>Trading</span>
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
