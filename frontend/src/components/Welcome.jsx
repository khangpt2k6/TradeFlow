import React, { useState } from "react";
import { Link } from "react-router-dom";
import tradingVideo from "../trading.mp4";
import {
  ShieldLock,
  LightningCharge,
  ClockHistory,
  CheckCircle,
} from "react-bootstrap-icons";

const Welcome = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const features = [
    {
      icon: ShieldLock,
      title: "Simulation-grade controls",
      description:
        "Concurrent matching, retry pipelines, and fraud-style alerts exercise the engine under stress without a login wall.",
    },
    {
      icon: LightningCharge,
      title: "Faster workflows",
      description:
        "Automate portfolio rebalancing and execution so your team can react to markets in real-time.",
    },
    {
      icon: ClockHistory,
      title: "24/7 visibility",
      description:
        "Transparent reporting with instant alerts ensures you never lose sight of risk, performance, or positions.",
    },
  ];

  const benefits = [
    "Real-time portfolio tracking",
    "In-memory simulated execution",
    "Streaming market ticks",
    "Live order book visualization",
  ];

  const slides = [
    {
      title: "Your wealth,",
      titleHighlight: "perfectly managed",
      subtitle:
        "Experience a focused trading platform with confidence, security, and complete transparency.",
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
        "Monitor your positions from one dashboard and get insights that help you make better decisions.",
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
          <span className="welcome-badge">Secure Trading Platform</span>

          <div className="welcome-video-frame">
            <video
              className="welcome-video"
              src={tradingVideo}
              autoPlay
              loop
              muted
              playsInline
            />
            <div className="welcome-video-overlay">
              <h2>See TradeFlow in Action</h2>
              <p>Live market-focused visuals powered by your `trading.mp4` asset.</p>
            </div>
          </div>

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
              <Link to="/trading" className="welcome-btn welcome-btn-primary">
                Open trading sim
              </Link>
              <Link to="/trading" className="welcome-btn welcome-btn-secondary">
                Live dashboard
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
              <h2 className="welcome-benefits-title">Why Choose TradeFlow?</h2>
              <ul className="welcome-benefits-list">
                {benefits.map((benefit, index) => (
                  <li key={index}>
                    <CheckCircle size={20} />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              <Link to="/trading" className="welcome-btn welcome-btn-primary">
                Launch simulator
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Welcome;

