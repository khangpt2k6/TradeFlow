# TradeFlow - Comprehensive Trading Platform

A modern, full-stack trading platform built with **Spring Boot** backend and **React** frontend. TradeFlow provides a secure, scalable solution for portfolio management, market insights, and trade execution workflows.

<img width="1673" height="815" alt="image" src="https://github.com/user-attachments/assets/0ca1f194-64ec-44eb-bc36-05ab0e528287" />


## Tech Stack

![Java](https://img.shields.io/badge/Java-17-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.2.0-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![H2 Database](https://img.shields.io/badge/H2_Database-1.4.200-4479A1?style=for-the-badge&logo=h2&logoColor=white)
![Maven](https://img.shields.io/badge/Maven-C71A36?style=for-the-badge&logo=apache-maven&logoColor=white)

![React](https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.2.3-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)

## Supabase Auth + Data Setup

1. Copy `frontend/.env.example` to `frontend/.env` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_URL` (optional override for backend URL)
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. In Supabase dashboard, enable OAuth providers:
   - **Google**
   - **GitHub**
4. Add redirect URLs in Supabase Auth settings:
   - `http://localhost:5173`
   - your deployed frontend URL

TradeFlow now uses Supabase authentication (email/password + Google + GitHub) and stores user profile + executed trade records in Supabase.

