import React, { useState } from "react";
import { Spinner } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { supabase } from "../lib/supabaseClient";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        toast.error(error.message || "Login failed");
        return;
      }

      if (data?.session) {
        toast.success("Login successful!");
        navigate("/");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error(error.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error(error.message || `Could not start ${provider} login`);
      }
    } catch (error) {
      toast.error(error.message || `Could not start ${provider} login`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <section className="auth-signin">
          <div className="auth-card">
            <div className="auth-card-header">
              <h2>Sign In</h2>
              <p>Access your vault securely</p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-input-group">
                <label className="auth-label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="auth-input-group">
                <div className="auth-label-row">
                  <label className="auth-label" htmlFor="password">
                    Password
                  </label>
                  <Link to="/forgot-password" className="auth-link">
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="auth-input"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="auth-btn auth-btn-primary auth-submit" disabled={loading}>
                {loading ? (
                  <span className="auth-btn-loading">
                    <Spinner animation="border" size="sm" role="status" />
                    Logging in
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="auth-divider" role="presentation">
              <span>Or continue with</span>
            </div>

            <button
              type="button"
              className="auth-btn auth-btn-outline"
              disabled={loading}
              onClick={() => handleOAuthLogin("google")}
            >
              Continue with Google
            </button>

            <button
              type="button"
              className="auth-btn auth-btn-outline"
              disabled={loading}
              onClick={() => handleOAuthLogin("github")}
            >
              Continue with GitHub
            </button>

            <div className="auth-divider" role="presentation">
              <span>New to TradeFlow?</span>
            </div>

            <Link to="/register" className="auth-btn auth-btn-outline">
              Create Account
            </Link>

            <p className="auth-card-footer">
              By signing in, you agree to our
              <a href="/terms" className="auth-link">
                Terms
              </a>
              &amp;
              <a href="/privacy" className="auth-link">
                Privacy Policy
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
