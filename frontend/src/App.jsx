import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import Navigation from "./components/Navigation";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./components/Dashboard";
import CustomerList from "./components/CustomerList";
import CustomerForm from "./components/CustomerForm";
import AccountList from "./components/AccountList";
import AccountForm from "./components/AccountForm";
import TransactionList from "./components/TransactionList";
import TransactionForm from "./components/TransactionForm";
import Login from "./components/Login";
import Register from "./components/Register";
import Welcome from "./components/Welcome";
import PaymentProcessor from "./components/PaymentProcessor";
import TradingDashboard from "./components/TradingDashboard";

function AppContent() {
  const location = useLocation();
  const isAuthPage = ["/login", "/register", "/welcome"].includes(location.pathname);
  const isDashboard = ["/", "/dashboard"].includes(location.pathname);

  return (
    <div className="App min-h-screen bg-slate-950 text-slate-100">
      <Navigation />

      {/* Main Content */}
      <div className={`main-content ${isAuthPage || isDashboard ? "auth-layout" : ""}`}>
        {isAuthPage || isDashboard ? (
          <Routes>
            {/* Public and Dashboard routes - no container wrapper */}
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        ) : (
          <div className="mx-auto mt-20 w-full max-w-[1400px] px-4">
            <Routes>
              {/* Protected routes with container wrapper */}
              <Route
                path="/customers"
                element={
                  <ProtectedRoute>
                    <CustomerList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customers/new"
                element={
                  <ProtectedRoute>
                    <CustomerForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customers/edit/:id"
                element={
                  <ProtectedRoute>
                    <CustomerForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts"
                element={
                  <ProtectedRoute>
                    <AccountList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts/new"
                element={
                  <ProtectedRoute>
                    <AccountForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts/edit/:id"
                element={
                  <ProtectedRoute>
                    <AccountForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions"
                element={
                  <ProtectedRoute>
                    <TransactionList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions/new"
                element={
                  <ProtectedRoute>
                    <TransactionForm />
                  </ProtectedRoute>
                }
              />

              {/* Payment Processor Routes */}
              <Route
                path="/payments"
                element={
                  <ProtectedRoute>
                    <PaymentProcessor />
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
            </Routes>
          </div>
        )}
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
