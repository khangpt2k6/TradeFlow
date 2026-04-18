/**
 * Short sanity check: health-style traffic against the trading API.
 * Install k6: https://k6.io/docs/get-started/installation/
 *
 *   k6 run scripts/k6/trading-smoke.js --env BASE_URL=http://localhost:8080
 */
import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 2,
  duration: "15s",
  thresholds: {
    http_req_failed: ["rate<0.15"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:8080";

export default function () {
  const headers = { "Content-Type": "application/json" };
  const paths = [
    "/api/trading/assets",
    "/api/trading/portfolio",
    "/api/trading/metrics",
    "/api/trading/tape",
    "/api/trading/working-orders",
    "/api/trading/orders",
    "/api/trading/fraud-alerts",
    "/api/trading/order-book/AAPL",
  ];
  const path = paths[Math.floor(Math.random() * paths.length)];
  const res = http.get(`${BASE}${path}`);
  check(res, { "2xx": (r) => r.status >= 200 && r.status < 300 });

  if (__VU === 1 && Math.random() < 0.2) {
    const body = JSON.stringify({
      symbol: "AAPL",
      side: "BUY",
      quantity: 0.01,
      orderType: "MARKET",
    });
    const post = http.post(`${BASE}/api/trading/orders`, body, { headers });
    check(post, { "order 200 or 400": (r) => r.status === 200 || r.status === 400 });
  }
}
