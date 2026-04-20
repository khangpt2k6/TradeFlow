import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import * as d3 from "d3";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { API_BASE_URL } from "../config/api";

const API_ORIGIN_LABEL = (() => {
  try {
    return new URL(API_BASE_URL).host;
  } catch {
    return API_BASE_URL;
  }
})();

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
const PANEL = "flex flex-col min-w-0 rounded-xl border border-tf-border bg-tf-panel shadow-neu overflow-hidden";
const PANEL_HEAD = "flex items-center justify-between px-3 py-2 border-b border-tf-border bg-black/30";
const PANEL_TITLE = "text-[10.5px] font-extrabold tracking-[0.16em] uppercase text-tf-dim";
const PANEL_SUB = "text-[10.5px] font-mono text-tf-mute";
const MONO_NUM = "font-mono tabular-nums";
const LABEL_MICRO = "text-[9.5px] font-extrabold tracking-[0.14em] uppercase text-tf-mute";
const INPUT = "w-full px-2.5 py-2 rounded-md border border-tf-border bg-tf-inset text-tf-text font-mono text-[12.5px] font-semibold tabular-nums outline-none shadow-neu-inset focus:border-tf-accent transition";
const TAB_BTN = "px-4 py-2.5 bg-transparent border-0 border-b-2 border-transparent text-tf-dim text-[11.5px] font-bold tracking-wider uppercase cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap hover:text-tf-text transition-colors";

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

  const chartRef = useRef(null);
  const latestAssets = useRef([]);
  const prevPricesRef = useRef({});

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

  useEffect(() => {
    renderD3Chart(series);
  }, [series]);

  useEffect(() => {
    const handle = () => renderD3Chart(series);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [series]);

  // Price-flash tracking for motion feedback
  useEffect(() => {
    if (!assets || assets.length === 0) return;
    const directions = {};
    assets.forEach((a) => {
      const prev = prevPricesRef.current[a.symbol];
      const cur = Number(a.price);
      if (prev != null && cur !== prev) {
        directions[a.symbol] = cur > prev ? "up" : "down";
      }
      prevPricesRef.current[a.symbol] = cur;
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

  const bookDepth = useMemo(() => {
    const sums = [
      ...(orderBook.bids || []).map((r) => Number(r.quantity) || 0),
      ...(orderBook.asks || []).map((r) => Number(r.quantity) || 0),
    ];
    const max = sums.length ? Math.max(...sums) : 0;
    return max > 0 ? max : 1;
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

  const renderD3Chart = (data) => {
    const container = chartRef.current;
    if (!container) return;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 360;
    const margin = { top: 12, right: 56, bottom: 22, left: 12 };

    d3.select(container).selectAll("*").remove();
    if (!data || data.length === 0) return;

    const firstPrice = data[0].price;
    const lastPrice = data[data.length - 1].price;
    const up = lastPrice >= firstPrice;
    const lineColor = up ? "#22c55e" : "#ef4444";
    const fillColor = up ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)";
    const axisColor = "#64748b";
    const gridColor = "rgba(148,163,184,0.08)";

    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    const x = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => new Date(d.timestamp)))
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.price))
      .nice()
      .range([height - margin.bottom, margin.top]);

    y.ticks(6).forEach((t) => {
      svg
        .append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", y(t))
        .attr("y2", y(t))
        .attr("stroke", gridColor);
    });

    const gradId = `tf-grad-${up ? "up" : "down"}`;
    const defs = svg.append("defs");
    const grad = defs
      .append("linearGradient")
      .attr("id", gradId)
      .attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
    grad.append("stop").attr("offset", "0%").attr("stop-color", fillColor);
    grad.append("stop").attr("offset", "100%").attr("stop-color", "rgba(0,0,0,0)");

    const area = d3
      .area()
      .x((d) => x(new Date(d.timestamp)))
      .y0(height - margin.bottom)
      .y1((d) => y(d.price))
      .curve(d3.curveMonotoneX);

    svg.append("path").datum(data).attr("fill", `url(#${gradId})`).attr("d", area);

    const line = d3
      .line()
      .x((d) => x(new Date(d.timestamp)))
      .y((d) => y(d.price))
      .curve(d3.curveMonotoneX);

    svg.append("path").datum(data).attr("fill", "none").attr("stroke", lineColor).attr("stroke-width", 1.8).attr("d", line);

    const lastX = x(new Date(data[data.length - 1].timestamp));
    const lastY = y(lastPrice);

    svg.append("line")
      .attr("x1", margin.left).attr("x2", width - margin.right)
      .attr("y1", lastY).attr("y2", lastY)
      .attr("stroke", lineColor).attr("stroke-opacity", 0.35).attr("stroke-dasharray", "3 4");

    svg.append("circle").attr("cx", lastX).attr("cy", lastY).attr("r", 4).attr("fill", lineColor);

    svg.append("rect")
      .attr("x", width - margin.right + 2).attr("y", lastY - 10)
      .attr("width", 50).attr("height", 20).attr("rx", 3).attr("fill", lineColor);

    svg.append("text")
      .attr("x", width - margin.right + 27).attr("y", lastY + 4)
      .attr("text-anchor", "middle").attr("font-size", "11px")
      .attr("font-family", "ui-monospace, Menlo, Consolas, monospace")
      .attr("font-weight", "700").attr("fill", "#0b1220").text(lastPrice.toFixed(2));

    const yAxis = svg.append("g").attr("transform", `translate(${width - margin.right},0)`)
      .call(d3.axisRight(y).ticks(6).tickSize(0).tickPadding(6));
    yAxis.selectAll("text").attr("fill", axisColor).attr("font-size", "10px");
    yAxis.select("path").remove();

    const xAxis = svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%H:%M:%S")).tickSize(0).tickPadding(6));
    xAxis.selectAll("text").attr("fill", axisColor).attr("font-size", "10px");
    xAxis.select("path").remove();
  };

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
    <div className="tf-shell relative mx-auto max-w-[1760px] px-3.5 pt-3 pb-5 text-tf-text text-[12.5px]">
      {/* ================ Top bar ================ */}
      <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-tf-border bg-tf-panel px-4 py-2.5 shadow-neu">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg font-mono text-xs font-extrabold tracking-widest text-emerald-950 bg-gradient-to-br from-emerald-400 to-green-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_4px_12px_rgba(34,197,94,0.3)]">
            TF
          </div>
          <div className="leading-tight">
            <div className="text-sm font-extrabold tracking-wide text-slate-100">TradeFlow</div>
            <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-tf-mute">Market Simulator · Paper</div>
          </div>
        </div>

        {/* Center: ticker + OHL */}
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
          <div className="flex gap-3.5 font-mono text-[11.5px] tabular-nums">
            {[
              ["O", fmt(sessionStats.open, 2)],
              ["H", fmt(sessionStats.high, 2)],
              ["L", fmt(sessionStats.low, 2)],
              ["MID", fmt(orderBook.midPrice, 2)],
              ["SPRD", spread != null ? fmt(spread, 4) : "—"],
            ].map(([lbl, val]) => (
              <span key={lbl} className="flex items-center gap-1.5">
                <span className={LABEL_MICRO}>{lbl}</span>
                <b className="font-semibold text-tf-text">{val}</b>
              </span>
            ))}
          </div>
        </div>

        {/* Right: account + stream */}
        <div className="flex items-center justify-end gap-3.5">
          <div className="flex gap-4">
            {[
              ["Equity", fmtCash(portfolio.equity), "text-tf-text"],
              ["Cash", fmtCash(portfolio.cash), "text-tf-text"],
              ["Session P&L", (Number(portfolio.sessionPnl || 0) >= 0 ? "+" : "") + fmtCash(portfolio.sessionPnl),
                Number(portfolio.sessionPnl || 0) >= 0 ? "text-tf-buy" : "text-tf-sell"],
            ].map(([lbl, val, cls]) => (
              <div key={lbl} className="flex min-w-[70px] flex-col leading-none">
                <span className={LABEL_MICRO}>{lbl}</span>
                <b className={`mt-0.5 font-mono text-[13px] font-bold tabular-nums ${cls}`}>{val}</b>
              </div>
            ))}
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-widest ${
              streamStatus === "live"
                ? "border-emerald-500/45 bg-emerald-600/10 text-emerald-200"
                : streamStatus === "error"
                ? "border-red-500/45 bg-red-500/10 text-red-200"
                : "border-tf-border-2 bg-black/60 text-tf-dim"
            }`}
            title={API_BASE_URL}
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
            <span>{streamStatus}</span>
            <span className="font-medium normal-case tracking-normal text-tf-mute">{API_ORIGIN_LABEL}</span>
          </span>
        </div>
      </div>

      {/* ================ Workspace ================ */}
      <div className="mb-2.5 grid gap-2.5 grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_260px] xl:grid-cols-[210px_minmax(0,1fr)_280px_300px]">
        {/* Watchlist */}
        <aside className={`${PANEL} min-h-[480px]`}>
          <header className={PANEL_HEAD}>
            <span className={PANEL_TITLE}>Watchlist</span>
            <span className={PANEL_SUB}>{assets.length} symbols</span>
          </header>
          <div className="sticky top-0 z-10 grid grid-cols-[1fr_minmax(0,1fr)_auto] gap-1.5 border-b border-tf-border bg-[#080c14] px-2.5 py-1.5 font-mono text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-tf-mute">
            <span>Symbol</span>
            <span className="text-right">Last</span>
            <span className="text-right">Chg%</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {assets.map((asset) => {
              const up = Number(asset.changePercent) >= 0;
              const active = selectedSymbol === asset.symbol;
              const flash = flashMap[asset.symbol];
              return (
                <button
                  key={asset.symbol}
                  type="button"
                  onClick={() => {
                    setSelectedSymbol(asset.symbol);
                    setOrderForm((prev) => ({ ...prev, symbol: asset.symbol }));
                  }}
                  className={`grid w-full grid-cols-[1fr_minmax(0,1fr)_auto] items-center gap-1.5 border-0 border-b border-l-2 border-slate-800/50 border-l-transparent bg-transparent px-2.5 py-1.5 text-left font-mono text-xs text-tf-text transition-colors hover:bg-sky-500/5 ${
                    active ? "bg-sky-500/10 !border-l-tf-accent" : ""
                  } ${flash ? `tf-flash-${flash}-row` : ""}`}
                >
                  <span className="text-[11.5px] font-bold tracking-wide text-slate-100">{asset.symbol}</span>
                  <span className={`justify-self-end font-semibold tabular-nums ${up ? "text-tf-buy" : "text-tf-sell"}`}>
                    {fmt(asset.price, 2)}
                  </span>
                  <span className={`min-w-[54px] justify-self-end rounded px-1.5 py-0.5 text-right text-[10.5px] font-bold tabular-nums ${
                    up ? "bg-emerald-500/10 text-tf-buy" : "bg-red-500/10 text-tf-sell"
                  }`}>
                    {up ? "+" : ""}{fmt(asset.changePercent, 2)}%
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Chart */}
        <section className={`${PANEL} min-h-[480px]`}>
          <header className={`${PANEL_HEAD} px-3`}>
            <div className="flex min-w-0 items-baseline gap-2.5">
              <span className="font-mono text-sm font-extrabold tracking-wider text-slate-100">{selectedSymbol}</span>
              <span className="truncate text-[11px] text-tf-mute">{selectedAsset?.name || "Live tick chart"}</span>
            </div>
            <div className="inline-flex gap-0.5 rounded-md border border-tf-border bg-black/60 p-0.5">
              {["1m", "5m", "15m", "1h", "1d"].map((t, i) => (
                <button
                  key={t}
                  type="button"
                  disabled
                  className={`rounded px-2 py-0.5 font-mono text-[10.5px] font-bold tracking-wider cursor-default ${
                    i === 1 ? "bg-sky-500/15 text-slate-100" : "text-tf-mute"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </header>
          <div ref={chartRef} className="relative min-h-[380px] flex-1 [&>svg]:block [&>svg]:h-full [&>svg]:w-full" />
          <footer className="flex flex-wrap gap-3.5 border-t border-tf-border bg-black/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-tf-mute">
            {[
              ["REST", "/api/trading"],
              ["STOMP", "/ws-market"],
              ["TAPE", "/api/trading/tape"],
              ["WORKING", "/api/trading/working-orders"],
            ].map(([k, v]) => (
              <span key={k}>
                {k}
                <code className="ml-1 rounded border border-sky-500/20 bg-sky-500/10 px-1 py-[1px] font-mono text-[10px] normal-case tracking-normal text-sky-300">
                  {v}
                </code>
              </span>
            ))}
          </footer>
        </section>

        {/* Order book */}
        <aside className={`${PANEL} min-h-[480px]`}>
          <header className={PANEL_HEAD}>
            <span className={PANEL_TITLE}>Order Book</span>
            <span className={PANEL_SUB}>{orderBook.symbol || selectedSymbol}</span>
          </header>
          <div className="grid grid-cols-3 gap-1.5 border-b border-tf-border px-2.5 py-1.5 font-mono text-[9.5px] font-extrabold uppercase tracking-wider text-tf-mute">
            <span>Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total</span>
          </div>

          {/* Asks */}
          <div className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto">
            {(orderBook.asks || []).slice(0, 10).slice().reverse().map((row, i) => {
              const qty = Number(row.quantity) || 0;
              const pct = Math.min(100, (qty / bookDepth) * 100);
              const total = Number(row.price) * qty;
              return (
                <div key={`ask-${i}-${row.price}`} className="relative grid grid-cols-3 gap-1.5 px-2.5 py-[3px] font-mono text-[11px] tabular-nums leading-tight">
                  <span className="pointer-events-none absolute inset-y-0 right-0 z-0 bg-red-500/10 transition-[width] duration-300" style={{ width: `${pct}%` }} />
                  <span className="relative z-10 font-bold text-tf-sell">{fmt(row.price, 4)}</span>
                  <span className="relative z-10 text-right text-tf-text">{fmt(qty, 2)}</span>
                  <span className="relative z-10 text-right text-tf-dim">{fmt(total, 0)}</span>
                </div>
              );
            })}
            {(!orderBook.asks || orderBook.asks.length === 0) && (
              <div className="py-3 text-center text-[11px] text-tf-mute">No asks</div>
            )}
          </div>

          {/* Spread */}
          <div className="flex items-center justify-between border-y border-tf-border bg-gradient-to-b from-sky-500/10 to-sky-500/5 px-3 py-2 font-mono">
            <span className="text-sm font-extrabold tabular-nums text-slate-50">{fmt(orderBook.midPrice, 4)}</span>
            <span className="text-[10.5px] text-tf-mute">
              spread {spread != null ? fmt(spread, 4) : "—"}
            </span>
          </div>

          {/* Bids */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {(orderBook.bids || []).slice(0, 10).map((row, i) => {
              const qty = Number(row.quantity) || 0;
              const pct = Math.min(100, (qty / bookDepth) * 100);
              const total = Number(row.price) * qty;
              return (
                <div key={`bid-${i}-${row.price}`} className="relative grid grid-cols-3 gap-1.5 px-2.5 py-[3px] font-mono text-[11px] tabular-nums leading-tight">
                  <span className="pointer-events-none absolute inset-y-0 right-0 z-0 bg-emerald-500/10 transition-[width] duration-300" style={{ width: `${pct}%` }} />
                  <span className="relative z-10 font-bold text-tf-buy">{fmt(row.price, 4)}</span>
                  <span className="relative z-10 text-right text-tf-text">{fmt(qty, 2)}</span>
                  <span className="relative z-10 text-right text-tf-dim">{fmt(total, 0)}</span>
                </div>
              );
            })}
            {(!orderBook.bids || orderBook.bids.length === 0) && (
              <div className="py-3 text-center text-[11px] text-tf-mute">No bids</div>
            )}
          </div>
        </aside>

        {/* Order ticket */}
        <aside className={`${PANEL} min-h-[480px] col-span-full xl:col-span-1`}>
          <header className={PANEL_HEAD}>
            <span className={PANEL_TITLE}>Order Ticket</span>
            <span className={PANEL_SUB}>{orderForm.symbol}</span>
          </header>

          <div className="grid grid-cols-2 gap-1.5 border-b border-tf-border p-2.5">
            {[
              { key: "BUY", label: "BUY", active: "bg-tf-buy text-emerald-950 border-green-600 shadow-neu-buy", inactive: "bg-tf-raised text-tf-dim border-tf-border shadow-neu-raised" },
              { key: "SELL", label: "SELL", active: "bg-tf-sell text-red-950 border-red-600 shadow-neu-sell", inactive: "bg-tf-raised text-tf-dim border-tf-border shadow-neu-raised" },
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
                  <option key={a.symbol} value={a.symbol}>{a.symbol}</option>
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
                <option value="MARKET">MARKET</option>
                <option value="LIMIT">LIMIT</option>
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
                  className="rounded border border-tf-border bg-tf-raised py-1.5 font-mono text-[11px] font-bold text-tf-dim shadow-neu-raised transition hover:text-tf-text hover:border-tf-accent active:shadow-neu-inset"
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
              className={`mt-0.5 rounded-lg border-0 py-2.5 font-mono text-[12.5px] font-extrabold tracking-wider transition active:translate-y-px ${
                orderForm.side === "BUY"
                  ? "bg-tf-buy text-emerald-950 shadow-neu-buy hover:brightness-110"
                  : "bg-tf-sell text-red-950 shadow-neu-sell hover:brightness-110"
              }`}
            >
              {orderForm.side} · {orderForm.orderType} · {orderForm.quantity} {orderForm.symbol}
            </button>

            {message && (
              <p className="m-0 rounded-md border border-amber-400/25 bg-amber-400/10 px-2.5 py-1.5 font-mono text-[11px] text-amber-200">
                {message}
              </p>
            )}
          </form>

          <div className="mt-auto grid grid-cols-4 gap-px border-t border-tf-border bg-tf-border">
            {[
              ["PROC", engineMetrics.processedOrders || 0],
              ["REJ", engineMetrics.rejectedOrders || 0],
              ["RETRY", engineMetrics.retriesUsed || 0],
              ["REST", engineMetrics.restingOrders ?? 0],
            ].map(([lbl, v]) => (
              <div key={lbl} className="flex flex-col items-center justify-center gap-0.5 bg-tf-panel px-1.5 py-2">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-tf-mute">{lbl}</span>
                <b className="font-mono text-sm font-bold tabular-nums text-slate-100">{v}</b>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ================ Bottom tabs ================ */}
      <div className={`${PANEL} min-h-[220px]`}>
        <div className="flex overflow-x-auto border-b border-tf-border bg-black/40">
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

        <div className="max-h-[280px] overflow-y-auto">
          {bottomTab === "positions" && (
            <Table
              head={["Symbol", "Asset", "Qty", "Last", "Market value"]}
              cols="grid-cols-[90px_1.6fr_1fr_1fr_1fr]"
              rows={portfolio.positions || []}
              empty="No open positions."
              render={(p) => [
                <span key="s" className="font-bold tracking-wide text-slate-100">{p.symbol}</span>,
                <span key="n" className="text-tf-dim">{p.assetName}</span>,
                <span key="q">{fmt(p.quantity, 4)}</span>,
                <span key="p">${fmt(p.currentPrice, 2)}</span>,
                <span key="v">${fmt(p.marketValue, 0)}</span>,
              ]}
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
    </div>
  );
};

const Table = ({ head, cols, rows, empty, keyOf, render }) => (
  <div className="flex flex-col font-mono text-[11.5px]">
    <div className={`sticky top-0 z-10 grid ${cols} gap-2.5 border-b border-tf-border bg-[#080c14] px-3.5 py-2 text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-tf-mute`}>
      {head.map((h, i) => <span key={i}>{h}</span>)}
    </div>
    {rows.length === 0 ? (
      <div className="px-4 py-8 text-center text-[11.5px] text-tf-mute">{empty}</div>
    ) : (
      rows.map((r, i) => (
        <div key={keyOf ? keyOf(r) : r.symbol || i} className={`grid ${cols} items-center gap-2.5 border-b border-slate-800/50 px-3.5 py-1.5 tabular-nums`}>
          {render(r)}
        </div>
      ))
    )}
  </div>
);

export default TradingDashboard;
