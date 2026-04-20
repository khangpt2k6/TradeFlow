import React, { useState } from "react";
import { Link } from "react-router-dom";
import tradingVideo from "../trading.mp4";
import {
  ShieldLock,
  LightningCharge,
  ClockHistory,
  ArrowRight,
} from "react-bootstrap-icons";

const slides = [
  {
    title: "Your wealth,",
    highlight: "perfectly managed",
    subtitle:
      "A focused trading terminal with concurrent matching, streaming ticks, and honest execution — no login wall.",
  },
  {
    title: "Smart trading,",
    highlight: "simplified",
    subtitle:
      "Global markets, intuitive tooling. Real-time data and instant paper execution in one workspace.",
  },
  {
    title: "Complete control,",
    highlight: "always",
    subtitle:
      "Monitor positions, risk, and P&L from a single dashboard designed for dense information.",
  },
];

const features = [
  {
    icon: ShieldLock,
    title: "Simulation-grade controls",
    desc: "Concurrent matching, retry pipelines, and stress alerts.",
  },
  {
    icon: LightningCharge,
    title: "Faster workflows",
    desc: "Automated rebalancing and sub-second execution paths.",
  },
  {
    icon: ClockHistory,
    title: "24/7 visibility",
    desc: "Transparent reporting on risk, performance, positions.",
  },
];

const Welcome = () => {
  const [slide, setSlide] = useState(0);
  const current = slides[slide];

  return (
    <div className="flex min-h-[calc(100vh-72px)] w-full items-stretch bg-tf-bg px-4 py-4 text-tf-text md:px-6 md:py-6">
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-4 lg:grid-cols-[1.05fr_1fr] lg:gap-6">
        {/* LEFT — video panel */}
        <section className="relative flex min-h-[280px] overflow-hidden rounded-xl border border-tf-border bg-tf-panel shadow-neu">
          <video
            className="h-full w-full object-cover opacity-80"
            src={tradingVideo}
            autoPlay
            loop
            muted
            playsInline
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/80 via-black/30 to-transparent" />

          <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
            Secure trading platform
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
            <div className="hidden rounded-md border border-tf-border bg-tf-panel-2/80 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-tf-dim backdrop-blur md:block">
              trading.mp4 · simulator
            </div>
          </div>
        </section>

        {/* RIGHT — hero + CTAs + features */}
        <section className="flex flex-col justify-between gap-4">
          <div className="rounded-xl border border-tf-border bg-tf-panel p-5 shadow-neu md:p-6">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-tf-dim">
              <span className="rounded border border-tf-border bg-tf-panel-2 px-2 py-0.5 text-tf-accent">
                v1.0
              </span>
              <span>Paper engine · Spring Boot core</span>
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

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                to="/trading"
                className="inline-flex items-center gap-2 rounded-md border border-emerald-600 bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2.5 font-mono text-[12px] font-bold uppercase tracking-wider text-emerald-950 shadow-neu-buy transition hover:brightness-110"
              >
                Open trading sim
                <ArrowRight size={14} />
              </Link>
              <Link
                to="/trading"
                className="inline-flex items-center gap-2 rounded-md border border-tf-border bg-gradient-to-b from-[#0f1623] to-[#0a0f18] px-4 py-2.5 font-mono text-[12px] font-bold uppercase tracking-wider text-tf-text shadow-neu-raised transition hover:border-tf-accent hover:text-tf-accent"
              >
                Live dashboard
              </Link>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`h-7 w-7 rounded-md border font-mono text-[11px] font-bold transition ${
                      i === slide
                        ? "border-tf-accent bg-tf-accent/10 text-tf-accent shadow-neu-inset"
                        : "border-tf-border bg-tf-panel-2 text-tf-mute hover:text-tf-text"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tf-mute">
                Trusted by thousands
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-tf-border bg-tf-panel p-4 shadow-neu-raised transition hover:border-tf-accent/50"
              >
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-tf-border bg-gradient-to-br from-emerald-500/20 to-sky-500/20 text-tf-accent">
                  <f.icon size={16} />
                </div>
                <div className="text-[13px] font-semibold text-tf-text">
                  {f.title}
                </div>
                <div className="mt-1 text-[11.5px] leading-snug text-tf-dim">
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Welcome;
