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
    const handle = () => renderD3Chart(series);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [series]);

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
    } catch {
      // best-effort metrics
    }
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
    const fillColor = up ? "rgba(34, 197, 94, 0.18)" : "rgba(239, 68, 68, 0.18)";
    const axisColor = "#64748b";
    const gridColor = "rgba(148, 163, 184, 0.08)";

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

    const yTicks = y.ticks(6);
    yTicks.forEach((t) => {
      svg
        .append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", y(t))
        .attr("y2", y(t))
        .attr("stroke", gridColor);
    });

    // Gradient area under line
    const gradId = `tf-grad-${up ? "up" : "down"}`;
    const defs = svg.append("defs");
    const grad = defs
      .append("linearGradient")
      .attr("id", gradId)
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 1);
    grad.append("stop").attr("offset", "0%").attr("stop-color", fillColor);
    grad.append("stop").attr("offset", "100%").attr("stop-color", "rgba(0,0,0,0)");

    const area = d3
      .area()
      .x((d) => x(new Date(d.timestamp)))
      .y0(height - margin.bottom)
      .y1((d) => y(d.price))
      .curve(d3.curveMonotoneX);

    svg
      .append("path")
      .datum(data)
      .attr("fill", `url(#${gradId})`)
      .attr("d", area);

    const line = d3
      .line()
      .x((d) => x(new Date(d.timestamp)))
      .y((d) => y(d.price))
      .curve(d3.curveMonotoneX);

    svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", lineColor)
      .attr("stroke-width", 1.8)
      .attr("d", line);

    // Last-price marker + label
    const lastX = x(new Date(data[data.length - 1].timestamp));
    const lastY = y(lastPrice);

    svg
      .append("line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", lastY)
      .attr("y2", lastY)
      .attr("stroke", lineColor)
      .attr("stroke-opacity", 0.35)
      .attr("stroke-dasharray", "3 4");

    svg
      .append("circle")
      .attr("cx", lastX)
      .attr("cy", lastY)
      .attr("r", 4)
      .attr("fill", lineColor);

    svg
      .append("rect")
      .attr("x", width - margin.right + 2)
      .attr("y", lastY - 10)
      .attr("width", 50)
      .attr("height", 20)
      .attr("rx", 3)
      .attr("fill", lineColor);

    svg
      .append("text")
      .attr("x", width - margin.right + 27)
      .attr("y", lastY + 4)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-family", "ui-monospace, Menlo, Consolas, monospace")
      .attr("font-weight", "700")
      .attr("fill", "#0b1220")
      .text(lastPrice.toFixed(2));

    // Y axis on the right
    const yAxis = svg
      .append("g")
      .attr("transform", `translate(${width - margin.right},0)`)
      .call(d3.axisRight(y).ticks(6).tickSize(0).tickPadding(6));
    yAxis.selectAll("text").attr("fill", axisColor).attr("font-size", "10px");
    yAxis.select("path").remove();

    const xAxis = svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
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
    <div className="tf-shell">
      {/* ================ Top status bar ================ */}
      <div className="tf-topbar">
        <div className="tf-topbar__left">
          <div className="tf-topbar__brand">
            <span className="tf-topbar__logo">TF</span>
            <div className="tf-topbar__meta">
              <span className="tf-topbar__name">TradeFlow</span>
              <span className="tf-topbar__tag">Market Simulator · Paper</span>
            </div>
          </div>
        </div>

        <div className="tf-topbar__center">
          <div className="tf-ticker">
            <span className="tf-ticker__sym">{selectedSymbol || "—"}</span>
            <span
              className={`tf-ticker__price ${selectedUp ? "up" : "down"} ${
                flashMap[selectedSymbol] ? `tf-flash-${flashMap[selectedSymbol]}` : ""
              }`}
              key={`tick-${selectedSymbol}-${selectedAsset?.price}`}
            >
              {selectedAsset ? fmt(selectedAsset.price, 2) : "—"}
            </span>
            <span className={`tf-ticker__chg ${selectedUp ? "up" : "down"}`}>
              {selectedUp ? "▲" : "▼"} {fmt(Math.abs(selectedChange), 2)}%
            </span>
          </div>
          <div className="tf-ticker__stats">
            <span><label>O</label><b>{fmt(sessionStats.open, 2)}</b></span>
            <span><label>H</label><b>{fmt(sessionStats.high, 2)}</b></span>
            <span><label>L</label><b>{fmt(sessionStats.low, 2)}</b></span>
            <span><label>MID</label><b>{fmt(orderBook.midPrice, 2)}</b></span>
            <span><label>SPRD</label><b>{spread != null ? fmt(spread, 4) : "—"}</b></span>
          </div>
        </div>

        <div className="tf-topbar__right">
          <div className="tf-acct">
            <span className="tf-acct__cell"><label>Equity</label><b>{fmtCash(portfolio.equity)}</b></span>
            <span className="tf-acct__cell"><label>Cash</label><b>{fmtCash(portfolio.cash)}</b></span>
            <span className="tf-acct__cell">
              <label>Session P&L</label>
              <b className={Number(portfolio.sessionPnl || 0) >= 0 ? "pos" : "neg"}>
                {Number(portfolio.sessionPnl || 0) >= 0 ? "+" : ""}
                {fmtCash(portfolio.sessionPnl)}
              </b>
            </span>
          </div>
          <div className={`tf-stream tf-stream--${streamStatus}`} title={API_BASE_URL}>
            <span className="tf-stream__dot" />
            <span className="tf-stream__label">{streamStatus}</span>
            <span className="tf-stream__host">{API_ORIGIN_LABEL}</span>
          </div>
        </div>
      </div>

      {/* ================ Main workspace ================ */}
      <div className="tf-workspace">
        {/* -------- Watchlist -------- */}
        <aside className="tf-panel tf-watch">
          <header className="tf-panel__head">
            <span className="tf-panel__title">Watchlist</span>
            <span className="tf-panel__sub">{assets.length} symbols</span>
          </header>
          <div className="tf-watch__head">
            <span>SYMBOL</span>
            <span>LAST</span>
            <span>CHG%</span>
          </div>
          <div className="tf-watch__body">
            {assets.map((asset) => {
              const up = Number(asset.changePercent) >= 0;
              const active = selectedSymbol === asset.symbol;
              return (
                <button
                  key={asset.symbol}
                  type="button"
                  className={`tf-watch__row ${active ? "is-active" : ""} ${
                    flashMap[asset.symbol] ? `tf-flash-${flashMap[asset.symbol]}` : ""
                  }`}
                  onClick={() => {
                    setSelectedSymbol(asset.symbol);
                    setOrderForm((prev) => ({ ...prev, symbol: asset.symbol }));
                  }}
                >
                  <span className="tf-watch__sym">{asset.symbol}</span>
                  <span
                    className={`tf-watch__last ${up ? "up" : "down"}`}
                    key={`last-${asset.symbol}-${asset.price}`}
                  >
                    {fmt(asset.price, 2)}
                  </span>
                  <span className={`tf-watch__chg ${up ? "up" : "down"}`}>
                    {up ? "+" : ""}
                    {fmt(asset.changePercent, 2)}%
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* -------- Chart -------- */}
        <section className="tf-panel tf-chart">
          <header className="tf-panel__head tf-chart__head">
            <div className="tf-chart__title">
              <span className="tf-chart__sym">{selectedSymbol}</span>
              <span className="tf-chart__name">{selectedAsset?.name || "Live tick chart"}</span>
            </div>
            <div className="tf-chart__tfs">
              {["1m", "5m", "15m", "1h", "1d"].map((t, i) => (
                <button key={t} type="button" className={i === 1 ? "is-active" : ""} disabled>
                  {t}
                </button>
              ))}
            </div>
          </header>
          <div ref={chartRef} className="tf-chart__canvas" />
          <footer className="tf-chart__foot">
            <span>
              REST <code>/api/trading</code>
            </span>
            <span>
              STOMP <code>/ws-market</code>
            </span>
            <span>
              Tape <code>/api/trading/tape</code>
            </span>
            <span>
              Working <code>/api/trading/working-orders</code>
            </span>
          </footer>
        </section>

        {/* -------- Order book (DOM) -------- */}
        <aside className="tf-panel tf-dom">
          <header className="tf-panel__head">
            <span className="tf-panel__title">Order Book</span>
            <span className="tf-panel__sub">{orderBook.symbol || selectedSymbol}</span>
          </header>
          <div className="tf-dom__head">
            <span>PRICE</span>
            <span>SIZE</span>
            <span>TOTAL</span>
          </div>
          <div className="tf-dom__side tf-dom__asks">
            {(orderBook.asks || [])
              .slice(0, 10)
              .slice()
              .reverse()
              .map((row, i) => {
                const qty = Number(row.quantity) || 0;
                const pct = Math.min(100, (qty / bookDepth) * 100);
                const total = Number(row.price) * qty;
                return (
                  <div key={`ask-${i}-${row.price}`} className="tf-dom__row tf-dom__row--ask">
                    <span className="tf-dom__bar" style={{ width: `${pct}%` }} />
                    <span className="tf-dom__price">{fmt(row.price, 4)}</span>
                    <span className="tf-dom__size">{fmt(qty, 2)}</span>
                    <span className="tf-dom__total">{fmt(total, 0)}</span>
                  </div>
                );
              })}
            {(!orderBook.asks || orderBook.asks.length === 0) && (
              <div className="tf-dom__empty">No asks</div>
            )}
          </div>
          <div className="tf-dom__spread">
            <span className="tf-dom__mid">{fmt(orderBook.midPrice, 4)}</span>
            <span className="tf-dom__spread-sub">
              spread {spread != null ? fmt(spread, 4) : "—"}
            </span>
          </div>
          <div className="tf-dom__side tf-dom__bids">
            {(orderBook.bids || []).slice(0, 10).map((row, i) => {
              const qty = Number(row.quantity) || 0;
              const pct = Math.min(100, (qty / bookDepth) * 100);
              const total = Number(row.price) * qty;
              return (
                <div key={`bid-${i}-${row.price}`} className="tf-dom__row tf-dom__row--bid">
                  <span className="tf-dom__bar" style={{ width: `${pct}%` }} />
                  <span className="tf-dom__price">{fmt(row.price, 4)}</span>
                  <span className="tf-dom__size">{fmt(qty, 2)}</span>
                  <span className="tf-dom__total">{fmt(total, 0)}</span>
                </div>
              );
            })}
            {(!orderBook.bids || orderBook.bids.length === 0) && (
              <div className="tf-dom__empty">No bids</div>
            )}
          </div>
        </aside>

        {/* -------- Order ticket -------- */}
        <aside className="tf-panel tf-ticket">
          <header className="tf-panel__head">
            <span className="tf-panel__title">Order Ticket</span>
            <span className="tf-panel__sub">{orderForm.symbol}</span>
          </header>

          <div className="tf-ticket__sides">
            <button
              type="button"
              className={`tf-ticket__side tf-ticket__side--buy ${orderForm.side === "BUY" ? "is-active" : ""}`}
              onClick={() => setOrderForm((prev) => ({ ...prev, side: "BUY" }))}
            >
              BUY
            </button>
            <button
              type="button"
              className={`tf-ticket__side tf-ticket__side--sell ${orderForm.side === "SELL" ? "is-active" : ""}`}
              onClick={() => setOrderForm((prev) => ({ ...prev, side: "SELL" }))}
            >
              SELL
            </button>
          </div>

          <form className="tf-ticket__form" onSubmit={placeOrder}>
            <label className="tf-field">
              <span>Symbol</span>
              <select
                value={orderForm.symbol}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, symbol: e.target.value }))}
              >
                {assets.map((asset) => (
                  <option key={asset.symbol} value={asset.symbol}>
                    {asset.symbol}
                  </option>
                ))}
              </select>
            </label>

            <label className="tf-field">
              <span>Order type</span>
              <select
                value={orderForm.orderType}
                onChange={(e) =>
                  setOrderForm((prev) => ({ ...prev, orderType: e.target.value, limitPrice: prev.limitPrice }))
                }
              >
                <option value="MARKET">MARKET</option>
                <option value="LIMIT">LIMIT</option>
              </select>
            </label>

            {orderForm.orderType === "LIMIT" && (
              <label className="tf-field">
                <span>Limit price</span>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  required
                  value={orderForm.limitPrice}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, limitPrice: e.target.value }))}
                />
              </label>
            )}

            <label className="tf-field">
              <span>Quantity</span>
              <input
                type="number"
                min="0.000001"
                step="0.000001"
                value={orderForm.quantity}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
              />
            </label>

            <div className="tf-ticket__presets">
              {QTY_PRESETS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setOrderForm((prev) => ({ ...prev, quantity: q }))}
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="tf-ticket__est">
              <span>Est. {orderForm.orderType === "LIMIT" ? "notional" : "cost"}</span>
              <b>{fmtCash(estCost)}</b>
            </div>

            <button
              type="submit"
              className={`tf-ticket__submit ${orderForm.side === "BUY" ? "is-buy" : "is-sell"}`}
            >
              {orderForm.side} · {orderForm.orderType} · {orderForm.quantity} {orderForm.symbol}
            </button>

            {message && <p className="tf-ticket__msg">{message}</p>}
          </form>

          <div className="tf-ticket__engine">
            <div><label>PROC</label><b>{engineMetrics.processedOrders || 0}</b></div>
            <div><label>REJ</label><b>{engineMetrics.rejectedOrders || 0}</b></div>
            <div><label>RETRY</label><b>{engineMetrics.retriesUsed || 0}</b></div>
            <div><label>REST</label><b>{engineMetrics.restingOrders ?? 0}</b></div>
          </div>
        </aside>
      </div>

      {/* ================ Bottom tabs ================ */}
      <div className="tf-panel tf-bottom">
        <div className="tf-tabs">
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
              className={`tf-tab ${bottomTab === key ? "is-active" : ""}`}
              onClick={() => setBottomTab(key)}
            >
              {label}
              <span className="tf-tab__count">{tabCounts[key]}</span>
            </button>
          ))}
        </div>

        <div className="tf-tab-body">
          {bottomTab === "positions" && (
            <div className="tf-table">
              <div className="tf-table__head tf-table__row tf-table__row--pos">
                <span>Symbol</span>
                <span>Asset</span>
                <span>Qty</span>
                <span>Last</span>
                <span>Market value</span>
              </div>
              {(portfolio.positions || []).length === 0 ? (
                <div className="tf-table__empty">No open positions.</div>
              ) : (
                (portfolio.positions || []).map((position) => (
                  <div key={position.symbol} className="tf-table__row tf-table__row--pos">
                    <span className="tf-table__sym">{position.symbol}</span>
                    <span className="tf-table__muted">{position.assetName}</span>
                    <span>{fmt(position.quantity, 4)}</span>
                    <span>${fmt(position.currentPrice, 2)}</span>
                    <span>${fmt(position.marketValue, 0)}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {bottomTab === "working" && (
            <div className="tf-table">
              <div className="tf-table__head tf-table__row tf-table__row--wrk">
                <span>ID</span>
                <span>Symbol</span>
                <span>Side</span>
                <span>Qty</span>
                <span>Limit price</span>
              </div>
              {workingOrders.length === 0 ? (
                <div className="tf-table__empty">No resting limit orders.</div>
              ) : (
                workingOrders.map((w) => (
                  <div key={w.restingOrderId} className="tf-table__row tf-table__row--wrk">
                    <span className="tf-table__muted">#{w.restingOrderId}</span>
                    <span className="tf-table__sym">{w.symbol}</span>
                    <span className={w.side === "BUY" ? "tf-buy" : "tf-sell"}>{w.side}</span>
                    <span>{fmt(w.quantity, 4)}</span>
                    <span>${fmt(w.limitPrice, 4)}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {bottomTab === "orders" && (
            <div className="tf-table">
              <div className="tf-table__head tf-table__row tf-table__row--ord">
                <span>ID</span>
                <span>Symbol</span>
                <span>Side</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Status</span>
              </div>
              {recentOrders.length === 0 ? (
                <div className="tf-table__empty">No orders in this session.</div>
              ) : (
                recentOrders.map((o) => (
                  <div key={`${o.tradeId}-${o.executedAt}`} className="tf-table__row tf-table__row--ord">
                    <span className="tf-table__muted">#{o.tradeId}</span>
                    <span className="tf-table__sym">{symbolOf(o.assetId)}</span>
                    <span className={o.tradeType === "BUY" ? "tf-buy" : "tf-sell"}>{o.tradeType}</span>
                    <span>{fmt(o.quantity, 4)}</span>
                    <span>${fmt(o.pricePerUnit, 4)}</span>
                    <span className={o.status === "COMPLETED" ? "tf-ok" : "tf-fail"}>{o.status}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {bottomTab === "tape" && (
            <div className="tf-table">
              <div className="tf-table__head tf-table__row tf-table__row--tape">
                <span>Time</span>
                <span>Symbol</span>
                <span>Side</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Status</span>
              </div>
              {tape.length === 0 ? (
                <div className="tf-table__empty">No prints yet — execute an order.</div>
              ) : (
                tape.map((row) => (
                  <div key={`${row.tradeId}-${row.timestamp}`} className="tf-table__row tf-table__row--tape">
                    <span className="tf-table__muted">{new Date(row.timestamp).toLocaleTimeString()}</span>
                    <span className="tf-table__sym">{row.symbol}</span>
                    <span className={row.side === "BUY" ? "tf-buy" : "tf-sell"}>{row.side}</span>
                    <span>{fmt(row.quantity, 4)}</span>
                    <span>${fmt(row.price, 4)}</span>
                    <span className={row.status === "COMPLETED" ? "tf-ok" : row.status === "FAILED" ? "tf-fail" : ""}>
                      {row.status === "COMPLETED" ? "FILL" : row.status === "FAILED" ? "FAIL" : row.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {bottomTab === "alerts" && (
            <div className="tf-table">
              {fraudAlerts.length === 0 ? (
                <div className="tf-table__empty">No risk alerts in the current session.</div>
              ) : (
                fraudAlerts.map((alert, index) => (
                  <div key={`${alert.timestamp}-${index}`} className="tf-alert">
                    <span className="tf-alert__type">{alert.type}</span>
                    <span className="tf-alert__sym">{alert.symbol}</span>
                    <span className="tf-alert__detail">{alert.detail}</span>
                    <span className="tf-alert__time">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TradingDashboard;
