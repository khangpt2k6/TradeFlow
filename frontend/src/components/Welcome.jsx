import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldLock,
  LightningCharge,
  ClockHistory,
  Bank2,
  GraphUp,
  CheckCircle,
} from "react-bootstrap-icons";

const Welcome = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const features = [
    {
      icon: ShieldLock,
      title: "Bank-grade security",
      description:
        "Multi-factor authentication, continuous monitoring, and 256-bit encryption keep every transaction protected.",
    },
    {
      icon: LightningCharge,
      title: "Faster workflows",
      description:
        "Automate fund transfers and portfolio rebalancing so your team can make smarter moves in real-time.",
    },
    {
      icon: ClockHistory,
      title: "24/7 visibility",
      description:
        "Transparent reporting with instant alerts ensures you never lose sight of balances, trades, or approvals.",
    },
  ];

  const benefits = [
    "Real-time portfolio tracking",
    "Secure transaction processing",
    "Automated investment strategies",
    "Comprehensive financial analytics",
  ];

  const slides = [
    {
      title: "Your wealth,",
      titleHighlight: "perfectly managed",
      subtitle:
        "Experience the future of banking. Manage your finances with confidence, security, and complete transparency.",
    },
    {
      title: "Smart trading,",
      titleHighlight: "simplified",
      subtitle:
        "Access global markets with intuitive tools. Execute trades seamlessly with real-time data and instant execution.",
    },
    {
      title: "Complete control,",
      titleHighlight: "always",
      subtitle:
        "Monitor your entire financial ecosystem from one dashboard. Get insights that help you make better decisions.",
    },
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  return (
    <div className="welcome-page">
      <div className="welcome-container">
        {/* Hero Section */}
        <section className="welcome-hero">
          <span className="welcome-badge">Secure Banking & Trading</span>

          <div className="welcome-slider">
            <div className="welcome-slide-wrapper">
              {slides.map((slide, index) => (
                <div
                  key={index}
                  className={`welcome-slide ${index === currentSlide ? "active" : ""}`}
                >
                  <h1 className="welcome-title">
                    {slide.title}
                    <span className="welcome-title-highlight"> {slide.titleHighlight}</span>
                  </h1>
                  <p className="welcome-subtitle">{slide.subtitle}</p>
                </div>
              ))}
            </div>

            <div className="welcome-cta">
              <Link to="/register" className="welcome-btn welcome-btn-primary">
                Get Started
              </Link>
              <Link to="/login" className="welcome-btn welcome-btn-secondary">
                Learn More
              </Link>
            </div>

            {/* Pagination Indicators */}
            <div className="welcome-indicators">
              {slides.map((_, index) => (
                <button
                  key={index}
                  className={`welcome-indicator ${index === currentSlide ? "active" : ""}`}
                  onClick={() => goToSlide(index)}
                  aria-label={`Go to slide ${index + 1}`}
                >
                  {index + 1}
                </button>
              ))}
              <span className="welcome-trust">Trusted by thousands</span>
            </div>
          </div>

          {/* Features Grid */}
          <div className="welcome-features">
            {features.map((feature, index) => (
              <div className="welcome-feature" key={index}>
                <div className="welcome-feature-icon">
                  <feature.icon size={24} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Benefits Section */}
          <div className="welcome-benefits">
            <div className="welcome-benefits-content">
              <h2 className="welcome-benefits-title">Why Choose VaultX?</h2>
              <ul className="welcome-benefits-list">
                {benefits.map((benefit, index) => (
                  <li key={index}>
                    <CheckCircle size={20} />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              <Link to="/register" className="welcome-btn welcome-btn-primary">
                Start Your Journey
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Welcome;

