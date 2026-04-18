import React, { useEffect, useRef, useState } from "react";
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
  const [orderForm, setOrderForm] = useState({ symbol: "AAPL", side: "BUY", quantity: 1 });
  const [engineMetrics, setEngineMetrics] = useState({ processedOrders: 0, rejectedOrders: 0, retriesUsed: 0 });
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [], midPrice: 0, symbol: "" });
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [message, setMessage] = useState("");

  const chartRef = useRef(null);
  const latestAssets = useRef([]);

  useEffect(() => {
    fetchAssets();
    fetchPortfolio();
    fetchMetrics();
    fetchTape();
    fetchRecentOrders();
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
    const interval = setInterval(() => {
      fetchMetrics();
      fetchFraudAlerts();
      fetchTape();
      fetchRecentOrders();
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

  const placeOrder = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      const response = await axios.post(`${API_BASE_URL}/trading/orders`, orderForm, authHeaders());
      const execution = response.data.execution;
      setMessage(`${execution.side} ${execution.quantity} ${execution.symbol} executed @ ${execution.price}`);
      await Promise.all([fetchPortfolio(), fetchMetrics()]);
      fetchOrderBook(orderForm.symbol);
      fetchFraudAlerts();
      fetchTape();
      fetchRecentOrders();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Order failed");
    }
  };

  const renderD3Chart = (data) => {
    const container = chartRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = 280;
    const margin = { top: 16, right: 18, bottom: 24, left: 52 };

    d3.select(container).selectAll("*").remove();
    if (!data || data.length === 0) return;

    const bodyStyle = getComputedStyle(document.body);
    const lineColor = bodyStyle.getPropertyValue("--chart-line").trim() || "#2cc2ff";
    const axisColor = bodyStyle.getPropertyValue("--chart-axis").trim() || "#89a8c4";
    const gridColor = bodyStyle.getPropertyValue("--chart-grid").trim() || "rgba(148, 163, 184, 0.15)";

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

    const yTicks = y.ticks(5);
    yTicks.forEach((t) => {
      svg
        .append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", y(t))
        .attr("y2", y(t))
        .attr("stroke", gridColor)
        .attr("stroke-dasharray", "4 6");
    });

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
      .attr("stroke-width", 2.4)
      .attr("d", line);

    const xAxis = svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%H:%M:%S")));
    xAxis.selectAll("text").attr("fill", axisColor);
    xAxis.selectAll("path, line").attr("stroke", axisColor);

    const yAxis = svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5));
    yAxis.selectAll("text").attr("fill", axisColor);
    yAxis.selectAll("path, line").attr("stroke", axisColor);
  };

  return (
    <div className="trading-page">
      <header className="trading-hero mx-auto w-full max-w-7xl">
        <div className="trading-hero__top">
          <div className="trading-hero__brand">
            <div className="trading-hero__name-row">
              <h1 className="trading-hero__title">TradeFlow</h1>
              <span className="trading-hero__badge">Live sim</span>
            </div>
            <p className="trading-hero__tagline">
              Watchlist · Depth · Time &amp; sales · Paper cash &amp; equity · Streamed ticks
            </p>
          </div>
          <div className="trading-hero__metrics" aria-label="Connection">
            <div className="trading-metric" title={API_BASE_URL}>
              <span className="trading-metric__label">API</span>
              <span className="trading-metric__value">{API_ORIGIN_LABEL}</span>
            </div>
            <div className={`trading-metric trading-metric--stream ${streamStatus}`} title="WebSocket market feed">
              <span className="trading-metric__label">Stream</span>
              <span className="trading-metric__value">{streamStatus}</span>
            </div>
            {orderBook.midPrice > 0 && (
              <div className="trading-metric trading-metric--accent">
                <span className="trading-metric__label">Mid</span>
                <span className="trading-metric__value">{Number(orderBook.midPrice).toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="trading-hero__endpoints" role="list" aria-label="Integration endpoints">
          <span className="trading-endpoint-pill" role="listitem">
            REST <kbd>/api/trading</kbd>
          </span>
          <span className="trading-endpoint-pill" role="listitem">
            STOMP <kbd>/ws-market</kbd>
          </span>
          <span className="trading-endpoint-pill" role="listitem">
            Tape <kbd>/api/trading/tape</kbd>
          </span>
        </div>

        <details className="trading-hero__details">
          <summary>Simulation scope &amp; limits</summary>
          <p>
            Paper account starts at <strong>$100,000</strong> cash. Market orders only; fills update cash, positions,
            time &amp; sales, and session P&amp;L (mark-to-market on streamed prices). Synthetic book depth and risk
            alerts exercise the control path. This is a <strong>lab console</strong>, not a brokerage product.
          </p>
        </details>
      </header>

      <div className="trading-layout">
        <div className="trading-main-stack">
          <section className="panel trading-panel-market">
            <h3>Watchlist &amp; chart</h3>
            <div className="asset-list">
              {assets.map((asset) => (
                <button
                  key={asset.symbol}
                  type="button"
                  className={`asset-chip ${selectedSymbol === asset.symbol ? "active" : ""}`}
                  onClick={() => {
                    setSelectedSymbol(asset.symbol);
                    setOrderForm((prev) => ({ ...prev, symbol: asset.symbol }));
                  }}
                >
                  <span className="asset-chip__symbol">{asset.symbol}</span>
                  <span className="asset-chip__row">
                    <strong className="asset-chip__price">{Number(asset.price).toFixed(2)}</strong>
                    <span
                      className={`asset-chip__change ${
                        Number(asset.changePercent) >= 0 ? "up" : "down"
                      }`}
                    >
                      {Number(asset.changePercent) >= 0 ? "+" : ""}
                      {Number(asset.changePercent).toFixed(2)}%
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div ref={chartRef} className="chart-shell" />
          </section>

          <section className="panel trading-panel-book">
            <h3>Order Book ({orderBook.symbol || selectedSymbol})</h3>
            <div className="orderbook-grid">
              <div>
                <h4>Bids</h4>
                {(orderBook.bids || []).map((row, i) => (
                  <div key={`bid-${i}-${row.price}`} className="book-row bid">
                    <span>{Number(row.price).toFixed(4)}</span>
                    <span>{Number(row.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4>Asks</h4>
                {(orderBook.asks || []).map((row, i) => (
                  <div key={`ask-${i}-${row.price}`} className="book-row ask">
                    <span>{Number(row.price).toFixed(4)}</span>
                    <span>{Number(row.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="trading-sim-panels">
            <section className="panel trading-panel-tape">
              <h3>Time &amp; sales</h3>
              <p className="muted" style={{ fontSize: "0.78rem", marginTop: 0 }}>
                Last prints from the simulation matching engine (newest first).
              </p>
              <div className="tape-shell" role="log" aria-live="polite">
                <div className="tape-row tape-row--head">
                  <span>Time</span>
                  <span>Sym</span>
                  <span>Side</span>
                  <span className="tape-col-hide-sm">Qty</span>
                  <span>Price</span>
                  <span>Sts</span>
                </div>
                {tape.length === 0 && (
                  <div className="tape-row">
                    <span style={{ gridColumn: "1 / -1", color: "#64748b" }}>No prints yet — execute an order.</span>
                  </div>
                )}
                {tape.map((row) => (
                  <div key={`${row.tradeId}-${row.timestamp}`} className="tape-row">
                    <span>{new Date(row.timestamp).toLocaleTimeString()}</span>
                    <span>{row.symbol}</span>
                    <span className={row.side === "BUY" ? "tape-side-buy" : "tape-side-sell"}>{row.side}</span>
                    <span className="tape-col-hide-sm">{Number(row.quantity).toFixed(4)}</span>
                    <span>{Number(row.price).toFixed(4)}</span>
                    <span
                      className={
                        row.status === "COMPLETED" ? "tape-status-ok" : row.status === "FAILED" ? "tape-status-fail" : ""
                      }
                    >
                      {row.status === "COMPLETED" ? "FILL" : row.status === "FAILED" ? "FAIL" : row.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel trading-panel-recent">
              <h3>Recent orders</h3>
              <p className="muted" style={{ fontSize: "0.78rem", marginTop: 0 }}>
                Session blotter (fills and engine failures).
              </p>
              <div className="orders-shell">
                <div className="orders-row orders-row--head">
                  <span>ID</span>
                  <span>Asset</span>
                  <span>Side</span>
                  <span>Qty</span>
                  <span>Price</span>
                  <span>Status</span>
                </div>
                {recentOrders.length === 0 && (
                  <div className="orders-row">
                    <span style={{ gridColumn: "1 / -1", color: "#64748b" }}>No orders in this session.</span>
                  </div>
                )}
                {recentOrders.map((o) => {
                  const sym =
                    assets.find((a) => a.assetId === o.assetId || a.assetId === Number(o.assetId))?.symbol ||
                    `#${o.assetId}`;
                  return (
                    <div key={`${o.tradeId}-${o.executedAt}`} className="orders-row">
                      <span>{o.tradeId}</span>
                      <span>{sym}</span>
                      <span className={o.tradeType === "BUY" ? "tape-side-buy" : "tape-side-sell"}>{o.tradeType}</span>
                      <span>{Number(o.quantity).toFixed(4)}</span>
                      <span>{Number(o.pricePerUnit).toFixed(4)}</span>
                      <span className={o.status === "COMPLETED" ? "tape-status-ok" : "tape-status-fail"}>{o.status}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <aside className="trading-side-rail">
          <section className="panel trading-panel-order">
            <h3>Order ticket</h3>
            <p className="muted" style={{ fontSize: "0.72rem", margin: "0 0 0.75rem" }}>
              Execution: <strong>market</strong> at last streamed price (simulated latency &amp; retries).
            </p>
            <form className="order-form order-form--rail" onSubmit={placeOrder}>
              <label>
                Symbol
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
              <label>
                Side
                <select
                  value={orderForm.side}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, side: e.target.value }))}
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={orderForm.quantity}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                />
              </label>
              <button type="submit">Execute Order</button>
            </form>

            <div className="metrics-grid metrics-grid--rail">
              <div>
                <span>Processed</span>
                <strong>{engineMetrics.processedOrders || 0}</strong>
              </div>
              <div>
                <span>Rejected</span>
                <strong>{engineMetrics.rejectedOrders || 0}</strong>
              </div>
              <div>
                <span>Retries</span>
                <strong>{engineMetrics.retriesUsed || 0}</strong>
              </div>
            </div>
            {message && <p className="status-message">{message}</p>}
          </section>
        </aside>

        <section className="panel trading-panel-portfolio">
          <h3>Portfolio &amp; account</h3>
          <div className="portfolio-meta">
            <span>Cash: ${Number(portfolio.cash ?? 0).toLocaleString()}</span>
            <span>Equity: ${Number(portfolio.equity ?? 0).toLocaleString()}</span>
            <span
              className={
                Number(portfolio.sessionPnl || 0) >= 0 ? "portfolio-pnl-pos" : "portfolio-pnl-neg"
              }
            >
              Session P&amp;L: ${Number(portfolio.sessionPnl || 0).toLocaleString()}
            </span>
            <span>Positions: {portfolio.positionCount || 0}</span>
            <span>Holdings MV: ${Number(portfolio.currentValue || 0).toLocaleString()}</span>
            <span>Gross notional traded: ${Number(portfolio.grossVolume || 0).toLocaleString()}</span>
            <span>Starting cash: ${Number(portfolio.startingCash ?? 100000).toLocaleString()}</span>
          </div>
          <div className="positions-table">
            <div className="positions-row head">
              <span>Symbol</span>
              <span>Asset</span>
              <span>Qty</span>
              <span>Price</span>
              <span>Market Value</span>
            </div>
            {(portfolio.positions || []).map((position) => (
              <div key={position.symbol} className="positions-row">
                <span>{position.symbol}</span>
                <span>{position.assetName}</span>
                <span>{Number(position.quantity).toFixed(4)}</span>
                <span>${Number(position.currentPrice).toFixed(2)}</span>
                <span>${Number(position.marketValue).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel trading-panel-alerts">
          <h3>Risk and Fraud Alerts</h3>
          <div className="alerts-shell">
            {fraudAlerts.length === 0 && <p className="muted">No risk alerts in the current session.</p>}
            {fraudAlerts.map((alert, index) => (
              <div key={`${alert.timestamp}-${index}`} className="alert-item">
                <span className="alert-type">{alert.type}</span>
                <span>{alert.symbol}</span>
                <span>{alert.detail}</span>
                <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default TradingDashboard;
