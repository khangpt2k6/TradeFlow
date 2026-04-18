# k6 load tests (TradeFlow)

Prerequisites: [k6](https://k6.io/docs/get-started/installation/) installed and the Spring Boot API running (default `http://localhost:8080`).

## Smoke (short)

```bash
k6 run scripts/k6/trading-smoke.js --env BASE_URL=http://localhost:8080
```

## Heavier mix (GET + POST orders)

```bash
k6 run scripts/k6/trading-load.js --env BASE_URL=http://localhost:8080
```

POST responses may include HTTP 400 when the simulator rejects an order (e.g. insufficient shares to sell, insufficient cash, rate limit). That is expected under random traffic.

## Interpreting results

- **`http_req_failed`**: counts non-retryable failures and status codes that fail checks. Tune thresholds if your machine is slow to start the JVM.
- **Latency (`http_req_duration`)**: dominated by Spring + DB; WebSocket market traffic is not exercised by these scripts.
