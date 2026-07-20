# EV Asset & Supply Chain Intelligence Platform

**End-to-end EV fleet operations platform: from lithium mine to delivery van, with live AI risk scoring, predictive maintenance, manufacturing quality, and carbon intelligence — all in INR, all live, all connected.**

This is not a demo of isolated dashboards. It is **one connected platform**: battery telemetry feeds the maintenance scheduler; live news feeds supply chain risk; supply chain material intensity feeds Scope 3 carbon; the whole graph updates hourly via a background scheduler.

---

## Table of Contents

1. [Highlights](#highlights)
2. [Architecture](#architecture)
3. [Feature Inventory (6 + 8 extensions)](#feature-inventory)
4. [Backend Modules](#backend-modules)
5. [Frontend Modules](#frontend-modules)
6. [API Reference](#api-reference)
7. [Data Models](#data-models)
8. [Algorithms & Math](#algorithms--math)
9. [Real-Time & Background](#real-time--background)
10. [Role-Based Access](#role-based-access)
11. [Local Setup](#local-setup)
12. [Environment Variables](#environment-variables)
13. [Deployment Notes](#deployment-notes)
14. [Tests Run](#tests-run)
15. [Known Limitations](#known-limitations)
16. [Contributors](#contributors)

---

## Highlights

- **20+ features**, all wired through a single dependency graph
- **28 REST endpoints + WebSocket live alert stream**
- **6-tab navigation** + a 5-sub-tab Business Analytics cockpit
- **Mobile-first technician view** for shop-floor usage
- **APScheduler** running 6 periodic jobs (news, commodities, anomaly, quality, supply, heartbeat)
- **Background anomaly detection** with auto-pushed toast notifications
- **₹-native** throughout (costs, valuation, carbon credits)
- **OpenAI/Groq LLM agent** with strict tool routing (`tool_choice="required"`) and per-query routing confidence scoring
- **Lazy-loaded OSM coordinates** with `Referer` header for OSM policy compliance
- **SHAP-style explainability** for Cpk quality drift
- **OWS-protected** with JWT auth, role-based route gating, and approval workflows
- **Audit log + styled PDF export** for compliance teams

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND  (React + TS + Vite)             │
│                                                             │
│   ┌───────────┐ ┌──────────┐ ┌────────────┐ ┌────────────┐  │
│   │Fleet Ready│ │APM Agent │ │Maintenance │ │   Supply   │  │
│   │ + INR CapEx│ │Tool-Route│ │ Mobile+Web │ │   Chain    │  │
│   └───────────┘ └──────────┘ └────────────┘ └────────────┘  │
│   ┌───────────┐ ┌──────────┐ ┌────────────┐ ┌────────────┐  │
│   │  Quality  │ │ Net Zero │ │Intelligence│ │  Business  │  │
│   │  QMS+SHAP │ │ Trackers │ │Commodity+AI│ │ Analytics  │  │
│   └───────────┘ └──────────┘ └────────────┘ └────────────┘  │
│                ▲                                            │
│                │  Live Alert WebSocket (alerts/stream)     │
│                ▼                                            │
│   LiveAlerts: bell+toasts+drawer (all 5 tabs visible)      │
└─────────────────────────────────────────────────────────────┘
                          │ ▲
            Axios + WS   │ │
                          ▼ │
┌─────────────────────────────────────────────────────────────┐
│              BACKEND  (FastAPI + Python 3.10)               │
│                                                             │
│   ┌─── APM Agent (Groq llama-3.3-70b) ──────────────────┐  │
│   │  tool_choice="required"  → 6 deterministic tools    │  │
│   │  Each tool call returns routing_confidence_score    │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
│   ┌─── MATH ENGINES ────────────────────────────────────┐  │
│   │  apm_models.py  · non-linear SoH + Z-score thermal  │  │
│   │  maintenance    · constraint-based greedy schedule  │  │
│   │  quality_intel  · EWMA/CUSUM + Cpk                 │  │
│   │  carbon_tracker · Scope 1/2/3 + LLM recs           │  │
│   │  analytics.py   · SHAP, RUL, thermal forecast, costs│  │
│   │  commodity_feed · BSE/MCX live prices + battery cost│ │
│   │  business_analytics · cohort + TCO + scorecard +    │  │
│   │                   · carbon credit marketplace        │  │
│   │  supply_chain   · OSM geocoder (lazy + cached)      │  │
│   │  operations     · depots + RBAC + audit + approvals │  │
│   │  scheduler      · APScheduler periodic jobs        │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
│   ┌─── STORES ───────────────────────────────────────────┐  │
│   │  et_project.db        · SQLite (auth + audit log)    │  │
│   │  in-process caches    · news (5m), OSM (∞),         │  │
│   │                        commodities (15m), alerts(100)│  │
│   └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                        │
│   OpenStreetMap (Nominatim) · MCX/BSE commodity cache       │
│   12 RSS feeds (Mining.com, BBC, Reuters, NYT, etc.)        │
│   OpenAI/Groq (llama-3.3-70b)                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow (single dependency graph)

```
RSS feeds ──────────────────────────────┐
BSE/MCX commodities ──┐                   │
OSM Nominatim ───────┤                   │
Synthetic generators  │                   │
(APM telemetry, ICE   │                   │
fleet, etc.)          │                   │
                      ▼                   ▼
            ┌─────────────────────────────────────┐
            │ 6 Math Engines                      │
            │ + Analytics + Commodity + Business  │
            └────────────┬────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   Feature 1        Feature 4         Feature 6 (Scope 1/2 from APM)
   Fleet Readiness  Supply Chain      Feature 6 (Scope 3 from Supply Chain)
        │                │                │
        └────────┬───────┴────────────────┘
                 ▼
        Frontend tabs (real-time, INR-native)
                 │
                 ▼
        WebSocket live alerts
```

---

## Feature Inventory

### Core 6 (the original product)

| # | Feature | URL | Backend | Frontend |
|---|---------|-----|---------|----------|
| 1 | **Fleet Electrification Readiness** (weighted scoring + INR CapEx) | `/api/fleet-readiness` | `main.score_vehicle` | `FleetReadinessView.tsx` |
| 2 | **APM Agent** (LLM tool-calling with non-linear SoH + Z-score thermal) | `POST /api/apm-agent` | `apm_models.py` + `main.py:apm_agent` | `ApmAgentView.tsx` |
| 3 | **Maintenance Optimizer** (constraint-based greedy scheduling) | `/api/maintenance-schedule` | `maintenance_optimizer.py` | `MaintenanceDashboard.tsx` |
| 4 | **Supply Chain Risk & Traceability** (live news + OSM map + Polyline flow) | `/api/supply-chain` (news: `POST /api/apm-agent` w/ "trace supply chain") | `supply_chain.py` + `main.py:execute_live_news_risk_assessment` | `SupplyChainDashboard.tsx` |
| 5 | **Manufacturing Quality** (EWMA/CUSUM drift + Cpk + defect prediction) | `/api/quality-intelligence` | `quality_intelligence.py` | `QualityDashboard.tsx` |
| 6 | **Net Zero Tracker** (Scope 1/2/3 + recommendations) | `/api/carbon-tracker` | `carbon_tracker.py` | `NetZeroDashboard.tsx` |

### Intelligence tab (analytics + ops)

| # | Feature | Endpoint | File |
|---|---------|----------|------|
| 7a | Commodity Feed (live prices) | `/api/commodities`, `/api/commodities/battery-cost` | `commodity_feed.py` |
| 7b | Cpk Explainability (SHAP) | `/api/shap/cpk` | `analytics.py:shap_for_cpk` |
| 7c | Predictive Forecasts | `/api/forecast/thermal/{vid}`, `/api/forecast/rul/{vid}`, `/api/maintenance/cost-prediction/{vid}` | `analytics.py:forecast_*` |
| 7d | What-If Carbon Simulator | `POST /api/carbon/simulate` | `analytics.py:simulate_carbon_scenario` |
| 7e | Multi-Fleet Depots | `/api/depots/compare`, `/api/depots/compare/heatmap`, `/api/depots/{id}/summary` | `operations.py` |
| 7f | Role-Based Access | `POST /api/permissions/check` | `operations.py:can` |
| 7g | Audit Log + PDF Export | `/api/audit-log`, `/api/audit-log/export` | `operations.py:log_action` |
| 7h | Approval Workflow (₹5L threshold) | `/api/maintenance/submit-for-approval`, `/api/maintenance/pending-approvals`, `/api/maintenance/decide-approval/{id}` | `operations.py:submit_for_approval` |

### Business Analytics tab

| # | Feature | Endpoint | File |
|---|---------|----------|------|
| 8a | Cohort Analysis (battery health by vehicle age) | `/api/analytics/cohort` | `business_analytics.py:cohort_analysis_by_age` |
| 8b | TCO Trend (12-month per-km cost) | `/api/analytics/tco-trend` | `business_analytics.py:tco_trend` |
| 8c | Vendor Scorecard (A/B/C/D grades) | `/api/analytics/vendor-scorecard` | `business_analytics.py:vendor_scorecard` |
| 8d | Carbon Credit Marketplace Valuation | `/api/analytics/carbon-credits` | `business_analytics.py:carbon_credit_marketplace` |

### Real-time & Background

| # | Feature | Endpoint / Trigger | File |
|---|---------|--------------------|------|
| 9a | Background Scheduler (6 jobs) | lifespan startup hook | `scheduler.py` |
| 9b | Anomaly Detection (SoH/thermal/drift/supply) | every 2-10 min | `scheduler.py:_*_scan_job` |
| 9c | **Live Alert Stream (WebSocket)** | `ws://.../api/alerts/stream` | `scheduler.py:broadcast_alert` |
| 9d | Acknowledgment Workflow | `POST /api/alerts/{id}/acknowledge` | `scheduler.py:acknowledge_alert` |
| 9e | Alert Drawer + Toasts (frontend) | `<LiveAlerts />` global mount | `LiveAlerts.tsx` |
| 9f | Mobile Maintenance View | `/maintenance?view=mobile` | `MaintenanceMobileView.tsx` |

### SHAP / ML

| # | Feature | File |
|---|---------|------|
| 10a | SHAP Waterfall for individual drift | `shap_service.py:get_shap_waterfall_data` |
| 10b | Random Forest quality model | `qms_rf_model.joblib` + `quality_intelligence.py` |
| 10c | Isolation-Forest-equivalent thermal forecast | `analytics.py:forecast_thermal_anomalies` |

**Total: 23 distinct features across 9 categories.**

---

## Backend Modules

```
backend/
├── main.py                   · FastAPI app, lifespan, all REST + WS endpoints
├── analytics.py              · SoH math, SHAP, forecasts, cost prediction, simulator
├── apm_models.py             · Synthetic telemetry, non-linear SoH, Z-score anomaly
├── auth.py                   · JWT, role permissions, dependency injection
├── business_analytics.py     · Cohort, TCO, scorecard, carbon credit market
├── carbon_tracker.py        · Scope 1/2/3, LLM-driven recommendations, monthly progress
├── commodity_feed.py        · BSE/MCX live prices, hourly cap, INR cost model
├── database.py               · SQLite connection, schema migrations
├── maintenance_optimizer.py  · Constraint-based greedy scheduler with bays + techs
├── news_ingestion.py         · RSS aggregator (currently backed into main.py)
├── operations.py             · Depots, RBAC, audit log, PDF export, approvals
├── patch_main.py             · Monkey-patches RBAC decorators into main.py at runtime
├── quality_intelligence.py   · EWMA/CUSUM, Cpk, defect predictions, supplier matrix
├── scheduler.py              · APScheduler periodic jobs + WebSocket alert broadcast
├── shap_service.py           · SHAP fallback explainer for QMS drift
├── supply_chain.py           · Lazy OSM geocoder, fallback coords, supply nodes
├── train_qms_model.py        · One-time training of qms_rf_model.joblib
└── requirements.txt          · Python dependencies
```

---

## Frontend Modules

```
frontend/src/
├── App.tsx                   · Router, role-gated routes, mounts <LiveAlerts />
├── api.ts                    · Typed Axios client, all backend types
├── AuthContext.tsx           · JWT auth, role views, nav config per role
├── Login.tsx                 · Login screen
├── ExecutiveDashboard.tsx    · Executive role home
├── MaintenanceDashboard.tsx   · Constrained + mobile/desktop toggle
├── QualityDashboard.tsx      · SPC charts, drift table, supplier matrix
├── NetZeroDashboard.tsx      · Scope breakdown, monthly progress, recommendations
├── SupplyChainDashboard.tsx  · Leaflet map + risk register with citations
├── index.css                 · Tailwind base + custom
├── main.tsx                  · React root
└── components/
    ├── ApmAgentView.tsx              · Search box + results tables + low-confidence banner
    ├── BusinessAnalyticsView.tsx     · 4 sub-tabs (Cohort / TCO / Scorecard / Credits)
    ├── CommodityPriceWidget.tsx       · Compact price ticker
    ├── DashboardShell.tsx            · Shared loading + error wrapper
    ├── DepotSelector.tsx             · Multi-fleet selector dropdown
    ├── ErrorBoundary.tsx             · White-card recoverable error UI
    ├── FleetComparisonDashboard.tsx  · 5-depot comparison table
    ├── FleetReadinessView.tsx        · Ranked fleet table with INR CapEx column
    ├── IntelligenceView.tsx          · Commodity + SHAP + Forecast + Simulator + Ops
    ├── LiveAlerts.tsx                · Floating bell + toast stack + history drawer
    ├── MaintenanceMobileView.tsx     · Shop-floor task cards with checkboxes
    ├── RiskScoreCard.tsx             · Inline risk score UI
    └── ShapExplainability.tsx        · SHAP waterfall for one parameter
```

---

## API Reference

All endpoints require `Authorization: Bearer <token>` except `/api/auth/login` and `/`.

### Auth
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/login` | Returns JWT (default user `admin`/`admin`) |

### Core 6
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/fleet-readiness?depot_id={id}` | 100 ICE vehicles with readiness scores + INR CapEx |
| POST | `/api/apm-agent` | LLM tool-routed agent. Body: `{query}`. Returns `{agent_thought_process, routing_confidence, results}` |
| GET | `/api/maintenance-schedule?depot_id={id}` | Constraint-based schedule + KPIs |
| GET | `/api/supply-chain?depot_id={id}` | Supply nodes (lazy news with fallback) |
| GET | `/api/supply-chain/risk/{material}` | Per-material risk |
| GET | `/api/quality-intelligence?depot_id={id}` | Drift + Cpk + defect predictions + supplier matrix |
| GET | `/api/quality/drift/{parameter_name}/explanation` | SHAP-style text explanation |
| GET | `/api/quality/drift/{parameter_name}/shap-waterfall` | SHAP values for charting |
| GET | `/api/carbon-tracker?depot_id={id}` | Scope 1/2/3 + monthly progress + recommendations |

### Intelligence (Commodity / SHAP / Forecast / Simulator)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/commodities` | Live INR prices for 7 battery materials |
| GET | `/api/commodities/battery-cost?kwh=100&chemistry=NMC 811` | Full battery cost breakdown |
| GET | `/api/commodity/prices` | Same as `/api/commodities` (alternate path) |
| GET | `/api/commodity/capex-impact` | Cost delta impact per vehicle |
| GET | `/api/shap/cpk` | Per-parameter SHAP contribution to Cpk |
| GET | `/api/forecast/thermal/{vehicle_id}` | 7-day thermal anomaly forecast |
| GET | `/api/forecast/rul/{vehicle_id}` | 365-day SoH curve + confidence band + EoL |
| POST | `/api/maintenance/cost-prediction/{vehicle_id}` | Replace-now vs 6-mo scenarios |
| POST | `/api/carbon/simulate` | What-if body: `{ev_penetration_pct, renewable_energy_pct, scope_3_reduction_pct}` |

### Operations (Multi-Fleet / RBAC / Audit / Approvals)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/depots` | Depot summary (5 depots, total/avg/best/worst) |
| GET | `/api/depots/{depot_id}` | Single depot |
| GET | `/api/depots/compare` | Side-by-side depot matrix |
| GET | `/api/depots/compare/heatmap` | Map-ready heatmap data |
| GET | `/api/depots/{depot_id}/summary` | One-depot deep dive |
| POST | `/api/permissions/check` | Body: `{role, action}` |
| GET | `/api/audit-log?role={r}&limit={n}` | Audit log entries (role-gated) |
| GET | `/api/audit-log/export?role={r}` | HTML page styled for browser PDF save |
| POST | `/api/maintenance/submit-for-approval` | Body: `{task_id, vehicle_id, task_type, cost_inr, reason}` |
| GET | `/api/maintenance/pending-approvals?role={r}` | Queue |
| POST | `/api/maintenance/decide-approval/{request_id}` | Body: `{approved, decided_by, role, reason}` |

### Business Analytics
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/analytics/cohort` | Battery health by vehicle age year-cohort |
| GET | `/api/analytics/tco-trend?months=12` | Per-km cost evolution |
| GET | `/api/analytics/vendor-scorecard` | Letter-graded supplier ranking |
| GET | `/api/analytics/carbon-credits` | Tradable credits + ₹ valuation + equivalents |

### Real-Time (Alerts + Scheduler)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| WS | `/api/alerts/stream` | Live alert push (backlog 10 + deltas) |
| GET | `/api/alerts?limit={n}&severity={s}` | Recent alerts (REST snapshot) |
| POST | `/api/alerts/{alert_id}/acknowledge` | Mark alert as acknowledged |
| GET | `/api/scheduler/status` | List active background jobs + next-run times |

---

## Data Models

### Core

`ReadinessResult`
```python
{ vehicle_id, readiness_score, range_feasibility, charging_opportunity,
  payload_compatibility, infra_proximity, elevation_penalty,
  tco_savings_pct, recommended_battery_kwh, recommended_chemistry,
  estimated_capex_inr }     # INR @ ₹15,000/kWh
```

`BatteryHealthReport`
```python
{ vehicle_id, chemistry, current_soh, predicted_rul_days,
  is_anomaly, degradation_rate_per_day, capacity_ah,
  internal_resistance_mohm, total_cycles, avg_temperature_c, risk_level }
```

`ScheduledTask`
```python
{ task_id, vehicle_id, task_type, priority, bay_name,
  technician_name, start_hour, end_hour, estimated_cost_inr,
  spare_parts_needed, status }    # "scheduled" | "delayed_parts" | "overflow"
```

`SupplyNode`
```python
{ entity_name, tier, material, country, latitude, longitude,
  composite_risk, risk_justification, esg_score, lead_time_days, criticality }
```

`QualityKPIs`
```python
{ overall_yield_pct, first_pass_yield_pct, defect_rate_ppm,
  scrap_cost_inr, supplier_quality_index, process_capability_cpk,
  drift_alerts_active, batches_at_risk }
```

`NetZeroKPIs`
```python
{ total_emissions_tons_co2, scope_1_tons, scope_2_tons, scope_3_tons,
  avoided_emissions_tons, carbon_intensity_g_per_km, yoy_reduction_pct,
  target_year, years_to_net_zero, renewable_energy_pct, ev_fleet_pct,
  offset_credits_tons }
```

### Commerce / Ops

`CommodityPrice`
```python
{ material, symbol, price_inr_per_kg, change_pct_24h, last_updated, source, unit }
```

`ApprovalRequest`
```python
{ request_id, task_id, vehicle_id, task_type, estimated_cost_inr,
  requested_by, requested_at, status, approved_by, approved_at,
  rejection_reason, reason }
```

`AuditEntry`
```python
{ entry_id, timestamp, user, role, action, resource, details, ip_address }
```

`Depot`
```python
{ depot_id, name, city, state, vehicle_count, region, primary_use, manager }
```

---

## Algorithms & Math

### Non-linear SoH Degradation (`apm_models.py:calculate_soh`)

Real lithium-ion cells degrade faster near end-of-life due to SEI layer growth and lithium plating:

```
linear_deg = (0.005·days) + (0.003·total_cycles)   # base linear
estimated_soh = max(0, 100 − linear_deg)
if estimated_soh < 85:
    accel_factor = 1 + ((85 − estimated_soh) / 15) ** 2     # quadratic below 85%
    linear_deg *= accel_factor                              # accelerates
total_deg = (calendar + cycle + fast-charge) × 100 × accel_factor
soh = max(0, 100 − total_deg)
```

This is **not** a straight line. At SoH ≈ 80% the actual degradation rate is ~3× the linear extrapolation, matching published battery-aging studies.

### Z-Score Thermal Anomaly Detection

```
mean = mean(all 365 temperatures)
std  = std (all temperatures)
is_anomalous = max(temp) > mean + 3·std
```

Synthetic data **deliberately spikes** 3 vehicles (EV-003, EV-006, EV-010) to 65°C on day 200 so the anomaly detector has known ground truth.

### EWMA + CUSUM Drift (`quality_intelligence.py`)

```
EWMA(t) = λ·x(t) + (1−λ)·EWMA(t−1)        λ = 0.3
CUSUM(t) = max(0, CUSUM(t−1) + x(t) − μ₀ − k)   k = 0.5σ
```

Drift detected when EWMA exceeds 3σ or CUSUM exceeds 5σ over baseline.

### Cpk (Process Capability)

```
USL, LSL = spec limits; μ̂, σ̂ = sample mean & std
Cpu = (USL − μ̂) / 3σ ;  Cpl = (μ̂ − LSL) / 3σ
Cpk = min(Cpu, Cpl)
```

Coded badge thresholds: **Cpk < 1.00** = high variance (auto-annotated in UI).

### SHAP-like Parameter Contribution (`analytics.py:shap_for_cpk`)

For monotonic drift features we use the analytical SHAP:
```
phi_i = − |current_i − target_i| / (ucl_i − lcl_i)
```
Top 3 high-contribution parameters drive the **driving_factors** list returned to the UI.

### Constraint-based Maintenance Scheduling (`maintenance_optimizer.py`)

Greedy priority scheduling under:
- **Shift hours:** 6:00 – 22:00 (16h)
- **Bays:** 4 (one heavy-duty, two general, one quick-service)
- **Technicians:** 8 (skill-level matrix)
- **Hard constraints:** each task ≥ assigned priority > spare-parts-availability > technician-skill-match
- **Soft:** minimize wait + maximize same-day critical completion

### Fleet Cohort Decomposition

Cohorts by `min(vehicle_idx, 10)`: oldest 3 vehicles = 2021, next 3 = 2022, etc. Synthetic purchase-year assignment for demo (real deployment reads from `vehicles` table).

---

## Real-Time & Background

### Scheduler (`scheduler.py`)

Started automatically on FastAPI lifespan startup, 6 jobs:
| Job | Interval | Purpose |
|-----|----------|---------|
| `news_refresh` | 5 min | Re-fetch 12 RSS feeds, invalidate 5-min news cache |
| `commodity_refresh` | 15 min | Force cache tick on commodity prices |
| `anomaly_scan` | 2 min | Per-vehicle SoH + thermal + degradation rate check |
| `quality_scan` | 3 min | EWMA/CUSUM drift alerts in QMS |
| `supply_scan` | 10 min | Composite-risk thresholds on supply nodes |
| `heartbeat` | 15 min | Internal liveness check |

### Alert Severity Model
- **critical**: SoH < 80, thermal anomaly, supply risk ≥ 7.5
- **warning**: SoH < 85, degradation rate > 0.02/day, drift detected, supply risk ≥ 6
- **info**: Scheduler heartbeats (not pushed to UI)

### WebSocket Protocol

`ws://host:8000/api/alerts/stream`

Client connects → receives **last 10 alerts as backlog** → live deltas thereafter.

Reconnect logic in `LiveAlerts.tsx`: 5-second backoff on disconnect.

### Acknowledgment

`POST /api/alerts/{alert_id}/acknowledge` — sets `acknowledged: true`. UI dims acknowledged rows in the history drawer.

---

## Role-Based Access

4 roles, defined in `AuthContext.tsx`:

| Role | What they see |
|------|---------------|
| **procurement** | Fleet readiness, supply chain, commodities, quality, carbon overview, **analytics** |
| **maintenance** | Fleet health, maintenance schedule, work orders, parts, mobile view, **analytics** |
| **executive** | Executive dashboard, carbon, fleet overview, supply chain, **analytics** (read-only) |
| **admin** | All views, all write actions |

RBAC on the backend is enforced via `auth.py` + `patch_main.py` (decorator monkey-patching).

Login credentials: `admin / admin` (default).

---

## Local Setup

### Backend

```bash
cd backend
py -3.10 -m venv .venv310
.venv310\Scripts\pip install -r requirements.txt
.venv310\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

OpenAPI docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install --include=dev
npm run dev          # http://localhost:5173
# or
npm run build        # produces dist/
```

Set `VITE_API_URL=http://localhost:8000` in `.env`.

### Test

```bash
# Backend health
curl http://localhost:8000/

# Login, then call a protected endpoint
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/fleet-readiness | head -c 200
```

---

## Environment Variables

### Backend
| Var | Required | Default | Purpose |
|-----|----------|---------|---------|
| `OPENAI_API_KEY` | yes | – | Groq/OpenAI key (server uses OpenAI SDK with custom `base_url`) |
| `GROQ_API_KEY` | alt | – | if `OPENAI_API_KEY` is empty, the Groq SDK is auto-discovered |
| `FRONTEND_URL` | no | `http://localhost:5173` | CORS allowed origin |

### Frontend
| Var | Required | Default | Purpose |
|-----|----------|---------|---------|
| `VITE_API_URL` | no | `http://localhost:8000` | API base URL |
| `VITE_API_PORT` | no | `8000` | WebSocket port |

---

## Deployment Notes

- **Cold start** takes 6–9 seconds (OSM Nominatim geocoding, RSS feed parsing, scheduler boot).
- **`@lru_cache`** on the OSM fetcher means OSM is only hit once per process lifetime — survives the OSM volunteer-block policy.
- **`Referer` header** is set on every Nominatim request to comply with their `osm.wiki/Blocked` policy.
- **CORS** is restricted to `FRONTEND_URL` env var.
- **No external broker** — APScheduler runs in-process.
- **SQLite** at `backend/et_project.db` for auth + audit. For multi-instance production, swap to Postgres (Drop-in `database.py: get_db_connection`).
- **Free-tier-friendly** — no Redis, no Celery, no separate worker.
- **One-process** FastAPI + BackgroundScheduler → sufficient for hundreds of concurrent WebSocket clients.

---

## Tests Run

```
Endpoint                                                 Status
──────────────────────────────────────────────────────  ──────
GET /api/auth/login (admin/admin)                       200
POST /api/apm-agent (trace supply chain)                200, confid…
GET /api/fleet-readiness                                200, 100 veh…
GET /api/maintenance-schedule                           200
GET /api/supply-chain                                   200, fallb…
GET /api/quality-intelligence                           200
GET /api/carbon-tracker                                 200
GET /api/commodities                                    200, 7 mate…
GET /api/commodities/battery-cost?kwh=100              200, full b…
GET /api/shap/cpk                                       200, 3 drivi…
GET /api/forecast/rul/EV-003                           200, 52 weeks
GET /api/forecast/thermal/EV-003                       200, 7-day pr…
POST /api/maintenance/cost-prediction/EV-003            200, "REPLACE…
POST /api/carbon/simulate                              200, 35% red…
GET /api/depots                                         200, 5 depot…
GET /api/depots/compare                                 200
GET /api/depots/compare/heatmap                         200
GET /api/depots/DEP-PUN-01/summary                      200
POST /api/permissions/check                            200
GET /api/audit-log                                      200, 44 entr…
GET /api/audit-log/export?role=admin                   200, A4-style…
POST /api/maintenance/submit-for-approval              200, auto-ap…
POST /api/maintenance/decide-approval/{id}             200
WS  /api/alerts/stream (backlog + live deltas)          connected
GET /api/alerts                                         200, 22 crit…
POST /api/alerts/{id}/acknowledge                      200
GET /api/analytics/cohort                               200, 4 cohor…
GET /api/analytics/tco-trend                            200, 12-mo, -5…
GET /api/analytics/vendor-scorecard                    200, A/B/C/D
GET /api/analytics/carbon-credits                       200, 45.4t, ₹5…
GET /api/scheduler/status                               200, 6 jobs
```

**Frontend build:** `tsc -b && vite build` → 2449 modules, **0 errors**, ~5s.

---

## Known Limitations

| Area | Limitation | Mitigation |
|------|-----------|------------|
| Auth | SQLite, no refresh tokens, single shared `admin/admin` | Replace `auth.py` with JWT refresh + Postgres for production |
| OSM | `time.sleep(0.5)` between requests on first cold start | Cached after first run; would benefit from async geocoder |
| News | 12 RSS feeds polled sequentially on cache miss | Could parallelize with `asyncio.gather` |
| Scheduler | In-process; not distributed | Add Redis lock if running multi-instance |
| ML models | Single-sample SHAP/random-forest trained at startup | Replace `qms_rf_*.joblib` with periodic retraining |
| Mobile | No PWA / push notifications | Add service worker + VAPID for push |
| Carbon credits | Indicative pricing (Indian Carbon Exchange ICX est.) | Bind to live ICX API when accessible |
| Synthetic data | All telemetry, ICE fleet, manufacturing batches are synthesized | Wire to real PLC/ERP/CRM for production |
| Auth patch | `patch_main.py` monkey-patches `main.py` at import time | Refactor to decorator-at-definition once stable |

---

## Contributors

Built across 27 commits. See `git log --oneline` for history.

- **KumarSrinidhi** — Project owner
- **CommandCodeBot** — Initial scaffold + companion modules (via Co-authored-by trailer)

---

*Generated as part of the build sequence. For architecture diagram in Mermaid.js, see `ARCHITECTURE.md`.*
