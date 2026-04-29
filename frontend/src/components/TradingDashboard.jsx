import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { Responsive, WidthProvider } from "react-grid-layout";
import CandlestickChart from "./widgets/CandlestickChart";
import ScannerWidget from "./widgets/ScannerWidget";
import { API_BASE_URL } from "../config/api";

const ResponsiveGridLayout = WidthProvider(Responsive);

const LAYOUT_STORAGE_KEY = "tf.workspace.layout.v1";

const DEFAULT_LAYOUT_LG = [
  { i: "watchlist", x: 0,  y: 0,  w: 2,  h: 14, minW: 2, minH: 6  },
  { i: "chart",     x: 2,  y: 0,  w: 6,  h: 14, minW: 4, minH: 8  },
  { i: "book",      x: 8,  y: 0,  w: 2,  h: 14, minW: 2, minH: 8  },
  { i: "ticket",    x: 10, y: 0,  w: 2,  h: 14, minW: 2, minH: 10 },
  { i: "scanner",   x: 0,  y: 14, w: 2,  h: 10, minW: 2, minH: 6  },
  { i: "bottom",    x: 2,  y: 14, w: 10, h: 10, minW: 4, minH: 6  },
];

const loadSavedLayouts = () => {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const fmt = (n, d = 2) =>
  Number.isFinite(Number(n))
    ? Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
    : "—";

const fmtCash = (n) =>
  Number.isFinite(Number(n))
    ? "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : "$—";

const QTY_PRESETS = [1, 10, 100, 500];

// -- Style helpers (keep JSX short) ----------------------------------------
const PANEL = "flex flex-col min-w-0 border border-tf-border bg-tf-panel overflow-hidden";
const PANEL_HEAD = "flex items-center justify-between px-2.5 py-1 border-b border-tf-border bg-black/60";
const PANEL_TITLE = "text-[10px] font-bold tracking-[0.18em] uppercase text-tf-dim";
const PANEL_SUB = "text-[10px] text-tf-mute tabular-nums";
const MONO_NUM = "tabular-nums";
const LABEL_MICRO = "text-[9px] font-bold tracking-[0.16em] uppercase text-tf-mute";
const INPUT = "w-full px-2 py-1.5 border border-tf-border bg-[#03060a] text-tf-text text-[12px] font-semibold tabular-nums outline-none focus:border-tf-accent transition";
const TAB_BTN = "px-3 py-1.5 bg-transparent border-0 border-b border-transparent text-tf-dim text-[11px] font-bold tracking-wider uppercase cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap hover:text-tf-text transition-colors";

const statusColor = (status) => {
  if (status === "COMPLETED") return "text-teal-300 font-bold";
  if (status === "FAILED") return "text-tf-sell font-bold";
  return "tf-status-pending"; // yellow pulsing dot via CSS
};

const TradingDashboard = () => {
  const [assets, setAssets] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [series, setSeries] = useState([]);
  const [portfolio, setPortfolio] = useState({
    positionCount: 0,
    grossVolume: 0,
    currentValue: 0,
    startingCash: 100000,
    cash: 100000,
    equity: 100000,
    sessionPnl: 0,
    positions: [],
  });
  const [tape, setTape] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [streamStatus, setStreamStatus] = useState("connecting");
  const [orderForm, setOrderForm] = useState({
    symbol: "AAPL",
    side: "BUY",
    quantity: 1,
    orderType: "MARKET",
    limitPrice: "",
  });
  const [workingOrders, setWorkingOrders] = useState([]);
  const [engineMetrics, setEngineMetrics] = useState({ processedOrders: 0, rejectedOrders: 0, retriesUsed: 0 });
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [], midPrice: 0, symbol: "" });
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [message, setMessage] = useState("");
  const [bottomTab, setBottomTab] = useState("positions");
  const [flashMap, setFlashMap] = useState({});
  const [streamStats, setStreamStats] = useState({ tps: 0, advancers: 0, decliners: 0, symbols: 0 });
  const [watchFilter, setWatchFilter] = useState("");
  const [sessionStats, setSessionStats] = useState({ open: null, high: null, low: null, last: null });

  const latestAssets = useRef([]);

  const [layouts, setLayouts] = useState(
    () => loadSavedLayouts() || { lg: DEFAULT_LAYOUT_LG },
  );
  const onLayoutChange = (_current, all) => {
    setLayouts(all);
    try { localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(all)); } catch {}
  };
  const resetLayout = () => {
    try { localStorage.removeItem(LAYOUT_STORAGE_KEY); } catch {}
    setLayouts({ lg: DEFAULT_LAYOUT_LG });
  };

  useEffect(() => {
    fetchAssets();
    fetchPortfolio();
    fetchMetrics();
    fetchTape();
    fetchRecentOrders();
    fetchWorkingOrders();
  }, []);

  useEffect(() => {
    if (!selectedSymbol) return;
    fetchHistory(selectedSymbol);
    fetchOrderBook(selectedSymbol);
    fetchSessionStats(selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    const wsBase = `${API_BASE_URL.replace("/api", "")}/ws-market`;
    const client = new Client({
      webSocketFactory: () => {
        const sock = new SockJS(wsBase);
        sock.addEventListener("open", () => setStreamStatus("live"));
        sock.addEventListener("close", () => setStreamStatus("offline"));
        sock.addEventListener("error", () => setStreamStatus("error"));
        return sock;
      },
      reconnectDelay: 1000,
      onConnect: () => {
        setStreamStatus("live");
        client.subscribe("/topic/market", (frame) => {
          const payload = JSON.parse(frame.body);
          if (!payload.updates) return;

          latestAssets.current = payload.updates;
          setAssets(payload.updates);
          setStreamStats({
            tps: Number(payload.ticksPerSecond) || 0,
            advancers: Number(payload.advancers) || 0,
            decliners: Number(payload.decliners) || 0,
            symbols: Number(payload.symbolCount) || payload.updates.length,
          });

          const selected = payload.updates.find((asset) => asset.symbol === selectedSymbol);
          if (selected) {
            setSeries((prev) => {
              const next = [...prev, { timestamp: payload.timestamp, price: Number(selected.price) }];
              return next.slice(-150);
            });
          }
        });
      },
      onStompError: () => {
        setStreamStatus("error");
        setMessage("Live stream had an issue. Retrying...");
      },
    });

    setStreamStatus("connecting");
    client.activate();
    return () => {
      setStreamStatus("offline");
      client.deactivate();
    };
  }, [selectedSymbol]);

  // Flash decay — direction is supplied by the server in each tick (`a.direction`),
  // we only need to clear the highlight after the animation window.
  useEffect(() => {
    if (!assets || assets.length === 0) return;
    const directions = {};
    assets.forEach((a) => {
      if (a.direction === "up" || a.direction === "down") {
        directions[a.symbol] = a.direction;
      }
    });
    const keys = Object.keys(directions);
    if (keys.length === 0) return;
    setFlashMap((old) => ({ ...old, ...directions }));
    const timer = setTimeout(() => {
      setFlashMap((old) => {
        const next = { ...old };
        keys.forEach((k) => {
          if (next[k] === directions[k]) delete next[k];
        });
        return next;
      });
    }, 550);
    return () => clearTimeout(timer);
  }, [assets]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchMetrics();
      fetchFraudAlerts();
      fetchTape();
      fetchRecentOrders();
      fetchWorkingOrders();
      fetchPortfolio();
      if (selectedSymbol) {
        fetchOrderBook(selectedSymbol);
        fetchSessionStats(selectedSymbol);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const authHeaders = () => ({});

  const fetchAssets = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/trading/assets`, authHeaders());
      setAssets(response.data);
      latestAssets.current = response.data;
      if (response.data.length > 0 && !selectedSymbol) {
        const defaultSymbol = response.data[0].symbol;
        setSelectedSymbol(defaultSymbol);
        setOrderForm((prev) => ({ ...prev, symbol: defaultSymbol }));
      }
    } catch (error) {
      setMessage(error?.response?.data?.message || "Could not load assets");
    }
  };

  const fetchHistory = async (symbol) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/trading/assets/${symbol}/history`, authHeaders());
      const normalized = response.data.map((point) => ({
        timestamp: Number(point.timestamp),
        price: Number(point.price),
      }));
      setSeries(normalized);
    } catch {
      setSeries([]);
    }
  };

  const fetchPortfolio = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/trading/portfolio`, authHeaders());
      setPortfolio(response.data);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Could not load portfolio");
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/trading/metrics`, authHeaders());
      setEngineMetrics(response.data);
    } catch {}
  };

  const fetchOrderBook = async (symbol) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/trading/order-book/${symbol}`, authHeaders());
      setOrderBook(response.data);
    } catch {
      setOrderBook({ bids: [], asks: [], midPrice: 0, symbol: symbol || "" });
    }
  };

  const fetchFraudAlerts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/trading/fraud-alerts`, authHeaders());
      setFraudAlerts(response.data || []);
    } catch {
      setFraudAlerts([]);
    }
  };

  const fetchTape = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/trading/tape`, authHeaders());
      setTape(response.data || []);
    } catch {
      setTape([]);
    }
  };

  const fetchRecentOrders = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/trading/orders`, authHeaders());
      setRecentOrders(response.data || []);
    } catch {
      setRecentOrders([]);
    }
  };

  const fetchWorkingOrders = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/trading/working-orders`, authHeaders());
      setWorkingOrders(response.data || []);
    } catch {
      setWorkingOrders([]);
    }
  };

  const placeOrder = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      const payload = {
        symbol: orderForm.symbol,
        side: orderForm.side,
        quantity: orderForm.quantity,
        orderType: orderForm.orderType || "MARKET",
      };
      if (orderForm.orderType === "LIMIT") {
        payload.limitPrice = Number(orderForm.limitPrice);
      }
      const response = await axios.post(`${API_BASE_URL}/trading/orders`, payload, authHeaders());
      const execution = response.data.execution;
      if (execution.status === "RESTING") {
        setMessage(
          `${execution.side} limit ${execution.quantity} ${execution.symbol} @ ${Number(execution.limitPrice).toFixed(4)} — resting (#${execution.restingOrderId})`,
        );
      } else {
        setMessage(
          `${execution.side} ${execution.quantity} ${execution.symbol} ${execution.status === "COMPLETED" ? "filled" : execution.status} @ ${Number(execution.price).toFixed(4)}`,
        );
      }
      await Promise.all([fetchPortfolio(), fetchMetrics()]);
      fetchOrderBook(orderForm.symbol);
      fetchFraudAlerts();
      fetchTape();
      fetchRecentOrders();
      fetchWorkingOrders();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Order failed");
    }
  };

  const selectedAsset = useMemo(
    () => assets.find((a) => a.symbol === selectedSymbol) || null,
    [assets, selectedSymbol],
  );

  const sessionStats = useMemo(() => {
    if (!series || series.length === 0) return { open: null, high: null, low: null, last: null };
    const prices = series.map((p) => p.price);
    return {
      open: series[0].price,
      high: Math.max(...prices),
      low: Math.min(...prices),
      last: series[series.length - 1].price,
    };
  }, [series]);

  const selectedChange = selectedAsset ? Number(selectedAsset.changePercent) : 0;
  const selectedUp = selectedChange >= 0;

  // Cumulative depth from the spread outward — best price at cum = first level qty,
  // each subsequent level adds its size, so bars grow as you walk away from the touch.
  const { asksCum, bidsCum, depthMax } = useMemo(() => {
    const asks = (orderBook.asks || []).slice(0, 10);
    const bids = (orderBook.bids || []).slice(0, 10);
    let aSum = 0;
    const asksCum = asks.map((r) => {
      aSum += Number(r.quantity) || 0;
      return { ...r, cum: aSum };
    });
    let bSum = 0;
    const bidsCum = bids.map((r) => {
      bSum += Number(r.quantity) || 0;
      return { ...r, cum: bSum };
    });
    const depthMax = Math.max(aSum, bSum, 1);
    return { asksCum, bidsCum, depthMax };
  }, [orderBook]);

  const bestBid = orderBook.bids?.[0]?.price;
  const bestAsk = orderBook.asks?.[0]?.price;
  const spread =
    Number.isFinite(Number(bestBid)) && Number.isFinite(Number(bestAsk))
      ? Number(bestAsk) - Number(bestBid)
      : null;

  const estCost = useMemo(() => {
    const qty = Number(orderForm.quantity) || 0;
    const price =
      orderForm.orderType === "LIMIT"
        ? Number(orderForm.limitPrice) || 0
        : Number(selectedAsset?.price) || 0;
    return qty * price;
  }, [orderForm, selectedAsset]);


  const symbolOf = (assetId) =>
    assets.find((a) => a.assetId === assetId || a.assetId === Number(assetId))?.symbol || `#${assetId}`;

  const tabCounts = {
    positions: portfolio.positions?.length || 0,
    working: workingOrders.length,
    orders: recentOrders.length,
    tape: tape.length,
    alerts: fraudAlerts.length,
  };

  return (
    <div className="tf-shell relative mx-auto max-w-[1760px] px-2 pt-2 pb-4 text-tf-text text-[12px]">
      {/* ================ Top bar ================ */}
      <div className="mb-1.5 grid grid-cols-[1fr_auto] items-center gap-4 border border-tf-border bg-tf-panel px-3 py-1.5">
        {/* Ticker + OHL */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1">
          <div className="flex items-baseline gap-2.5 font-mono">
            <span className="text-lg font-extrabold tracking-wider text-slate-50">{selectedSymbol || "—"}</span>
            <span
              key={`tick-${selectedSymbol}-${selectedAsset?.price}`}
              className={`text-xl font-bold tabular-nums ${selectedUp ? "text-tf-buy" : "text-tf-sell"} ${
                flashMap[selectedSymbol] ? `tf-flash-${flashMap[selectedSymbol]}-txt` : ""
              }`}
            >
              {selectedAsset ? fmt(selectedAsset.price, 2) : "—"}
            </span>
            <span className={`rounded px-2 py-0.5 text-xs font-bold tabular-nums ${selectedUp ? "bg-emerald-500/15 text-tf-buy" : "bg-red-500/15 text-tf-sell"}`}>
              {selectedUp ? "▲" : "▼"} {fmt(Math.abs(selectedChange), 2)}%
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 font-mono text-[11px] tabular-nums">
            {[
              ["O", fmt(sessionStats.open, 2)],
              ["H", fmt(sessionStats.high, 2), "text-tf-buy"],
              ["L", fmt(sessionStats.low, 2), "text-tf-sell"],
              ["MID", fmt(orderBook.midPrice, 2)],
              ["SPRD", spread != null ? fmt(spread, 4) : "—"],
            ].map(([lbl, val, cls]) => (
              <span key={lbl} className="inline-flex items-center gap-1.5 rounded-md border border-tf-border bg-black/40 px-2 py-1">
                <span className="text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-tf-mute">{lbl}</span>
                <b className={`font-semibold ${cls || "text-tf-text"}`}>{val}</b>
              </span>
            ))}
          </div>
        </div>

        {/* Right: account + stream */}
        <div className="flex items-center justify-end gap-3">
          <div className="flex items-stretch gap-2">
            {[
              ["Equity", fmtCash(portfolio.equity)],
              ["Cash", fmtCash(portfolio.cash)],
            ].map(([lbl, val]) => (
              <div key={lbl} className="flex min-w-[78px] flex-col justify-center rounded-md border border-tf-border bg-black/30 px-2.5 py-1.5 leading-none">
                <span className={LABEL_MICRO}>{lbl}</span>
                <b className="mt-1 font-mono text-[12.5px] font-bold tabular-nums text-tf-text">{val}</b>
              </div>
            ))}
            {(() => {
              const pnl = Number(portfolio.sessionPnl || 0);
              const up = pnl >= 0;
              const sign = up ? "+" : "";
              return (
                <div className={`flex min-w-[120px] flex-col justify-center rounded-md border px-3 py-1.5 leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                  up
                    ? "border-emerald-500/40 bg-gradient-to-b from-emerald-500/15 to-emerald-500/5"
                    : "border-red-500/40 bg-gradient-to-b from-red-500/15 to-red-500/5"
                }`}>
                  <span className="flex items-center gap-1 text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-tf-mute">
                    <span className={`h-1 w-1 rounded-full ${up ? "bg-tf-buy" : "bg-tf-sell"}`} />
                    Session P&L
                  </span>
                  <b className={`mt-1 font-mono text-[16px] font-extrabold tabular-nums tracking-tight ${up ? "text-tf-buy" : "text-tf-sell"}`}>
                    {sign}{fmtCash(pnl)}
                  </b>
                </div>
              );
            })()}
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-widest ${
              streamStatus === "live"
                ? "border-emerald-500/45 bg-emerald-600/10 text-emerald-200"
                : streamStatus === "error"
                ? "border-red-500/45 bg-red-500/10 text-red-200"
                : "border-tf-border-2 bg-black/60 text-tf-dim"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                streamStatus === "live"
                  ? "bg-tf-buy shadow-[0_0_10px_currentColor] animate-pulse"
                  : streamStatus === "error"
                  ? "bg-tf-sell shadow-[0_0_10px_currentColor]"
                  : "bg-tf-mute"
              }`}
            />
            <span>{streamStatus === "live" ? "market live" : streamStatus}</span>
          </span>
        </div>
      </div>

      {/* ================ Market breadth strip ================ */}
      <div className="mb-1.5 flex items-center gap-3 overflow-hidden border border-tf-border bg-tf-panel px-2.5 py-1">
        <div className="flex shrink-0 flex-col leading-none">
          <span className={LABEL_MICRO}>Breadth</span>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] font-bold tabular-nums">
            <span className="text-tf-buy">▲{streamStats.advancers}</span>
            <span className="text-tf-mute">/</span>
            <span className="text-tf-sell">▼{streamStats.decliners}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col leading-none border-l border-tf-border pl-3">
          <span className={LABEL_MICRO}>Ticks/s</span>
          <b className="mt-0.5 font-mono text-[13px] font-bold tabular-nums text-tf-accent">{streamStats.tps}</b>
        </div>
        <div className="flex shrink-0 flex-col leading-none border-l border-tf-border pl-3">
          <span className={LABEL_MICRO}>Symbols</span>
          <b className="mt-0.5 font-mono text-[13px] font-bold tabular-nums text-tf-text">{streamStats.symbols || assets.length}</b>
        </div>
        <div className="flex min-w-0 flex-1 gap-[3px] overflow-x-auto border-l border-tf-border pl-3">
          {assets.map((a) => {
            const chg = Number(a.changePercent) || 0;
            const up = chg >= 0;
            const mag = Math.min(2, Math.abs(chg));
            const intensity = 0.12 + (mag / 2) * 0.6;
            const active = selectedSymbol === a.symbol;
            return (
              <button
                key={`heat-${a.symbol}`}
                type="button"
                onClick={() => {
                  setSelectedSymbol(a.symbol);
                  setOrderForm((p) => ({ ...p, symbol: a.symbol }));
                }}
                title={`${a.symbol} ${fmt(a.price, 2)} (${up ? "+" : ""}${fmt(chg, 2)}%)`}
                className={`group relative flex shrink-0 flex-col items-center justify-center overflow-hidden border px-1.5 py-[3px] text-[10px] font-bold leading-tight tabular-nums transition-colors hover:brightness-110 ${
                  active
                    ? "border-tf-accent ring-1 ring-sky-400/40"
                    : "border-white/5"
                }`}
                style={{
                  background: up
                    ? `linear-gradient(180deg, rgba(34,197,94,${intensity + 0.05}) 0%, rgba(34,197,94,${Math.max(0, intensity - 0.05)}) 100%)`
                    : `linear-gradient(180deg, rgba(239,68,68,${intensity + 0.05}) 0%, rgba(239,68,68,${Math.max(0, intensity - 0.05)}) 100%)`,
                  color: up ? "#d1fae5" : "#fee2e2",
                }}
              >
                <span className="tracking-wider drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]">{a.symbol}</span>
                <span className="text-[9px] font-semibold opacity-90">{up ? "+" : ""}{fmt(chg, 2)}%</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================ Workspace toolbar ================ */}
      <div className="mb-1 flex items-center justify-end px-0.5">
        <button
          type="button"
          onClick={resetLayout}
          title="Drag panel headers to rearrange · drag edges to resize"
          className="border border-tf-border bg-black/60 px-2 py-[3px] text-[10px] font-bold uppercase tracking-wider text-tf-dim transition hover:border-tf-accent hover:text-tf-text"
        >
          Reset Layout
        </button>
      </div>

      {/* ================ Workspace (draggable grid) ================ */}
      <ResponsiveGridLayout
        className="tf-workspace"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 12, sm: 8, xs: 4, xxs: 2 }}
        rowHeight={28}
        margin={[10, 10]}
        containerPadding={[0, 0]}
        draggableHandle=".tf-drag-handle"
        compactType="vertical"
        preventCollision={false}
        onLayoutChange={onLayoutChange}
      >
        {/* Watchlist */}
        <div key="watchlist" className={`${PANEL} tf-widget`}>
          <header className={`${PANEL_HEAD} tf-drag-handle`}>
            <span className={PANEL_TITLE}>Watchlist</span>
            <span className={PANEL_SUB}>{assets.length}</span>
          </header>
          <div className="border-b border-tf-border bg-black/40 px-1.5 py-1">
            <input
              type="text"
              value={watchFilter}
              onChange={(e) => setWatchFilter(e.target.value)}
              placeholder="Filter…"
              className="w-full border border-tf-border bg-[#03060a] px-1.5 py-[3px] text-[11px] uppercase text-tf-text outline-none placeholder:text-tf-mute focus:border-tf-accent"
            />
          </div>
          <div className="sticky top-0 z-10 grid grid-cols-[auto_1fr_auto_auto] gap-2 border-b border-tf-border bg-[#03060a] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-tf-mute">
            <span>Sym</span>
            <span className="text-right">Last</span>
            <span className="text-right">Chg</span>
            <span className="text-right">%</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {assets.filter((a) => !watchFilter || a.symbol.toLowerCase().includes(watchFilter.toLowerCase()) || (a.name || "").toLowerCase().includes(watchFilter.toLowerCase())).map((asset) => {
              const up = Number(asset.changePercent) >= 0;
              const active = selectedSymbol === asset.symbol;
              const flash = flashMap[asset.symbol];
              const chg = Number(asset.changePercent) || 0;
              const price = Number(asset.price) || 0;
              const absChg = (price * chg) / 100;
              return (
                <button
                  key={asset.symbol}
                  type="button"
                  onClick={() => {
                    setSelectedSymbol(asset.symbol);
                    setOrderForm((prev) => ({ ...prev, symbol: asset.symbol }));
                  }}
                  className={`grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-2 border-0 border-b border-l-2 border-slate-800/50 border-l-transparent bg-transparent px-2 py-[2px] text-left text-[11px] text-tf-text transition-colors hover:bg-sky-500/5 ${
                    active ? "bg-sky-500/10 !border-l-tf-accent" : ""
                  } ${flash ? `tf-flash-${flash}-row` : ""}`}
                >
                  <span className={`text-[11px] font-bold ${active ? "text-sky-300" : "text-slate-100"}`}>{asset.symbol}</span>
                  <span className={`justify-self-end font-semibold tabular-nums ${up ? "text-tf-buy" : "text-tf-sell"} ${flash ? `tf-flash-${flash}-txt` : ""}`}>
                    {fmt(asset.price, 2)}
                  </span>
                  <span className={`justify-self-end text-[10px] tabular-nums ${up ? "text-tf-buy" : "text-tf-sell"}`}>
                    {up ? "+" : ""}{fmt(absChg, 2)}
                  </span>
                  <span className={`min-w-[46px] justify-self-end text-right text-[10px] font-bold tabular-nums ${up ? "text-tf-buy" : "text-tf-sell"}`}>
                    {up ? "+" : ""}{fmt(chg, 2)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart */}
        <div key="chart" className={`${PANEL} tf-widget`}>
          <CandlestickChart ticks={series} symbol={selectedSymbol} />
        </div>

        {/* Order book */}
        <div key="book" className={`${PANEL} tf-widget`}>
          <header className={`${PANEL_HEAD} tf-drag-handle`}>
            <span className={PANEL_TITLE}>Order Book</span>
            <span className={PANEL_SUB}>{orderBook.symbol || selectedSymbol}</span>
          </header>
          <div className="grid grid-cols-3 gap-1.5 border-b border-tf-border px-2 py-[3px] text-[9px] font-bold uppercase tracking-wider text-tf-mute">
            <span>Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Σ Size</span>
          </div>

          {/* Asks — rendered worst→best so the best ask sits adjacent to the spread */}
          <div className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto">
            {asksCum.slice().reverse().map((row, i) => {
              const qty = Number(row.quantity) || 0;
              const pct = Math.min(100, (row.cum / depthMax) * 100);
              return (
                <div key={`ask-${i}-${row.price}`} className="relative grid grid-cols-3 gap-1.5 px-2 py-0 text-[11px] tabular-nums leading-[18px]">
                  <span className="pointer-events-none absolute inset-y-0 right-0 z-0 bg-red-500/18" style={{ width: `${pct}%` }} />
                  <span className="relative z-10 font-bold text-tf-sell">{fmt(row.price, 4)}</span>
                  <span className="relative z-10 text-right text-tf-text">{fmt(qty, 0)}</span>
                  <span className="relative z-10 text-right text-tf-dim">{fmt(row.cum, 0)}</span>
                </div>
              );
            })}
            {asksCum.length === 0 && (
              <div className="py-3 text-center text-[11px] text-tf-mute">No asks</div>
            )}
          </div>

          {/* Spread */}
          <div className="flex items-center justify-between border-y border-tf-border bg-sky-500/10 px-2.5 py-1">
            <span className="text-[13px] font-extrabold tabular-nums text-slate-50">{fmt(orderBook.midPrice, 4)}</span>
            <span className="text-[10px] tabular-nums text-tf-mute">
              SPRD {spread != null ? fmt(spread, 4) : "—"}
            </span>
          </div>

          {/* Bids — rendered best→worst, growing cumulative depth downward */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {bidsCum.map((row, i) => {
              const qty = Number(row.quantity) || 0;
              const pct = Math.min(100, (row.cum / depthMax) * 100);
              return (
                <div key={`bid-${i}-${row.price}`} className="relative grid grid-cols-3 gap-1.5 px-2 py-0 text-[11px] tabular-nums leading-[18px]">
                  <span className="pointer-events-none absolute inset-y-0 right-0 z-0 bg-emerald-500/18" style={{ width: `${pct}%` }} />
                  <span className="relative z-10 font-bold text-tf-buy">{fmt(row.price, 4)}</span>
                  <span className="relative z-10 text-right text-tf-text">{fmt(qty, 0)}</span>
                  <span className="relative z-10 text-right text-tf-dim">{fmt(row.cum, 0)}</span>
                </div>
              );
            })}
            {bidsCum.length === 0 && (
              <div className="py-3 text-center text-[11px] text-tf-mute">No bids</div>
            )}
          </div>
        </div>

        {/* Order ticket */}
        <div key="ticket" className={`${PANEL} tf-widget`}>
          <header className={`${PANEL_HEAD} tf-drag-handle`}>
            <span className={PANEL_TITLE}>Order Ticket</span>
            <span className={PANEL_SUB}>{orderForm.symbol}</span>
          </header>

          <div className="grid grid-cols-2 gap-1.5 border-b border-tf-border p-2.5">
            {[
              { key: "BUY", label: "BUY",
                active: "bg-gradient-to-b from-emerald-500 to-emerald-600 text-emerald-950 border-emerald-600 shadow-neu-buy",
                inactive: "bg-gradient-to-b from-[#0f1623] to-[#0a0f18] text-tf-dim border-tf-border shadow-neu-raised" },
              { key: "SELL", label: "SELL",
                active: "bg-gradient-to-b from-red-500 to-red-600 text-red-950 border-red-600 shadow-neu-sell",
                inactive: "bg-gradient-to-b from-[#0f1623] to-[#0a0f18] text-tf-dim border-tf-border shadow-neu-raised" },
            ].map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => setOrderForm((p) => ({ ...p, side: b.key }))}
                className={`rounded-lg border py-2.5 font-mono text-[12.5px] font-extrabold tracking-widest transition hover:brightness-110 ${
                  orderForm.side === b.key ? b.active : b.inactive
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          <form onSubmit={placeOrder} className="flex flex-col gap-2.5 p-2.5">
            <label className="flex flex-col gap-1">
              <span className={LABEL_MICRO}>Symbol</span>
              <select
                className={INPUT}
                value={orderForm.symbol}
                onChange={(e) => setOrderForm((p) => ({ ...p, symbol: e.target.value }))}
              >
                {assets.map((a) => (
                  <option key={a.symbol} value={a.symbol} style={{ background: "#0b1018", color: "#e5ecf5" }}>{a.symbol}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className={LABEL_MICRO}>Order type</span>
              <select
                className={INPUT}
                value={orderForm.orderType}
                onChange={(e) => setOrderForm((p) => ({ ...p, orderType: e.target.value, limitPrice: p.limitPrice }))}
              >
                <option value="MARKET" style={{ background: "#0b1018", color: "#e5ecf5" }}>MARKET</option>
                <option value="LIMIT" style={{ background: "#0b1018", color: "#e5ecf5" }}>LIMIT</option>
              </select>
            </label>

            {orderForm.orderType === "LIMIT" && (
              <label className="flex flex-col gap-1">
                <span className={LABEL_MICRO}>Limit price</span>
                <input
                  className={INPUT}
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  required
                  value={orderForm.limitPrice}
                  onChange={(e) => setOrderForm((p) => ({ ...p, limitPrice: e.target.value }))}
                />
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className={LABEL_MICRO}>Quantity</span>
              <input
                className={INPUT}
                type="number"
                min="0.000001"
                step="0.000001"
                value={orderForm.quantity}
                onChange={(e) => setOrderForm((p) => ({ ...p, quantity: Number(e.target.value) }))}
              />
            </label>

            <div className="grid grid-cols-4 gap-1">
              {QTY_PRESETS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setOrderForm((p) => ({ ...p, quantity: q }))}
                  className="rounded border border-tf-border bg-gradient-to-b from-[#0f1623] to-[#0a0f18] py-1.5 font-mono text-[11px] font-bold text-tf-dim shadow-neu-raised transition hover:text-tf-text hover:border-tf-accent active:shadow-neu-inset"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-md border border-sky-500/15 bg-sky-500/5 px-2.5 py-2 text-[11px] text-tf-dim">
              <span>Est. {orderForm.orderType === "LIMIT" ? "notional" : "cost"}</span>
              <b className="font-mono text-[13px] font-bold tabular-nums text-slate-100">{fmtCash(estCost)}</b>
            </div>

            <button
              type="submit"
              className={`group relative mt-0.5 overflow-hidden rounded-lg border py-3 font-mono text-[12.5px] font-extrabold uppercase tracking-[0.18em] transition active:translate-y-px ${
                orderForm.side === "BUY"
                  ? "border-emerald-400/60 bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 text-emerald-950 shadow-[0_6px_22px_-6px_rgba(34,197,94,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-110"
                  : "border-red-400/60 bg-gradient-to-b from-red-400 via-red-500 to-red-600 text-red-950 shadow-[0_6px_22px_-6px_rgba(239,68,68,0.55),inset_0_1px_0_rgba(255,255,255,0.3)] hover:brightness-110"
              }`}
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/40" />
              <span className="relative flex items-center justify-center gap-2">
                <span className="text-[14px]">{orderForm.side === "BUY" ? "▲" : "▼"}</span>
                <span>{orderForm.side}</span>
                <span className="opacity-50">·</span>
                <span>{orderForm.orderType}</span>
                <span className="opacity-50">·</span>
                <span className="tabular-nums">{orderForm.quantity}</span>
                <span>{orderForm.symbol}</span>
              </span>
            </button>

            {message && (
              <p className="m-0 rounded-md border border-amber-400/25 bg-amber-400/10 px-2.5 py-1.5 font-mono text-[11px] text-amber-200">
                {message}
              </p>
            )}
          </form>

          <div className="mt-auto grid grid-cols-3 gap-px border-t border-tf-border bg-tf-border">
            {[
              ["Filled", engineMetrics.processedOrders || 0],
              ["Rejected", engineMetrics.rejectedOrders || 0],
              ["Open", engineMetrics.restingOrders ?? 0],
            ].map(([lbl, v]) => (
              <div key={lbl} className="flex flex-col items-center justify-center gap-0.5 bg-tf-panel px-1.5 py-2">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-tf-mute">{lbl}</span>
                <b className="font-mono text-sm font-bold tabular-nums text-slate-100">{v}</b>
              </div>
            ))}
          </div>
        </div>

        {/* Scanner */}
        <div key="scanner" className={`${PANEL} tf-widget`}>
          <ScannerWidget
            assets={assets}
            selectedSymbol={selectedSymbol}
            flashMap={flashMap}
            onSelect={(sym) => {
              setSelectedSymbol(sym);
              setOrderForm((p) => ({ ...p, symbol: sym }));
            }}
          />
        </div>

        {/* Bottom tabs */}
        <div key="bottom" className={`${PANEL} tf-widget`}>
          <div className="tf-drag-handle flex overflow-x-auto border-b border-tf-border bg-black/40">
          {[
            ["positions", "Positions"],
            ["working", "Working"],
            ["orders", "Orders"],
            ["tape", "Time & Sales"],
            ["alerts", "Alerts"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setBottomTab(key)}
              className={`${TAB_BTN} ${bottomTab === key ? "!text-slate-100 !border-b-tf-accent" : ""}`}
            >
              {label}
              <span className={`rounded-[10px] px-1.5 py-px font-mono text-[10.5px] font-bold ${
                bottomTab === key ? "bg-sky-500/20 text-sky-200" : "bg-tf-border text-tf-dim"
              }`}>{tabCounts[key]}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {bottomTab === "positions" && (
            <Table
              head={["Symbol", "Asset", "Qty", "Last", "Market value"]}
              cols="grid-cols-[90px_1.6fr_1fr_1fr_1fr]"
              rows={portfolio.positions || []}
              empty="No open positions."
              render={(p) => {
                const live = assets.find((a) => a.symbol === p.symbol);
                const liveUp = live ? Number(live.changePercent) >= 0 : true;
                return [
                  <span key="s" className="font-bold tracking-wide text-sky-300">{p.symbol}</span>,
                  <span key="n" className="text-tf-dim">{p.assetName}</span>,
                  <span key="q" className="font-semibold text-tf-text tabular-nums">{fmt(p.quantity, 4)}</span>,
                  <span key="p" className={`font-semibold tabular-nums ${liveUp ? "text-tf-buy" : "text-tf-sell"}`}>${fmt(p.currentPrice, 2)}</span>,
                  <span key="v" className="font-bold tabular-nums text-slate-100">${fmt(p.marketValue, 0)}</span>,
                ];
              }}
            />
          )}
          {bottomTab === "working" && (
            <Table
              head={["ID", "Symbol", "Side", "Qty", "Limit price"]}
              cols="grid-cols-[90px_90px_60px_1fr_1fr]"
              rows={workingOrders}
              empty="No resting limit orders."
              keyOf={(w) => w.restingOrderId}
              render={(w) => [
                <span key="i" className="text-tf-dim">#{w.restingOrderId}</span>,
                <span key="s" className="font-bold tracking-wide text-slate-100">{w.symbol}</span>,
                <span key="sd" className={`font-bold ${w.side === "BUY" ? "text-tf-buy" : "text-tf-sell"}`}>{w.side}</span>,
                <span key="q">{fmt(w.quantity, 4)}</span>,
                <span key="p">${fmt(w.limitPrice, 4)}</span>,
              ]}
            />
          )}
          {bottomTab === "orders" && (
            <Table
              head={["ID", "Symbol", "Side", "Qty", "Price", "Status"]}
              cols="grid-cols-[90px_90px_60px_1fr_1fr_100px]"
              rows={recentOrders}
              empty="No orders in this session."
              keyOf={(o) => `${o.tradeId}-${o.executedAt}`}
              render={(o) => [
                <span key="i" className="text-tf-dim">#{o.tradeId}</span>,
                <span key="s" className="font-bold tracking-wide text-slate-100">{symbolOf(o.assetId)}</span>,
                <span key="sd" className={`font-bold ${o.tradeType === "BUY" ? "text-tf-buy" : "text-tf-sell"}`}>{o.tradeType}</span>,
                <span key="q">{fmt(o.quantity, 4)}</span>,
                <span key="p">${fmt(o.pricePerUnit, 4)}</span>,
                <span key="st" className={statusColor(o.status)}>{o.status}</span>,
              ]}
            />
          )}
          {bottomTab === "tape" && (
            <Table
              head={["Time", "Symbol", "Side", "Qty", "Price", "Status"]}
              cols="grid-cols-[110px_90px_60px_1fr_1fr_80px]"
              rows={tape}
              empty="No prints yet — execute an order."
              keyOf={(r) => `${r.tradeId}-${r.timestamp}`}
              render={(r) => [
                <span key="t" className="text-tf-dim">{new Date(r.timestamp).toLocaleTimeString()}</span>,
                <span key="s" className="font-bold tracking-wide text-slate-100">{r.symbol}</span>,
                <span key="sd" className={`font-bold ${r.side === "BUY" ? "text-tf-buy" : "text-tf-sell"}`}>{r.side}</span>,
                <span key="q">{fmt(r.quantity, 4)}</span>,
                <span key="p">${fmt(r.price, 4)}</span>,
                <span key="st" className={statusColor(r.status)}>
                  {r.status === "COMPLETED" ? "FILL" : r.status === "FAILED" ? "FAIL" : r.status}
                </span>,
              ]}
            />
          )}
          {bottomTab === "alerts" && (
            fraudAlerts.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11.5px] text-tf-mute">No risk alerts in the current session.</div>
            ) : (
              <div className="flex flex-col">
                {fraudAlerts.map((alert, i) => (
                  <div key={`${alert.timestamp}-${i}`} className="grid grid-cols-[auto_70px_1fr_auto] gap-2.5 border-b border-slate-800/50 px-4 py-2 font-mono text-[11.5px] text-amber-200">
                    <span className="self-center rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-extrabold tracking-widest">{alert.type}</span>
                    <span className="font-bold text-slate-100">{alert.symbol}</span>
                    <span className="text-tf-dim">{alert.detail}</span>
                    <span className="text-[10.5px] text-tf-mute">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
      </ResponsiveGridLayout>
    </div>
  );
};

const Table = ({ head, cols, rows, empty, keyOf, render }) => (
  <div className="flex flex-col text-[11px]">
    <div className={`sticky top-0 z-10 grid ${cols} gap-2.5 border-b border-tf-border bg-[#03060a] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-tf-mute`}>
      {head.map((h, i) => <span key={i}>{h}</span>)}
    </div>
    {rows.length === 0 ? (
      <div className="px-4 py-6 text-center text-[11px] text-tf-mute">{empty}</div>
    ) : (
      rows.map((r, i) => (
        <div key={keyOf ? keyOf(r) : r.symbol || i} className={`grid ${cols} items-center gap-2.5 border-b border-slate-800/50 px-3 py-[3px] tabular-nums`}>
          {render(r)}
        </div>
      ))
    )}
  </div>
);

export default TradingDashboard;
