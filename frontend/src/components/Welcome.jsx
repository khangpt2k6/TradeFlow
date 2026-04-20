import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import tradingVideo from "../trading.mp4";
import {
  ArrowRight,
  GraphUpArrow,
  Wallet2,
  Lightning,
  ShieldCheck,
  BarChartLine,
  CurrencyDollar,
  CashCoin,
  Bullseye,
} from "react-bootstrap-icons";

const slides = [
  {
    eyebrow: "Welcome to TradeFlow",
    title: "Your wealth,",
    highlight: "perfectly managed",
    subtitle:
      "Trade stocks, track your portfolio, and test strategies in a live market — all from one clean terminal.",
  },
  {
    eyebrow: "Built for focus",
    title: "Smart trading,",
    highlight: "simplified",
    subtitle:
      "Live prices and instant execution in a single workspace. No accounts, no fees, no login wall.",
  },
  {
    eyebrow: "Full visibility",
    title: "Complete control,",
    highlight: "always",
    subtitle:
      "Positions, orders, and session P&L — everything you need on a single dashboard.",
  },
];

const features = [
  {
    icon: GraphUpArrow,
    title: "Trade in real time",
    desc: "Place market or limit orders and watch them fill against a live ticker tape.",
  },
  {
    icon: Wallet2,
    title: "Track your portfolio",
    desc: "Follow positions, cash, equity, and session P&L at a glance.",
  },
  {
    icon: Bullseye,
    title: "Practice risk-free",
    desc: "Start with virtual cash and sharpen your edge without risking a dollar.",
  },
];

const stats = [
  { icon: BarChartLine, label: "Live symbols", value: "28" },
  { icon: CashCoin, label: "Starting balance", value: "$100,000" },
  { icon: Lightning, label: "Order types", value: "Market · Limit" },
  { icon: ShieldCheck, label: "Access", value: "No login" },
];

const Welcome = () => {
  const [slide, setSlide] = useState(0);
  const current = slides[slide];

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % slides.length), 6500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-tf-bg px-4 py-4 text-tf-text md:px-6 md:py-6">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 md:gap-6">
        {/* ================ Hero ================ */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_1fr] lg:gap-6">
          {/* LEFT — video panel */}
          <section className="relative flex min-h-[320px] overflow-hidden rounded-xl border border-tf-border bg-tf-panel shadow-neu">
            <video
              className="h-full w-full object-cover opacity-80"
              src={tradingVideo}
              autoPlay
              loop
              muted
              playsInline
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/85 via-black/35 to-transparent" />

            <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
              Live market
            </span>

            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-tf-dim">
                  Live feed
                </div>
                <div className="mt-1 text-base font-semibold md:text-lg">
                  TradeFlow in action
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT — hero copy + CTAs */}
          <section className="flex flex-col justify-center rounded-xl border border-tf-border bg-tf-panel p-6 shadow-neu md:p-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-tf-accent">
              {current.eyebrow}
            </div>

            <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight md:text-4xl lg:text-[2.6rem]">
              {current.title}
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-sky-300 to-sky-500 bg-clip-text text-transparent">
                {current.highlight}
              </span>
            </h1>
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-tf-dim md:text-[15px]">
              {current.subtitle}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/trading"
                className="inline-flex items-center gap-2 rounded-md border border-emerald-600 bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2.5 font-mono text-[12px] font-bold uppercase tracking-wider text-emerald-950 shadow-neu-buy transition hover:brightness-110"
              >
                Start trading
                <ArrowRight size={14} />
              </Link>
              <Link
                to="/trading"
                className="inline-flex items-center gap-2 rounded-md border border-tf-border bg-gradient-to-b from-[#0f1623] to-[#0a0f18] px-4 py-2.5 font-mono text-[12px] font-bold uppercase tracking-wider text-tf-text shadow-neu-raised transition hover:border-tf-accent hover:text-tf-accent"
              >
                View dashboard
              </Link>
            </div>

            <div className="mt-6 flex items-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === slide
                      ? "w-8 bg-tf-accent"
                      : "w-4 bg-tf-border hover:bg-tf-dim"
                  }`}
                />
              ))}
            </div>
          </section>
        </div>

        {/* ================ Stats strip ================ */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-tf-border bg-tf-panel p-3 shadow-neu-raised sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-lg border border-tf-border bg-black/30 px-3 py-2.5"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-tf-border bg-gradient-to-br from-emerald-500/15 to-sky-500/15 text-tf-accent">
                <s.icon size={16} />
              </span>
              <div className="min-w-0 leading-tight">
                <div className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-tf-mute">
                  {s.label}
                </div>
                <div className="mt-0.5 truncate font-mono text-[13px] font-bold tabular-nums text-tf-text">
                  {s.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ================ What you can do ================ */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold tracking-tight text-tf-text md:text-xl">
              What you can do
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tf-mute">
              Everything, one terminal
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-tf-border bg-tf-panel p-5 shadow-neu-raised transition hover:border-tf-accent/50 hover:shadow-neu"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-tf-border bg-gradient-to-br from-emerald-500/20 to-sky-500/20 text-tf-accent transition group-hover:scale-105">
                  <f.icon size={18} />
                </div>
                <div className="text-[14px] font-semibold text-tf-text">
                  {f.title}
                </div>
                <div className="mt-1.5 text-[12.5px] leading-relaxed text-tf-dim">
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ================ Bottom CTA ================ */}
        <section className="flex flex-col items-start justify-between gap-4 rounded-xl border border-tf-border bg-gradient-to-br from-emerald-500/10 via-tf-panel to-sky-500/10 p-5 shadow-neu md:flex-row md:items-center md:p-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-tf-accent">
              Ready when you are
            </div>
            <h3 className="mt-1.5 text-xl font-bold tracking-tight text-tf-text md:text-2xl">
              Jump into the trading terminal
            </h3>
            <p className="mt-1.5 max-w-[60ch] text-[13px] text-tf-dim">
              Browse live quotes, place orders, and watch your portfolio update in real time.
            </p>
          </div>
          <Link
            to="/trading"
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-emerald-600 bg-gradient-to-b from-emerald-500 to-emerald-600 px-5 py-3 font-mono text-[12px] font-bold uppercase tracking-wider text-emerald-950 shadow-neu-buy transition hover:brightness-110"
          >
            Open trading
            <ArrowRight size={14} />
          </Link>
        </section>
      </div>
    </div>
  );
};

export default Welcome;
