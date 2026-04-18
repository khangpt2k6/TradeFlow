import React, { useState } from "react";
import { Spinner } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowRight, Check } from "react-bootstrap-icons";
import { supabase } from "../lib/supabaseClient";
import { upsertUserProfile } from "../services/supabaseData";

const Register = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    address: "",
    phone: "",
    dateOfBirth: "",
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

  const handleNext = (e) => {
    e.preventDefault();

    // Validate current step before proceeding
    if (currentStep === 1) {
      if (!formData.email || !isValidEmail(formData.email)) {
        toast.error("Please enter a valid email address");
        return;
      }
    } else if (currentStep === 2) {
      if (!formData.password || formData.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
      // Don't check password match here - confirmation happens in step 3
    } else if (currentStep === 3) {
      if (!formData.confirmPassword) {
        toast.error("Please confirm your password");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
    }

    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate passwords match before submitting
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    // Validate date of birth is in the past
    if (formData.dateOfBirth) {
      const birthDate = new Date(formData.dateOfBirth);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to compare dates only
      
      if (birthDate >= today) {
        toast.error("Date of birth must be in the past");
        return;
      }

      // Also check if person is too old (reasonable limit, e.g., 150 years)
      const maxAge = new Date();
      maxAge.setFullYear(maxAge.getFullYear() - 150);
      if (birthDate < maxAge) {
        toast.error("Please enter a valid date of birth");
        return;
      }
    }

    if (!supabase) {
      toast.error(
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env (see .env.example)."
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          },
        },
      });

      if (error) {
        toast.error(error.message || "Registration failed");
        return;
      }

      if (data?.user?.id) {
        await upsertUserProfile({
          userId: data.user.id,
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          address: formData.address,
          dateOfBirth: formData.dateOfBirth,
        });
      }

      if (data?.session) {
        toast.success("Registration complete! You are signed in.");
        navigate("/");
      } else {
        toast.success("Registration successful! Check your inbox to verify your email.");
        navigate("/login");
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error(error.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    if (!supabase) {
      toast.error(
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env (see .env.example)."
      );
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/` },
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="register-step">
            <div className="register-step-header">
              <h2>Hey! Can you type your email?</h2>
              <p>We&apos;ll need this to create your account</p>
            </div>

            <div className="register-step-content">
              <div className="auth-input-group">
                <input
                  name="email"
                  type="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoFocus
                  autoComplete="email"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") handleNext(e);
                  }}
                />
              </div>

              <button
                type="button"
                className="auth-btn auth-btn-primary register-arrow-btn"
                onClick={handleNext}
              >
                Continue
                <ArrowRight size={18} />
              </button>

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
            </div>
          </div>
        );

      case 2:
        return (
          <div className="register-step">
            <div className="register-step-header">
              <h2>Create your password</h2>
              <p>Make sure it&apos;s secure</p>
            </div>

            <div className="register-step-content">
              <div className="auth-input-group">
                <input
                  name="password"
                  type="password"
                  className="auth-input"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoFocus
                  autoComplete="new-password"
                />
              </div>

              <button
                type="button"
                className="auth-btn auth-btn-primary register-arrow-btn"
                onClick={handleNext}
              >
                Next
                <ArrowRight size={18} />
              </button>
            </div>

            <button type="button" className="auth-btn-back" onClick={handleBack}>
              ← Back
            </button>
          </div>
        );

      case 3:
        return (
          <div className="register-step">
            <div className="register-step-header">
              <h2>Confirm your password</h2>
              <p>Just to make sure</p>
            </div>

            <div className="register-step-content">
              <div className="auth-input-group">
                <input
                  name="confirmPassword"
                  type="password"
                  className="auth-input"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  autoFocus
                  autoComplete="new-password"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") handleNext(e);
                  }}
                />
              </div>

              <button
                type="button"
                className="auth-btn auth-btn-primary register-arrow-btn"
                onClick={handleNext}
              >
                Confirm
                <ArrowRight size={18} />
              </button>
            </div>

            <button type="button" className="auth-btn-back" onClick={handleBack}>
              ← Back
            </button>
          </div>
        );

      case 4:
        return (
          <div className="register-step">
            <div className="register-step-header">
              <h2>Tell us about yourself</h2>
              <p>We need a few details to complete your profile</p>
            </div>

            <form className="register-form" onSubmit={handleSubmit}>
              <div className="register-form-row">
                <div className="auth-input-group">
                  <input
                    name="firstName"
                    type="text"
                    className="auth-input"
                    placeholder="First name"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    autoFocus
                  />
                </div>
                <div className="auth-input-group">
                  <input
                    name="lastName"
                    type="text"
                    className="auth-input"
                    placeholder="Last name"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <input
                  name="phone"
                  type="tel"
                  className="auth-input"
                  placeholder="Phone number"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="auth-input-group">
                <input
                  name="address"
                  type="text"
                  className="auth-input"
                  placeholder="Address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="auth-input-group">
                <input
                  name="dateOfBirth"
                  type="date"
                  className="auth-input"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  required
                  max={new Date().toISOString().split('T')[0]} // Prevent selecting future dates
                  title="Date of birth must be in the past"
                />
              </div>

              <button
                type="submit"
                className="auth-btn auth-btn-primary register-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <span className="auth-btn-loading">
                    <Spinner animation="border" size="sm" role="status" />
                    Creating Account...
                  </span>
                ) : (
                  <>
                    Complete Registration
                    <Check size={18} />
                  </>
                )}
              </button>
            </form>

            <button type="button" className="auth-btn-back" onClick={handleBack}>
              ← Back
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <section className="auth-signin">
          <div className="auth-card register-card">
            {/* Progress Indicator */}
            <div className="register-progress">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`register-progress-dot ${currentStep >= step ? "active" : ""}`}
                />
              ))}
            </div>

            {renderStepContent()}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Register;
