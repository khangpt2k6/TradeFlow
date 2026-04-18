# TradeFlow - Comprehensive Trading Platform

A **Spring Boot** + **React** project centered on a **paper trading simulator**: streamed prices, market and limit orders, synthetic depth, in-memory session (cash, positions, tape, working limits). It is a lab-style demo, not a production brokerage stack.

<img width="1673" height="815" alt="image" src="https://github.com/user-attachments/assets/0ca1f194-64ec-44eb-bc36-05ab0e528287" />


## Tech Stack

![Java](https://img.shields.io/badge/Java-17-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.2.0-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![H2 Database](https://img.shields.io/badge/H2_Database-1.4.200-4479A1?style=for-the-badge&logo=h2&logoColor=white)
![Maven](https://img.shields.io/badge/Maven-C71A36?style=for-the-badge&logo=apache-maven&logoColor=white)

![React](https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.2.3-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)

## Run locally

1. **Backend:** from `backend/`, run `mvn spring-boot:run` (Java 17). API defaults to `http://localhost:8080`.
2. **Frontend:** from `frontend/`, run `npm install` then `npm run dev` (Vite). Open the URL shown (e.g. `http://localhost:5173`) and use the Trading dashboard.

## Load testing (k6)

Install [k6](https://k6.io/docs/get-started/installation/), start the backend, then:

```bash
k6 run scripts/k6/trading-smoke.js --env BASE_URL=http://localhost:8080
k6 run scripts/k6/trading-load.js --env BASE_URL=http://localhost:8080
```

See `scripts/k6/README.md` for details. Random sells may return HTTP 400 when there is no inventory; that is expected under load.

