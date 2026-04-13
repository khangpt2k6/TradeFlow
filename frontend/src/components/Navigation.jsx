import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  GraphUp,
  Activity,
  Bank2,
  CreditCard,
  ArrowLeftRight,
  BoxArrowRight,
  Person,
  PersonPlus,
  List,
  X,
  ChevronDown,
} from "react-bootstrap-icons";
import "../styles/navigation.css";

const Navigation = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopDropdownOpen, setDesktopDropdownOpen] = useState(null);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(null);
  const dropdownRef = useRef(null);
  const bankingButtonRef = useRef(null);
  const bankingMenuRef = useRef(null);
  const [bankingMenuPosition, setBankingMenuPosition] = useState({ top: 0, left: 0 });

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const isAuthenticated = localStorage.getItem("token");

  const toggleDesktopDropdown = (name) => {
    setDesktopDropdownOpen(desktopDropdownOpen === name ? null : name);
  };

  // Calculate dropdown positions
  const updateDropdownPositions = () => {
    if (desktopDropdownOpen === "banking" && bankingButtonRef.current) {
      const rect = bankingButtonRef.current.getBoundingClientRect();
      setBankingMenuPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  };

  useEffect(() => {
    if (desktopDropdownOpen) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        updateDropdownPositions();
      });
      
      // Also update after a small delay to ensure everything is rendered
      const timeoutId = setTimeout(() => {
        updateDropdownPositions();
      }, 10);
      
      // Update positions on scroll and resize
      window.addEventListener('scroll', updateDropdownPositions, true);
      window.addEventListener('resize', updateDropdownPositions);
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('scroll', updateDropdownPositions, true);
        window.removeEventListener('resize', updateDropdownPositions);
      };
    }
  }, [desktopDropdownOpen]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!desktopDropdownOpen) return;

    const handleClickOutside = (event) => {
      const target = event.target;
      // Don't close if clicking on a dropdown toggle button
      if (target.closest('.dropdown-toggle')) {
        return;
      }
      // Don't close if clicking inside the dropdown menu
      if (bankingMenuRef.current && bankingMenuRef.current.contains(target)) {
        return;
      }
      setDesktopDropdownOpen(null);
    };

    // Use a small delay to let the button click handler run first
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside, true);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside, true);
    };
  }, [desktopDropdownOpen]);

  const toggleMobileDropdown = (name) => {
    setMobileDropdownOpen(mobileDropdownOpen === name ? null : name);
  };

  return (
    <nav className="navbar-glass">
      <div className="navbar-container">
        {/* Logo */}
        <Link to="/" className="navbar-brand">
          <div className="navbar-logo-icon">V</div>
          <span>VaultX</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="navbar-menu-desktop" ref={dropdownRef}>
          {/* Banking Dropdown */}
          <div
            className={`nav-dropdown ${
              desktopDropdownOpen === "banking" ? "open" : ""
            }`}
            onMouseLeave={() => {
              setDesktopDropdownOpen(null);
            }}
          >
            <button
              ref={bankingButtonRef}
              type="button"
              className="nav-link dropdown-toggle"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleDesktopDropdown("banking");
              }}
              onMouseEnter={() => {
                setDesktopDropdownOpen("banking");
              }}
            >
              <span>Banking</span>
              <span className="chevron-wrapper">
                <ChevronDown size={12} className="chevron-icon" />
              </span>
            </button>
            {desktopDropdownOpen === "banking" && bankingMenuPosition.top > 0 && createPortal(
              <div 
                ref={bankingMenuRef}
                className="dropdown-menu"
                style={{
                  position: 'fixed',
                  top: `${bankingMenuPosition.top}px`,
                  left: `${bankingMenuPosition.left}px`,
                  zIndex: 1004,
                  opacity: 1,
                  visibility: 'visible',
                  display: 'block',
                }}
                onMouseEnter={() => setDesktopDropdownOpen("banking")}
                onMouseLeave={(e) => {
                  // Don't close if moving to button
                  const relatedTarget = e.relatedTarget;
                  if (relatedTarget && bankingButtonRef.current && bankingButtonRef.current.contains(relatedTarget)) {
                    return;
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              >
              {/* View Section */}
              <div className="dropdown-section-divider">
                <span className="dropdown-section-label">View</span>
              </div>
              <Link
                to="/accounts"
                className="dropdown-item"
                onClick={() => setDesktopDropdownOpen(null)}
              >
                <CreditCard size={16} />
                Accounts
              </Link>
              <Link
                to="/customers"
                className="dropdown-item"
                onClick={() => setDesktopDropdownOpen(null)}
              >
                <Bank2 size={16} />
                Customers
              </Link>
              <Link
                to="/transactions"
                className="dropdown-item"
                onClick={() => setDesktopDropdownOpen(null)}
              >
                <ArrowLeftRight size={16} />
                Transactions
              </Link>
              {/* Actions Section */}
              <div className="dropdown-section-divider">
                <span className="dropdown-section-label">Actions</span>
              </div>
              <Link
                to="/customers/new"
                className="dropdown-item"
                onClick={() => setDesktopDropdownOpen(null)}
              >
                <PersonPlus size={16} />
                Add Customer
              </Link>
              <Link
                to="/accounts/new"
                className="dropdown-item"
                onClick={() => setDesktopDropdownOpen(null)}
              >
                <Bank2 size={16} />
                New Account
              </Link>
              <Link
                to="/transactions/new"
                className="dropdown-item"
                onClick={() => setDesktopDropdownOpen(null)}
              >
                <ArrowLeftRight size={16} />
                New Transaction
              </Link>
              </div>,
              document.body
            )}
          </div>

          {/* Payment Processor Link */}
          <Link to="/payments" className="nav-link">
            <GraphUp size={16} />
            <span>Payment Processor</span>
          </Link>
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
          {/* Banking Dropdown */}
          <div className="mobile-dropdown">
            <button
              className="mobile-dropdown-toggle"
              onClick={() => toggleMobileDropdown("banking")}
            >
              <Bank2 size={18} />
              <span>Banking</span>
              <ChevronDown
                size={14}
                className={`chevron-icon ${
                  mobileDropdownOpen === "banking" ? "open" : ""
                }`}
              />
            </button>
            {mobileDropdownOpen === "banking" && (
              <div className="mobile-dropdown-menu">
                <div className="mobile-dropdown-section-label">View</div>
                <Link
                  to="/accounts"
                  className="mobile-dropdown-item"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Accounts
                </Link>
                <Link
                  to="/customers"
                  className="mobile-dropdown-item"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Customers
                </Link>
                <Link
                  to="/transactions"
                  className="mobile-dropdown-item"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Transactions
                </Link>
                <div className="mobile-dropdown-section-label">Actions</div>
                <Link
                  to="/customers/new"
                  className="mobile-dropdown-item"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Add Customer
                </Link>
                <Link
                  to="/accounts/new"
                  className="mobile-dropdown-item"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  New Account
                </Link>
                <Link
                  to="/transactions/new"
                  className="mobile-dropdown-item"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  New Transaction
                </Link>
              </div>
            )}
          </div>

          {/* Payment Processor Link */}
          <Link
            to="/payments"
            className="mobile-nav-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            <GraphUp size={18} />
            <span>Payment Processor</span>
          </Link>
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
