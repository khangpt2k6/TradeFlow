import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from "lightweight-charts";

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

// Exponential moving average over close prices. Period is # of candles.
const ema = (candles, period) => {
  if (!candles.length) return [];
  const k = 2 / (period + 1);
  const out = [];
  let prev = candles[0].close;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i].close;
    prev = i === 0 ? c : c * k + prev * (1 - k);
    out.push({ time: candles[i].time, value: prev });
  }
  return out;
};

// Session VWAP — cumulative typical-price * volume over cumulative volume.
const vwap = (candles) => {
  let pv = 0;
  let v = 0;
  return candles.map((c) => {
    const tp = (c.high + c.low + c.close) / 3;
    pv += tp * c.volume;
    v += c.volume;
    return { time: c.time, value: v ? pv / v : tp };
  });
};

const fmt = (n, d = 2) =>
  Number.isFinite(Number(n))
    ? Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
    : "—";

const CandlestickChart = ({ ticks, symbol }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const ema9Ref = useRef(null);
  const ema20Ref = useRef(null);
  const vwapRef = useRef(null);
  const [interval, setInterval] = useState("5s");
  const [hover, setHover] = useState(null);   // { o,h,l,c,v,ema9,ema20,vwap }
  const [show, setShow] = useState({ ema9: true, ema20: true, vwap: true });

  const candles = useMemo(() => aggregate(ticks, INTERVALS[interval]), [ticks, interval]);
  const ema9Data = useMemo(() => ema(candles, 9), [candles]);
  const ema20Data = useMemo(() => ema(candles, 20), [candles]);
  const vwapData = useMemo(() => vwap(candles), [candles]);

  const lastCandle = candles[candles.length - 1];

  // Default readout — the last candle — so the header isn't empty before hover.
  const readout = hover || (lastCandle && {
    o: lastCandle.open, h: lastCandle.high, l: lastCandle.low, c: lastCandle.close, v: lastCandle.volume,
    ema9: ema9Data[ema9Data.length - 1]?.value,
    ema20: ema20Data[ema20Data.length - 1]?.value,
    vwap: vwapData[vwapData.length - 1]?.value,
    time: lastCandle.time,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "#7a8899",
        fontFamily: "ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(26, 32, 48, 0.7)" },
        horzLines: { color: "rgba(26, 32, 48, 0.7)" },
      },
      rightPriceScale: {
        borderColor: "#1a2030",
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "#1a2030",
        timeVisible: true,
        secondsVisible: true,
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "rgba(0, 212, 255, 0.55)", width: 1, style: 3, labelBackgroundColor: "#00d4ff" },
        horzLine: { color: "rgba(0, 212, 255, 0.55)", width: 1, style: 3, labelBackgroundColor: "#00d4ff" },
      },
    });

    const priceSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceLineColor: "#00d4ff",
      priceLineStyle: 2,
      priceLineWidth: 1,
    });

    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: "rgba(122, 136, 153, 0.35)",
    });
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const ema9Series = chart.addSeries(LineSeries, {
      color: "#ffb000",
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    const ema20Series = chart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    const vwapSeries = chart.addSeries(LineSeries, {
      color: "#00d4ff",
      lineWidth: 1,
      lineStyle: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData || !param.seriesData.get(priceSeries)) {
        setHover(null);
        return;
      }
      const ohlc = param.seriesData.get(priceSeries);
      const v = param.seriesData.get(volSeries);
      const e9 = param.seriesData.get(ema9Series);
      const e20 = param.seriesData.get(ema20Series);
      const vw = param.seriesData.get(vwapSeries);
      setHover({
        time: param.time,
        o: ohlc.open,
        h: ohlc.high,
        l: ohlc.low,
        c: ohlc.close,
        v: v?.value,
        ema9: e9?.value,
        ema20: e20?.value,
        vwap: vw?.value,
      });
    });

    chartRef.current = chart;
    priceSeriesRef.current = priceSeries;
    volSeriesRef.current = volSeries;
    ema9Ref.current = ema9Series;
    ema20Ref.current = ema20Series;
    vwapRef.current = vwapSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      priceSeriesRef.current = null;
      volSeriesRef.current = null;
      ema9Ref.current = null;
      ema20Ref.current = null;
      vwapRef.current = null;
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
    ema9Ref.current?.setData(show.ema9 ? ema9Data : []);
    ema20Ref.current?.setData(show.ema20 ? ema20Data : []);
    vwapRef.current?.setData(show.vwap ? vwapData : []);
    if (candles.length > 0) {
      chartRef.current?.timeScale().scrollToRealTime();
    }
  }, [candles, ema9Data, ema20Data, vwapData, show]);

  const changeFromOpen = readout ? readout.c - readout.o : 0;
  const changePct = readout && readout.o ? (changeFromOpen / readout.o) * 100 : 0;
  const up = changeFromOpen >= 0;

  const readoutStat = (label, value, color, fmtFn = (v) => fmt(v, 2)) => (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[9px] font-bold uppercase tracking-widest text-tf-mute">{label}</span>
      <span className={`text-[11px] font-semibold tabular-nums ${color || "text-tf-text"}`}>
        {value == null || !Number.isFinite(Number(value)) ? "—" : fmtFn(value)}
      </span>
    </span>
  );

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* ================= Chart header — symbol, OHLCV readout, indicators, tf ================= */}
      <div className="tf-drag-handle flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-tf-border bg-black/60 px-2.5 py-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-extrabold tracking-wider text-slate-100">{symbol || "—"}</span>
          <span className="text-[9px] uppercase tracking-widest text-tf-mute">{interval} · {candles.length}</span>
        </div>

        {/* OHLCV readout — follows crosshair, falls back to last candle */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          {readoutStat("O", readout?.o)}
          {readoutStat("H", readout?.h, "text-tf-buy")}
          {readoutStat("L", readout?.l, "text-tf-sell")}
          {readoutStat("C", readout?.c, up ? "text-tf-buy" : "text-tf-sell")}
          {readoutStat("V", readout?.v, "text-tf-dim", (v) => fmt(v, 0))}
          <span className={`text-[11px] font-bold tabular-nums ${up ? "text-tf-buy" : "text-tf-sell"}`}>
            {up ? "+" : ""}{fmt(changeFromOpen, 2)} ({up ? "+" : ""}{fmt(changePct, 2)}%)
          </span>
        </div>

        {/* Indicator readouts — click legend to toggle */}
        <div className="flex items-center gap-2 border-l border-tf-border pl-2.5">
          <button
            type="button"
            onClick={() => setShow((s) => ({ ...s, ema9: !s.ema9 }))}
            className={`flex items-baseline gap-1 text-[10px] font-bold tabular-nums transition ${show.ema9 ? "" : "opacity-40"}`}
            title="Toggle EMA(9)"
          >
            <span className="inline-block h-[2px] w-3" style={{ background: "#ffb000" }} />
            <span className="text-[9px] uppercase tracking-wider text-tf-mute">EMA9</span>
            <span className="text-tf-text">{show.ema9 && Number.isFinite(readout?.ema9) ? fmt(readout.ema9, 2) : "—"}</span>
          </button>
          <button
            type="button"
            onClick={() => setShow((s) => ({ ...s, ema20: !s.ema20 }))}
            className={`flex items-baseline gap-1 text-[10px] font-bold tabular-nums transition ${show.ema20 ? "" : "opacity-40"}`}
            title="Toggle EMA(20)"
          >
            <span className="inline-block h-[2px] w-3" style={{ background: "#a855f7" }} />
            <span className="text-[9px] uppercase tracking-wider text-tf-mute">EMA20</span>
            <span className="text-tf-text">{show.ema20 && Number.isFinite(readout?.ema20) ? fmt(readout.ema20, 2) : "—"}</span>
          </button>
          <button
            type="button"
            onClick={() => setShow((s) => ({ ...s, vwap: !s.vwap }))}
            className={`flex items-baseline gap-1 text-[10px] font-bold tabular-nums transition ${show.vwap ? "" : "opacity-40"}`}
            title="Toggle VWAP"
          >
            <span className="inline-block h-[2px] w-3 border-t border-dashed" style={{ borderColor: "#00d4ff" }} />
            <span className="text-[9px] uppercase tracking-wider text-tf-mute">VWAP</span>
            <span className="text-tf-text">{show.vwap && Number.isFinite(readout?.vwap) ? fmt(readout.vwap, 2) : "—"}</span>
          </button>
        </div>

        {/* Timeframe selector — pushed to right */}
        <div className="ml-auto inline-flex gap-0.5 border border-tf-border bg-black/60 p-0.5">
          {Object.keys(INTERVALS).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setInterval(k)}
              className={`px-1.5 py-0.5 text-[10px] font-bold tracking-wider transition ${
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
