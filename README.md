# EV Intelligence Platform

**End-to-end EV fleet operations: from lithium mine to delivery van, with live AI risk scoring, predictive maintenance, manufacturing quality, and carbon intelligence — all in INR, all connected through one shared data graph.**

![License: MIT](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.10%2B-3776AB)
![TypeScript](https://img.shields.io/badge/typescript-5.x-3178C6)
![React](https://img.shields.io/badge/react-19-61DAFB)
![FastAPI](https://img.shields.io/badge/fastapi-0.139-009688)
![Tailwind CSS](https://img.shields.io/badge/tailwind-3.4-06B6D4)

---

## What is this?

A connected platform for EV fleet operators and supply chain managers. One dashboard surfaces battery health, commodity prices, supply chain risk, manufacturing quality, and carbon emissions — all from a single shared data graph.

A battery in a truck in Pune traces back to a lithium mine in Chile, with a real rupee cost, real carbon number, and real time-to-NetZero projection.

### 3 built-in themes

| Industrial Net-Zero | Supply Chain Traceability | Dark Mode |
|---|---|---|
| Forest green + slate | Steel blue + engineering blue | Soft charcoal + sky blue |
| `#F4F6F8 / #14532D / #0D9488` | `#F8FAFC / #1E293B / #2563EB` | `#111827 / #38BDF8 / #34D399` |

Toggle themes from the palette icon in the header. No gradients, no glassmorphism, no neon — professional B2B industrial design throughout.

---

## Features

### Core Modules

| Module | What it does |
|--------|-------------|
| **Fleet Readiness** | Weighted ICE-to-EV conversion scoring (range, charging, payload, infra) with INR CapEx |
| **APM AI Agent** | Groq LLM (`tool_choice="required"`) routing through 6 deterministic tools — zero hallucination |
| **Maintenance Optimizer** | Constraint-based greedy scheduler (4 bays, 8 techs, 16h shift, parts-aware) |
| **Supply Chain** | 9 suppliers across 3 tiers, Leaflet map with live news-driven risk scoring, OSM geocoding |
| **Quality (QMS)** | EWMA/CUSUM drift detection, Cpk, defect predictions, supplier quality matrix |
| **Net Zero** | Scope 1/2/3 tracking, monthly projections, LLM recommendations, what-if simulator |

### Intelligence & Analytics

- **Commodity Feed** — Live BSE/MCX battery material prices in INR
- **SHAP Explainability** — Why Cpk dropped (per-parameter contribution + waterfall chart)
- **Forecasts** — 7-day thermal, 365-day SoH curve, replacement cost prediction
- **Carbon Simulator** — What-if sliders for EV penetration, renewables, Scope 3 reduction
- **Business Analytics** — Cohort analysis, TCO trends, vendor scorecards (A/B/C/D), carbon credit marketplace
- **Battery Passport** — Material traceability from mine to pack

### Real-Time

- **WebSocket live alerts** — 6 APScheduler background jobs push anomalies via WebSocket
- **Toast notifications + history drawer** — bell icon with unread badge, auto-dismiss after 8s
- **Mobile-friendly** — Auto-adapts for shop-floor tablets and phones

### Operations

- **4 roles** — Procurement, Maintenance, Executive, Admin
- **Audit log** — Every LLM query, approval, and threshold check with A4-styled PDF export
- **Approval workflow** — Cost threshold (₹5L) with auto-approve below, submit-for-approval above
- **5 Indian depots** — Pune, Mumbai, Bangalore, Delhi, Chennai

---

## Tech Stack

| Layer | Tech |
|-------|------|
| **Backend** | Python 3.10, FastAPI, Pydantic v2, APScheduler, SQLite |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 3, Recharts, Leaflet, Lucide icons |
| **AI/ML** | Groq (llama-3.3-70b), scikit-learn Random Forest, SHAP explainer |
| **External** | 12 RSS feeds, OpenStreetMap Nominatim, BSE/MCX commodities |

Zero broker, zero Redis. Single-process FastAPI with in-process background scheduler. Runs on Render free tier.

---

## Quick Start

```bash
# One-command bootstrap
./setup.sh        # macOS / Linux
setup.bat         # Windows

# Or manually:

# Backend
cd backend
python3.10 -m venv .venv310
.venv310/bin/pip install -r requirements.txt    # or .venv310\Scripts\pip on Windows
.venv310/bin/uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Login with `admin@demo.com` / `password123` (or any demo account from the login screen).

OpenAPI docs: `http://localhost:8000/docs`

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | yes (for AI agent) | Groq API key — free at [console.groq.com](https://console.groq.com/keys) |
| `OPENAI_BASE_URL` | no | Defaults to Groq. Set for custom OpenAI-compatible endpoints |
| `PORT` | no | Backend port (default 8000) |
| `VITE_API_URL` | no | Frontend-to-backend URL (default `http://localhost:8000`) |

---

## Documentation

| Doc | Content |
|-----|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System overview, data flow, LLM routing, alert pipeline (Mermaid diagrams) |
| [FEATURES.md](./FEATURES.md) | Per-feature deep dive — algorithms, formulas, UI surfaces, edge cases |
| [API.md](./API.md) | All 28 REST + 1 WebSocket endpoint reference with request/response examples |
| [DEV.md](./DEV.md) | Local dev setup, file tour, conventions, common pitfalls |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Render.com and self-hosted VPS instructions |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute |

---

## Contributing

Pull requests welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for style guide and conventions.

## License

MIT — see [LICENSE](./LICENSE).
