# TradeFlow — Trading Terminal Simulator

A **Spring Boot** + **React** paper-trading platform built to look and behave like a real trading terminal. Streams live synthetic ticks across **28 symbols** in parallel (mega-cap tech, finance, energy, consumer, crypto, commodities), runs market and limit orders through an in-memory matching engine with retry + anti-abuse controls, and renders a dense Bloomberg-style workspace: watchlist, D3 chart, order book with depth, ticket, positions, working limits, time & sales, and a market-breadth heat strip.

<img width="1749" height="996" alt="image" src="https://github.com/user-attachments/assets/5dcb7859-4d56-4406-95ad-e9dd4d7d8f62" />

## Tech Stack

![Java](https://img.shields.io/badge/Java-17-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.2.0-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white)
![STOMP](https://img.shields.io/badge/STOMP_over_WebSocket-000000?style=for-the-badge&logo=socket.io&logoColor=white)
![H2](https://img.shields.io/badge/H2-in--memory-4479A1?style=for-the-badge&logo=h2&logoColor=white)
![Maven](https://img.shields.io/badge/Maven-C71A36?style=for-the-badge&logo=apache-maven&logoColor=white)
![JMH](https://img.shields.io/badge/JMH-benchmarks-F80000?style=for-the-badge&logo=openjdk&logoColor=white)

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![D3](https://img.shields.io/badge/D3.js-F9A03C?style=for-the-badge&logo=d3.js&logoColor=white)
![k6](https://img.shields.io/badge/k6-load_testing-7D64FF?style=for-the-badge&logo=k6&logoColor=white)

## Highlights

- **Parallel tick engine** — `MarketDataService` fans tick computation across cores with `parallelStream` + `ThreadLocalRandom`, publishing `ticksPerSecond`, `advancers`, `decliners`, and `symbolCount` on every batch.
- **Tuned concurrency** — `AsyncConfig` wires dedicated `ThreadPoolTaskExecutor` beans for tick computation and matching, plus a multi-thread `ThreadPoolTaskScheduler` so `@Scheduled` jobs never serialize behind one another.
- **In-memory matching engine** — market + limit orders, resting working-orders book, retry-on-transient-fault, rate limiter with fraud alerts, synthetic depth ladder, and time & sales tape.
- **Live streaming UI** — STOMP-over-SockJS feed at 2 Hz, price-flash motion feedback on the watchlist, pulsing status dots, and a clickable market-breadth heat strip across all 28 symbols.
- **Dense terminal design** — Tailwind-based neumorphic dark theme, ticker-style top bar (O/H/L/MID/SPRD), four-column workspace (watchlist · chart · DOM · ticket), and a tabbed bottom rail (Positions · Working · Orders · Time & Sales · Alerts).

## Architecture

```
┌──────────── React (Vite + Tailwind + D3) ────────────┐
│  TradingDashboard  ◄── STOMP /topic/market ──┐        │
│   Watchlist · Chart · Order Book · Ticket     │        │
│   Breadth strip · Positions · Tape · Alerts   │        │
└───────────────────────────┬──────────────────┬────────┘
                            │ REST             │ WS
                            ▼                  ▼
┌──────────────── Spring Boot (Java 17) ──────────────┐
│  TradingController  ──►  TradingService             │
│                          · placeOrder (MKT/LMT)     │
│                          · resting book + retries   │
│                          · rate limit / fraud       │
│                          · portfolio / tape / book  │
│                                                     │
│  MarketDataService  ─── @Scheduled(500ms) ──►       │
│    parallelStream price ticks (28 symbols)          │
│    ThreadPoolTaskExecutor (market-tick pool)        │
│                                                     │
│  AsyncConfig: marketTickExecutor + matchingExecutor │
│              + ThreadPoolTaskScheduler              │
└─────────────────────────────────────────────────────┘
```

## Run locally

1. **Backend** (Java 17): from `backend/`, run `mvn spring-boot:run`. API at `http://localhost:8080`.
2. **Frontend** (Node 18+): from `frontend/`, run `npm install` then `npm run dev`. Open the URL shown (e.g. `http://localhost:5173`).

No database setup or login required — cash, positions, and trades live in-memory for the session.

## Key endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/trading/assets` | 28-symbol universe with live prices |
| GET | `/api/trading/assets/{symbol}/history` | Rolling price history for chart |
| GET | `/api/trading/order-book/{symbol}` | Synthetic 8-level depth |
| POST | `/api/trading/orders` | Place market or limit order |
| GET | `/api/trading/working-orders` | Resting limit book |
| GET | `/api/trading/portfolio` | Cash, equity, positions, session P&L |
| GET | `/api/trading/tape` | Time & sales |
| GET | `/api/trading/metrics` | Engine counters + tick stats (TPS, total ticks) |
| GET | `/api/trading/fraud-alerts` | Rate-limit / risk alerts |
| WS  | `/ws-market` → `/topic/market` | Live tick stream |

## Load testing (k6)

Install [k6](https://k6.io/docs/get-started/installation/), start the backend, then:

```bash
k6 run scripts/k6/trading-smoke.js --env BASE_URL=http://localhost:8080
k6 run scripts/k6/trading-load.js  --env BASE_URL=http://localhost:8080
```

See `scripts/k6/README.md` for details. Random sells may return HTTP 400 when there is no inventory — expected under load.

## Benchmarks (JMH)

Matching-engine microbenchmarks live under `backend/src/jmh/` and can be executed with the Maven JMH profile.

