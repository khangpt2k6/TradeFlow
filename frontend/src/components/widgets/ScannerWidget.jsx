import React, { useMemo, useState } from "react";

const fmt = (n, d = 2) =>
  Number.isFinite(Number(n))
    ? Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
    : "—";

const MODES = [
  { key: "gainers", label: "Top Gain %" },
  { key: "losers",  label: "Top Loss %" },
  { key: "active",  label: "Most Active" },
];

const ScannerWidget = ({ assets, selectedSymbol, onSelect, flashMap }) => {
  const [mode, setMode] = useState("gainers");

  const rows = useMemo(() => {
    const copy = [...(assets || [])];
    if (mode === "gainers") {
      copy.sort((a, b) => Number(b.changePercent || 0) - Number(a.changePercent || 0));
    } else if (mode === "losers") {
      copy.sort((a, b) => Number(a.changePercent || 0) - Number(b.changePercent || 0));
    } else {
      // "Most active" — rank by absolute % move (no volume in model yet)
      copy.sort(
        (a, b) => Math.abs(Number(b.changePercent || 0)) - Math.abs(Number(a.changePercent || 0)),
      );
    }
    return copy.slice(0, 12);
  }, [assets, mode]);

  return (
    <div className="flex h-full flex-col">
      <div className="tf-drag-handle flex items-center justify-between border-b border-tf-border bg-black/30 px-3 py-1.5">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-tf-dim">Scanner</span>
        <span className="font-mono text-[10px] text-tf-mute">{rows.length} / {assets?.length || 0}</span>
      </div>
      <div className="flex gap-0.5 border-b border-tf-border bg-black/40 px-1.5 py-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={`flex-1 rounded px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition ${
              mode === m.key ? "bg-sky-500/15 text-slate-100" : "text-tf-mute hover:text-tf-text"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_minmax(0,1fr)_auto] gap-1.5 border-b border-tf-border bg-[#080c14] px-2.5 py-1.5 font-mono text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-tf-mute">
        <span>Symbol</span>
        <span className="text-right">Last</span>
        <span className="text-right">Chg%</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-tf-mute">Waiting for ticks…</div>
        ) : (
          rows.map((a) => {
            const chg = Number(a.changePercent || 0);
            const up = chg >= 0;
            const active = a.symbol === selectedSymbol;
            const flash = flashMap?.[a.symbol];
            return (
              <button
                key={a.symbol}
                type="button"
                onClick={() => onSelect?.(a.symbol)}
                className={`grid w-full grid-cols-[1fr_minmax(0,1fr)_auto] items-center gap-1.5 border-0 border-b border-l-2 border-slate-800/50 border-l-transparent bg-transparent px-2.5 py-1.5 text-left font-mono text-xs text-tf-text transition-colors hover:bg-sky-500/5 ${
                  active ? "bg-sky-500/10 !border-l-tf-accent" : ""
                } ${flash ? `tf-flash-${flash}-row` : ""}`}
              >
                <span className={`text-[11.5px] font-bold tracking-wide ${active ? "text-sky-300" : "text-slate-100"}`}>
                  {a.symbol}
                </span>
                <span className={`justify-self-end font-semibold tabular-nums ${up ? "text-tf-buy" : "text-tf-sell"} ${flash ? `tf-flash-${flash}-txt` : ""}`}>
                  {fmt(a.price, 2)}
                </span>
                <span className={`min-w-[56px] justify-self-end rounded px-1.5 py-0.5 text-right text-[10.5px] font-bold tabular-nums ${
                  up ? "bg-emerald-500/10 text-tf-buy" : "bg-red-500/10 text-tf-sell"
                }`}>
                  {up ? "+" : ""}{fmt(chg, 2)}%
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ScannerWidget;
