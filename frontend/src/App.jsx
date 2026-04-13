import React from "react";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import Navigation from "./components/Navigation";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./components/Login";
import Register from "./components/Register";
import Welcome from "./components/Welcome";
import TradingDashboard from "./components/TradingDashboard";

function AppContent() {
  const location = useLocation();
  const isAuthPage = ["/login", "/register", "/welcome"].includes(location.pathname);
  const isTradingPage = ["/", "/trading", "/portfolio", "/trade-history", "/funding"].includes(location.pathname);

  return (
    <div className="App min-h-screen">
      <Navigation />

      {/* Main Content */}
      <div className={`main-content ${isAuthPage || isTradingPage ? "auth-layout" : ""}`}>
        <Routes>
          {/* Public and trading routes - no container wrapper */}
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <TradingDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trading"
            element={
              <ProtectedRoute>
                <TradingDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/portfolio"
            element={
              <ProtectedRoute>
                <TradingDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trade-history"
            element={
              <ProtectedRoute>
                <TradingDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/funding"
            element={
              <ProtectedRoute>
                <TradingDashboard />
              </ProtectedRoute>
            }
          />
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
