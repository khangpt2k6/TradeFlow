import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CandlestickSeries, HistogramSeries } from "lightweight-charts";

const INTERVALS = {
  "1s":  1,
  "5s":  5,
  "15s": 15,
  "1m":  60,
  "5m":  300,
};

const bucketTime = (tsMs, sec) => Math.floor(tsMs / 1000 / sec) * sec;

// Aggregate raw {timestamp, price} ticks into OHLC candles for a given interval.
const aggregate = (ticks, intervalSec) => {
  if (!ticks || ticks.length === 0) return [];
  const map = new Map();
  for (const t of ticks) {
    const price = Number(t.price);
    if (!Number.isFinite(price)) continue;
    const time = bucketTime(Number(t.timestamp), intervalSec);
    const c = map.get(time);
    if (!c) {
      map.set(time, { time, open: price, high: price, low: price, close: price, volume: 1 });
    } else {
      c.high = Math.max(c.high, price);
      c.low = Math.min(c.low, price);
      c.close = price;
      c.volume += 1;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
};

const CandlestickChart = ({ ticks, symbol }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const [interval, setInterval] = useState("5s");

  const candles = useMemo(() => aggregate(ticks, INTERVALS[interval]), [ticks, interval]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "#8393ab",
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" },
      },
      rightPriceScale: {
        borderColor: "rgba(148,163,184,0.15)",
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "rgba(148,163,184,0.15)",
        timeVisible: true,
        secondsVisible: true,
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "rgba(148,163,184,0.5)", width: 1, style: 3 },
        horzLine: { color: "rgba(148,163,184,0.5)", width: 1, style: 3 },
      },
    });

    const priceSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: "rgba(56,189,248,0.35)",
    });
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    priceSeriesRef.current = priceSeries;
    volSeriesRef.current = volSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      priceSeriesRef.current = null;
      volSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!priceSeriesRef.current || !volSeriesRef.current) return;
    priceSeriesRef.current.setData(candles);
    volSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)",
      })),
    );
    if (candles.length > 0) {
      chartRef.current?.timeScale().scrollToRealTime();
    }
  }, [candles]);

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="tf-drag-handle flex items-center justify-between border-b border-tf-border bg-black/30 px-3 py-1.5">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[12px] font-extrabold tracking-wider text-slate-100">{symbol}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-tf-mute">
            {candles.length} candles · {interval}
          </span>
        </div>
        <div className="inline-flex gap-0.5 rounded-md border border-tf-border bg-black/60 p-0.5">
          {Object.keys(INTERVALS).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setInterval(k)}
              className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider transition ${
                interval === k ? "bg-sky-500/20 text-slate-100" : "text-tf-mute hover:text-tf-text"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="relative flex-1 min-h-0" />
    </div>
  );
};

export default CandlestickChart;
