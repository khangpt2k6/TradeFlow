import React, { useEffect } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import Navigation from "./components/Navigation";
import Welcome from "./components/Welcome";
import TradingDashboard from "./components/TradingDashboard";

const TRADING_PATHS = ["/", "/trading", "/portfolio", "/trade-history", "/funding"];

function AppContent() {
  const location = useLocation();
  const isAuthPage = ["/welcome"].includes(location.pathname);
  const isTradingPage = TRADING_PATHS.includes(location.pathname);

  useEffect(() => {
    if (TRADING_PATHS.includes(location.pathname)) {
      document.body.classList.add("trading-terminal-mode");
    } else {
      document.body.classList.remove("trading-terminal-mode");
    }
    return () => document.body.classList.remove("trading-terminal-mode");
  }, [location.pathname]);

  return (
    <div className="App min-h-screen">
      <Navigation />

      <div className={`main-content ${isAuthPage || isTradingPage ? "auth-layout" : ""}`}>
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/" element={<TradingDashboard />} />
          <Route path="/trading" element={<TradingDashboard />} />
          <Route path="/portfolio" element={<TradingDashboard />} />
          <Route path="/trade-history" element={<TradingDashboard />} />
          <Route path="/funding" element={<TradingDashboard />} />
          <Route path="*" element={<Navigate to="/trading" replace />} />
        </Routes>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </Router>
  );
}

export default App;
