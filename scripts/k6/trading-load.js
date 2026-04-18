/**
 * Sustained load on trading endpoints (mixed GET + POST orders).
 *
 *   k6 run scripts/k6/trading-load.js --env BASE_URL=http://localhost:8080
 *
 * Tune VUs/duration for your machine. Sells may return 400 without inventory — that is expected.
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "20s", target: 8 },
    { duration: "45s", target: 15 },
    { duration: "20s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.25"],
    http_req_duration: ["p(95)<3000"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:8080";
const SYMBOLS = ["AAPL", "MSFT", "NVDA", "TSLA", "BTCUSD"];

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

export default function () {
  const headers = { "Content-Type": "application/json" };
  const sym = randomSymbol();

  const getRes = http.get(`${BASE}/api/trading/assets`);
  check(getRes, { "assets 200": (r) => r.status === 200 });

  http.get(`${BASE}/api/trading/portfolio`);
  http.get(`${BASE}/api/trading/metrics`);
  http.get(`${BASE}/api/trading/tape`);
  http.get(`${BASE}/api/trading/working-orders`);
  http.get(`${BASE}/api/trading/order-book/${sym}`);

  const side = Math.random() < 0.65 ? "BUY" : "SELL";
  const useLimit = Math.random() < 0.15;
  const qty = 0.01 + Math.random() * 0.08;
  const payload = {
    symbol: sym,
    side,
    quantity: Math.round(qty * 1e6) / 1e6,
    orderType: useLimit ? "LIMIT" : "MARKET",
  };
  if (useLimit) {
    const assets = getRes.json();
    const row = Array.isArray(assets) ? assets.find((a) => a.symbol === sym) : null;
    const px = row ? Number(row.price) : 100;
    const skew = side === "BUY" ? 0.97 : 1.03;
    payload.limitPrice = Math.round(px * skew * 1e4) / 1e4;
  }

  const post = http.post(`${BASE}/api/trading/orders`, JSON.stringify(payload), { headers });
  check(post, {
    "order accepted or business error": (r) => r.status === 200 || r.status === 400,
  });

  sleep(0.15 + Math.random() * 0.25);
}
