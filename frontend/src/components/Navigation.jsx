import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, BoxArrowRight, List, X } from "react-bootstrap-icons";
import { useAuth } from "../contexts/AuthContext";

const Navigation = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <nav className="navbar-glass">
      <div className="navbar-container">
        {/* Logo */}
        <Link to="/" className="navbar-brand">
          <div className="navbar-logo-icon">V</div>
          <span>TradeFlow</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="navbar-menu-desktop">
          <Link to="/trading" className="nav-link">
            <Activity size={16} />
            <span>Trading</span>
          </Link>
        </div>

        {/* Right side - Auth or Menu Toggle */}
        <div className="navbar-right">
          {isAuthenticated ? (
            <>
              {/* Desktop Auth */}
              <button onClick={handleLogout} className="nav-link logout-btn">
                <BoxArrowRight size={16} />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-login-link">
                Login
              </Link>
              <Link to="/register" className="navbar-register-btn">
                Register
              </Link>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <List size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
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

          {isAuthenticated && (
            <button
              onClick={() => {
                handleLogout();
                setMobileMenuOpen(false);
              }}
              className="mobile-nav-link logout-btn"
            >
              <BoxArrowRight size={18} />
              <span>Logout</span>
            </button>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navigation;
