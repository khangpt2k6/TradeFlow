import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import * as d3 from "d3";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { API_BASE_URL } from "../config/api";

const TradingDashboard = () => {
  const [assets, setAssets] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [series, setSeries] = useState([]);
  const [portfolio, setPortfolio] = useState({
    positionCount: 0,
    grossVolume: 0,
    currentValue: 0,
    positions: [],
  });
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
  }, []);

  useEffect(() => {
    if (!selectedSymbol) return;
    fetchHistory(selectedSymbol);
    fetchOrderBook(selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_BASE_URL.replace("/api", "")}/ws-market`),
      reconnectDelay: 1000,
      onConnect: () => {
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
        setMessage("Live stream had an issue. Retrying...");
      },
    });

    client.activate();
    return () => client.deactivate();
  }, [selectedSymbol]);

  useEffect(() => {
    renderD3Chart(series);
  }, [series]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchMetrics();
      fetchFraudAlerts();
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
    } catch (error) {
      setMessage(error?.response?.data?.message || "Order failed");
    }
  };

  const renderD3Chart = (data) => {
    const container = chartRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = 280;
    const margin = { top: 16, right: 18, bottom: 24, left: 44 };

    d3.select(container).selectAll("*").remove();
    if (!data || data.length === 0) return;

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

    const line = d3
      .line()
      .x((d) => x(new Date(d.timestamp)))
      .y((d) => y(d.price))
      .curve(d3.curveMonotoneX);

    svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#2cc2ff")
      .attr("stroke-width", 2.4)
      .attr("d", line);

    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%H:%M:%S")))
      .attr("color", "#89a8c4");

    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .attr("color", "#89a8c4");
  };

  return (
    <div className="trading-page">
      <div className="trading-header">
        <h1>TradeFlow Live Platform</h1>
        <p>Concurrent matching simulation + streaming market feed</p>
      </div>

      <div className="trading-grid">
        <section className="panel">
          <h3>Market Feed</h3>
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
                <span>{asset.symbol}</span>
                <strong>{Number(asset.price).toFixed(2)}</strong>
                <em className={Number(asset.changePercent) >= 0 ? "up" : "down"}>
                  {Number(asset.changePercent).toFixed(2)}%
                </em>
              </button>
            ))}
          </div>
          <div ref={chartRef} className="chart-shell" />
        </section>

        <section className="panel">
          <h3>Order Entry</h3>
          <form className="order-form" onSubmit={placeOrder}>
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

          <div className="metrics-grid">
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

        <section className="panel">
          <h3>Order Book ({orderBook.symbol || selectedSymbol})</h3>
          <div className="orderbook-grid">
            <div>
              <h4>Bids</h4>
              {(orderBook.bids || []).map((row) => (
                <div key={`bid-${row.price}`} className="book-row bid">
                  <span>{Number(row.price).toFixed(2)}</span>
                  <span>{Number(row.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div>
              <h4>Asks</h4>
              {(orderBook.asks || []).map((row) => (
                <div key={`ask-${row.price}`} className="book-row ask">
                  <span>{Number(row.price).toFixed(2)}</span>
                  <span>{Number(row.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel full">
          <h3>Portfolio Snapshot</h3>
          <div className="portfolio-meta">
            <span>Positions: {portfolio.positionCount || 0}</span>
            <span>Gross Volume: ${Number(portfolio.grossVolume || 0).toLocaleString()}</span>
            <span>Current Value: ${Number(portfolio.currentValue || 0).toLocaleString()}</span>
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

        <section className="panel full">
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
