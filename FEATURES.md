# Feature Catalog

Detailed breakdown of every endpoint, math model, and UI surface. The architecture overview lives in [ARCHITECTURE.md](./ARCHITECTURE.md); the user-facing intro lives in [README.md](./README.md).

---

## 1. Fleet Electrification Readiness

**URL:** `/fleet-readiness` (default tab on app load)
**Endpoint:** `GET /api/fleet-readiness`
**Backend:** `main.py:score_vehicle()` (~700 LOC of weighted scoring)
**Frontend:** `components/FleetReadinessView.tsx`

### Scoring Formula

Each of 100 ICE vehicles receives a 0-100 readiness score from:

```
readiness = 0.35·range + 0.25·charging + 0.20·payload
          + 0.10·infra  + 0.10·elevation
```

| Sub-score | Inputs | Rationale |
|-----------|--------|-----------|
| Range | route_km × climate × safety_margin + elevation | Accounts for winter heat-loss and 20% safety buffer |
| Charging | dwell_hours vs time-to-charge at 50/150 kW | Realistic Indian charger profiles |
| Payload | 44-ton EU weight limit minus (chassis + battery weight) | Battery weight eats into cargo |
| Infra | route distance → 95/80/60 for short/med/long-haul | Long-haul India lacks en-route chargers |
| Elevation | elevation_m / 10 | Mountain routes drain faster |

### CapEx Estimation

```
estimated_capex_inr = recommended_battery_kwh × 15,000  (₹15,000/kWh = Indian market baseline)
```

### UI Surface
- **6 KPI cards:** Total Fleet, Ready (Score>70), Marginal (40-70), Not Ready (<40), Avg TCO Savings, Avg Score
- **Sortable table:** Rank, Vehicle ID, Readiness Score (with progress bar), Range, Charging, Payload, Infra, TCO Savings, Battery, Chemistry, **Est. Cost (INR)**
- **Empty state:** When fleet is empty, shows "No fleet data available" message

### Edge Cases Handled
- `range=0` → still returns 100 if required range ≤ 300 km
- `payload > max_allowable` → returns 0 (not viable)
- `elevation_m=0` → elevation_score = 100

---

## 2. APM Agent

**URL:** `/apm` (2nd tab)
**Endpoint:** `POST /api/apm-agent` (body: `{query}`)
**Backend:** `main.py:apm_agent()` + `apm_models.py`
**Frontend:** `components/ApmAgentView.tsx`
**LLM:** Groq `llama-3.3-70b-versatile`

### 6 Tool-Routing Tools

| Tool name | Math engine | What it returns |
|-----------|------------|-----------------|
| `get_fleet_health` | `apm_models.calculate_soh` | All 10 vehicles with SoH/RUL/anomaly |
| `get_anomalies` | Same, filtered | Only thermal-flagged vehicles |
| `get_maintenance_schedule` | `maintenance_optimizer.optimize_schedule` | Greedy-optimized task list |
| `get_supply_chain_trace` | `main.execute_live_news_risk_assessment` | Live news-driven risk scores + citations |
| `get_quality_intelligence` | `quality_intelligence.generate_quality_report` | Drift + Cpk + defect predictions |
| `get_carbon_report` | `carbon_tracker.generate_net_zero_report` | Scope 1/2/3 + recommendations |

### Hard Constraints (anti-hallucination)
- `tool_choice="required"` — forces the LLM to always pick a tool
- System prompt: *"You are a strict data-routing function. No personality. No generation. Pick the tool."*
- Routing confidence (0-1) computed by `analytics.estimate_routing_confidence()` via keyword overlap
- Below 60% → frontend shows red banner with 6 preset clarification buttons

### Result Shape Routing (frontend heuristic)

```typescript
if (results[0].task_id !== undefined) → maintenance table
else if (results.nodes && Array.isArray(results.nodes)) → supply chain map + citations
else if (results[0].latitude !== undefined) → supply chain fallback
else if (results.kpis?.overall_yield_pct !== undefined) → quality summary card
else if (results.kpis?.total_emissions_tons_co2 !== undefined) → carbon summary card
```

### UI Surface
- 6 preset query chips (Fleet Health, Anomalies, Schedule, Supply Chain, Quality, Carbon)
- Free-text search box with placeholder "Search fleet data, supply chain, or maintenance..."
- Routing confidence badge (color-coded: red < 60%, gray 60-80%, black > 80%)
- Conditional low-confidence clarification banner
- 5 result tables: Battery Health, Maintenance, Supply Chain, QMS, Carbon

---

## 3. Maintenance Optimizer

**URL:** `/maintenance`
**Endpoint:** `GET /api/maintenance-schedule`
**Backend:** `maintenance_optimizer.py` (~600 LOC)
**Frontend:** `MaintenanceDashboard.tsx` + `components/MaintenanceMobileView.tsx`
**View Toggle:** Desktop ↔ Mobile (auto-picks based on viewport width)

### Constraints (in priority order)
1. **Same-day completion** for `critical` priority tasks
2. Technician skill match (heavy-duty tasks need senior techs)
3. Spare-parts availability (delays if not in stock)
4. Bay capacity (4 bays: 1 heavy-duty, 2 general, 1 quick-service)
5. Shift hours (6:00 – 22:00, 16-hour window)
6. Minimize wait, maximize throughput

### Greedy Algorithm
```
priority_order = critical → high → medium → low
for task in priority_order:
    for bay in [heavy_duty, general, general, quick_service]:
        if bay_has_capacity(bay, task.duration):
            if any_tech_skill_matches(task.required_skill):
                schedule(task, bay, tech)
                break
    else:
        if task.priority == 'critical':
            overflow → schedule next day
        else:
            delayed_parts → wait for parts arrival
```

### Output KPI Block
- Total Tasks · Scheduled · Overflow · Delayed (Parts) · Total Cost (INR) · Critical Same-Day %
- Avg Wait Hours · Total Downtime · Throughput / Shift
- 4 bay utilization bars (color-coded)

### Mobile View Features
- Sticky progress header ("Completed 5/12" with progress bar)
- Stacked task cards (one per scheduled task)
- Large checkbox + parts chips + approval submission
- One-tap "Send for ₹5L approval" button (auto-submits to backend)

---

## 4. Supply Chain Risk & Traceability

**URL:** `/supply-chain`
**Endpoint:** `GET /api/supply-chain`, `POST /api/apm-agent` (with `trace supply chain` query)
**Backend:** `supply_chain.py` + `main.py:execute_live_news_risk_assessment()`
**Frontend:** `SupplyChainDashboard.tsx`

### 9 Hardcoded Suppliers (3 tiers)
```
Tier 3 (Raw Materials):
  - Salar de Atacama Mine (Chile, Lithium)
  - Lubumbashi Cobalt Mine (DRC, Cobalt)
  - Sulawesi Nickel Mine (Indonesia, Nickel)
  - Pilbara Lithium Mine (Australia, Spodumene)
  - Heilongjiang Graphite (China, Graphite)
Tier 2 (Mid Processing):
  - Shanghai Cathode Corp (China, NMC Cathode)
  - Umicore Refinery (Belgium, Refined Cobalt)
Tier 1 (Final Assembly):
  - Panasonic EV Pack Plant (USA, Full Battery Pack)
  - CATL Cell Factory (China, LFP Cells)
```

### OSM Geocoding
- Lazy-loaded via `@lru_cache` on `get_cached_base_nodes` — only runs once per process
- 3-second timeout per request
- `Referer` and proper `User-Agent` headers to comply with `osm.wiki/Blocked` policy
- Hardcoded fallback coordinates ensure offline resilience

### Live News Integration
- 12 RSS feeds polled: Mining.com, BBC, Reuters, NYT, The Guardian, etc.
- 5-minute TTL cache (`_news_cache`)
- LLM is asked to: "for each country in [Chile, DRC, Indonesia, Australia, China, Belgium, USA], return risk_score (1-10) + justification + citation_index"
- **Citation chain**: response wraps `{nodes, citations, total_articles_analyzed}` — click any risk score in the right register to see the headline that drove it

### UI Surface
- Top KPI row: "Nodes Tracked" / "Highest Risk Node" / "Tier 3 Dependencies"
- Left: Leaflet map with markers + dashed slate-400 Polyline tracing tier order
- Right: Risk Register (divided list, scrollable)
  - Per row: name + tier badge + material/country + risk bar + justification

---

## 5. Manufacturing Quality Intelligence

**URL:** `/quality`
**Endpoint:** `GET /api/quality-intelligence`, `GET /api/shap/cpk`, `GET /api/quality/drift/{param}/explanation`, `GET /api/quality/drift/{param}/shap-waterfall`
**Backend:** `quality_intelligence.py` + `analytics.py:shap_for_cpk()`
**Frontend:** `QualityDashboard.tsx`

### Drift Detection Algorithms
1. **EWMA** (Exponentially-Weighted Moving Average): `λ=0.3`, alarm when EWMA > 3σ
2. **CUSUM** (Cumulative Sum): `k=0.5σ`, alarm when cumulative deviation > 5σ
3. **SHAP-style contribution**: per-parameter deviation from target

### 4 Tabs
1. **Overview** — 8 KPI cards + Process Parameters table (color-coded drift status) + Supplier Quality Matrix
2. **SPC Charts** — 12 control charts with UCL/CL/LCL annotated, bars colored by in-control vs out-of-control
3. **Inspections** — Incoming batch records with pass/fail badges
4. **Predictions** — Defect predictions with risk factors and action recommendations

### SHAP Cpk Output (`/api/shap/cpk`)
```json
{
  "baseline_cpk": 1.5,
  "current_cpk": 0.88,
  "driving_factors": [
    {"parameter": "coating_thickness_um", "shap_value": -0.45, "is_drifting": true},
    ...
  ],
  "all_contributions": [...sorted by absolute shap_value...],
  "interpretation": "Cpk is 0.88. The top 3 drifting parameters explain 68% of the variance."
}
```

### SHAP Waterfall (`/api/shap/cpk?batch_id=...`)
Returns `{base_value, final_value, features: [{name, value, shap_value}, ...]}` for charting.

### UI Annotations
- **Process Cpk** automatically shows: "Cpk < 1.00 — significant variation. Review process parameters." when applicable
- Drift badges use red only for `critical` severity — `warning`/`normal` get neutral colors per design system

---

## 6. Net Zero Tracker

**URL:** `/carbon`
**Endpoint:** `GET /api/carbon-tracker`, `POST /api/carbon/simulate`
**Backend:** `carbon_tracker.py` + `analytics.py:simulate_carbon_scenario()` + `business_analytics.py:carbon_credit_marketplace()`
**Frontend:** `NetZeroDashboard.tsx` + `BusinessAnalyticsView.tsx` (Carbon Credits tab)

### Scope 1 / 2 / 3 Calculations

| Scope | Source | Method |
|-------|--------|--------|
| **Scope 1 (Direct)** | Fleet fuel + on-site combustion | `fuel_liters × 2.68 kg CO₂/L` |
| **Scope 2 (Energy)** | Purchased electricity (Indian grid) | `kWh × 460 g CO₂/kWh` (India blended intensity) |
| **Scope 3 (Value Chain)** | Supply chain material intensity | `sum(material_kg × intensity_kg_CO₂_per_ton)` |

Avoided emissions = `sum(EV emissions < ICE equivalent for same km)`

### LLM-Generated Recommendations
- Generated dynamically using **actual KPI values** sent in the prompt
- 5-7 specific recommendations, each referencing real numbers
- Fallback to rule-based if LLM unavailable
- Example: *"Scope 3 at 615t is the dominant source — mandate carbon disclosures from top 5 suppliers by volume."*

### What-If Simulator (`POST /api/carbon/simulate`)
Body: `{ev_penetration_pct, renewable_energy_pct, scope_3_reduction_pct}`

```
new_scope_1 = scope_1 × (1 - ev_penetration × 0.80)         # 80% reduction at 100% EV
new_scope_2 = scope_2 × (1 - renewable × 0.90)             # 90% reduction at 100% renewable
new_scope_3 = scope_3 × (1 - scope3_reduction)            # user-controlled
new_total = new_scope_1 + new_scope_2 + new_scope_3
new_years_to_net_zero = log(new_total / 50) / log(1 + adjusted_yoy)
```

### Carbon Credit Marketplace
- Net tradable = `avoided − already_purchased`
- 3 price tiers (₹800/1200/1800 per tCO₂) → valuation
- Environmental equivalents: cars-off-road, homes-powered, Delhi-Mumbai flights

---

## 7. Business Analytics (Cohort / TCO / Scorecard / Credits)

**URL:** `/analytics`
**Endpoint:** `GET /api/analytics/{cohort,tco-trend,vendor-scorecard,carbon-credits}`

| Sub-tab | What it shows |
|---------|---------------|
| Cohort | Battery SoH by vehicle age cohort (synthetic purchase years 2021-2024) with insight on relative aging speed |
| TCO Trend | 12-month per-km cost back-cast with seasonal + tech-improvement factors; SVG line chart |
| Vendor Scorecard | All 9 suppliers graded A/B/C/D with composite score (40% quality + 30% ESG + 20% lead-time + 10% risk) + recommendation per row |
| Carbon Credits | Avoided emissions at 3 market price tiers + environmental equivalents grid |

---

## 8. Real-Time & Background

**Live Alerts:** WebSocket `/api/alerts/stream` + REST `/api/alerts` / `/api/alerts/{id}/acknowledge`
**Scheduler:** `/api/scheduler/status`

### 6 Periodic Jobs (`scheduler.py`)
| Job | Frequency | Purpose |
|-----|-----------|---------|
| news_refresh | 5 min | Refresh RSS news cache |
| commodity_refresh | 15 min | Tick commodity price cache |
| anomaly_scan | 2 min | SoH/thermal/degradation thresholds |
| quality_scan | 3 min | Drift detection in QMS |
| supply_scan | 10 min | Supply risk threshold checks |
| heartbeat | 15 min | Internal liveness tick (not pushed to UI) |

### LiveAlerts Component
- Floating bell button (bottom-right) with unread count badge
- Toast stack auto-dismisses after 8s
- Slide-in history drawer with acknowledge buttons
- WebSocket auto-reconnects every 5s

---

## 9. Operations & Multi-tenancy

| Capability | Where |
|-----------|-------|
| 5 Indian depots (Pune, Mumbai, Bangalore, Delhi, Chennai) | `operations.py` |
| 4 roles (procurement, maintenance, executive, admin) | `AuthContext.tsx` + `auth.py` |
| Audit log + PDF export (A4-styled HTML) | `/api/audit-log*` |
| Approval workflow (₹5L threshold, auto-approve below) | `/api/maintenance/*approval*` |
| RBAC enforcement | `auth.py` + `patch_main.py` decorators |

---

## 10. Mobile-First Maintenance View

**URL:** `/maintenance` with `?view=mobile` (auto-picks on viewports < 768px)
**Component:** `components/MaintenanceMobileView.tsx`

- Sticky progress header ("Completed 5/12") with horizontal progress bar
- Stacked task cards (Bay, Technician, Time, Cost, Parts Needed)
- Large checkbox + acknowledge state
- One-tap approval submission when cost ≥ ₹5L
- Viewport auto-detection with manual toggle in header

---

## 11. SHAP for Quality Drift

**URL:** Inline within `/quality` tab
**Endpoint:** `/api/shap/cpk`, `/api/quality/drift/{parameter_name}/shap-waterfall`

- Analytical SHAP values (no sklearn dependency)
- Top 3 driving factors highlighted
- Per-parameter contribution table
- Waterfall chart data for visualization
- Falls back to mock snapshot when LLM unavailable

---

*For deployment and known limitations, see [README.md](./README.md).*
