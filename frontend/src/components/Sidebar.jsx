import React from "react";
import { Link } from "react-router-dom";
import {
  PeopleFill,
  Bank2,
  CashStack,
  X,
  ChevronLeft,
  ChevronRight,
  Activity,
  Briefcase,
  CreditCard,
  Receipt,
} from "react-bootstrap-icons";

const Sidebar = ({ isOpen, onClose, isCollapsed, onToggleCollapse }) => {
  const bankingViewItems = [
    { icon: CreditCard, label: "Accounts", to: "/accounts" },
    { icon: PeopleFill, label: "Customers", to: "/customers" },
    { icon: CashStack, label: "Transactions", to: "/transactions" },
  ];

  const bankingActionItems = [
    { icon: PeopleFill, label: "Add Customer", to: "/customers/new" },
    { icon: Bank2, label: "New Account", to: "/accounts/new" },
    { icon: CashStack, label: "New Transaction", to: "/transactions/new" },
  ];

  const tradingItems = [
    { icon: Activity, label: "Trading", to: "/trading" },
    { icon: Briefcase, label: "Portfolio", to: "/portfolio" },
    { icon: CreditCard, label: "Deposit", to: "/funding" },
    { icon: Receipt, label: "Trade History", to: "/trade-history" },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside
        className={`sidebar-glass ${isOpen ? "open" : ""} ${
          isCollapsed ? "collapsed" : ""
        }`}
      >
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-controls">
            <button
              className="sidebar-btn d-none d-lg-flex"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? (
                <ChevronRight size={18} />
              ) : (
                <ChevronLeft size={18} />
              )}
            </button>
            <button
              className="sidebar-btn d-lg-none"
              onClick={onClose}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="sidebar-body">
          {/* Banking Section */}
          <div className="sidebar-section">
            {!isCollapsed && <div className="sidebar-title">BANKING</div>}
            
            {/* View Items */}
            {!isCollapsed && (
              <div className="sidebar-subtitle">View</div>
            )}
            <div className="sidebar-items">
              {bankingViewItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="sidebar-item"
                  title={item.label}
                  onClick={onClose}
                >
                  <item.icon size={20} />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              ))}
            </div>

            {/* Action Items */}
            {!isCollapsed && (
              <div className="sidebar-subtitle" style={{ marginTop: "1rem" }}>Actions</div>
            )}
            <div className="sidebar-items">
              {bankingActionItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="sidebar-item"
                  title={item.label}
                  onClick={onClose}
                >
                  <item.icon size={20} />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              ))}
            </div>
          </div>

          {/* Trading Section */}
          <div className="sidebar-section">
            {!isCollapsed && <div className="sidebar-title">TRADING</div>}
            <div className="sidebar-items">
              {tradingItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="sidebar-item trading"
                  title={item.label}
                  onClick={onClose}
                >
                  <item.icon size={20} />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
