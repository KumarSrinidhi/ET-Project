# API Quick Reference

Comprehensive list of every endpoint. For full prose documentation, see [README.md](./README.md). For per-feature deep dives including the underlying math, see [FEATURES.md](./FEATURES.md).

**Base URL:** `http://localhost:8000` (dev) | your deployment URL (prod)
**Auth:** JWT Bearer token from `POST /api/auth/login`

---

## Authentication

All routes except `/api/auth/login`, `/`, and `/api/audit-log/export` require:
```
Authorization: Bearer <jwt-token>
```

Default credentials: `admin / admin`. Token expires in 24 hours. Refresh: re-login.

---

## 1. Auth

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin"
}

→ 200 OK
{
  "access_token": "eyJ0eXAi...",
  "token_type": "bearer",
  "user": {"username": "admin", "role": "admin", "depot_id": null}
}
```

---

## 2. Core Features (the original 6)

### Fleet Readiness

```http
GET /api/fleet-readiness?depot_id={id}
→ 200 OK
[
  {
    "vehicle_id": "ICE-001",
    "readiness_score": 92.4,
    "range_feasibility": 100.0,
    "charging_opportunity": 85.2,
    "payload_compatibility": 100.0,
    "infra_proximity": 95.0,
    "elevation_penalty": 92.3,
    "tco_savings_pct": 73.3,
    "recommended_battery_kwh": 184.32,
    "recommended_chemistry": "LFP",
    "estimated_capex_inr": 2764800
  },
  ...
]
```

### APM Agent (Tool-Routed LLM)

```http
POST /api/apm-agent
Content-Type: application/json

{"query": "show fleet health"}

→ 200 OK
{
  "agent_thought_process": "Retrieving fleet battery health and degradation metrics...",
  "routing_confidence": 0.95,
  "results": [ ... battery reports ... ]
}
```

Tools triggered by the LLM based on query keywords:
- `get_fleet_health` — all vehicles with SoH/RUL
- `get_anomalies` — only thermal-flagged vehicles
- `get_maintenance_schedule` — constraint-based optimized schedule
- `get_supply_chain_trace` — live news-driven risk + citations
- `get_quality_intelligence` — drift + Cpk + defect predictions
- `get_carbon_report` — Scope 1/2/3 + recommendations

### Maintenance

```http
GET /api/maintenance-schedule?depot_id={id}
→ 200 OK
{
  "shift_date": "2026-07-20",
  "schedule": [
    {
      "task_id": "T-001",
      "vehicle_id": "EV-003",
      "task_type": "battery replacement",
      "priority": "critical",
      "bay_name": "Bay A - Heavy Duty",
      "technician_name": "Senior Tech 1",
      "start_hour": 8,
      "end_hour": 12,
      "estimated_cost_inr": 850000,
      "spare_parts_needed": ["battery pack 184kWh"],
      "status": "scheduled"
    }
  ],
  "kpis": { "total_tasks": 12, "scheduled_tasks": 9, ... },
  "constraints_summary": { "shift_window": "06:00–22:00", ... }
}
```

### Supply Chain

```http
GET /api/supply-chain
→ 200 OK
[
  {
    "entity_name": "Salar de Atacama Mine",
    "tier": 3,
    "material": "Lithium",
    "country": "Chile",
    "latitude": -23.5,
    "longitude": -68.2,
    "composite_risk": 7.5,
    "risk_justification": "Strike announced at lithium facility",
    "esg_score": 6.5,
    "lead_time_days": 45,
    "criticality": "critical"
  },
  ...
]

GET /api/supply-chain/risk/{material}
→ 200 OK { "material": "Lithium", "supply_risk_score": 8.2, "affected_vehicles": [...] }
```

### QMS Quality

```http
GET /api/quality-intelligence?depot_id={id}
→ 200 OK
{
  "kpis": {
    "overall_yield_pct": 96.1,
    "first_pass_yield_pct": 95.18,
    "defect_rate_ppm": 6071.4,
    "scrap_cost_inr": 2651.31,
    "supplier_quality_index": 87.7,
    "process_capability_cpk": 0.88,
    "drift_alerts_active": 3,
    "batches_at_risk": 6
  },
  "process_parameters": [...],
  "inspection_records": [...],
  "defect_predictions": [...],
  "spc_charts": {
    "coating_thickness_um": [
      {"value": 195.2, "ucl": 200, "lcl": 180, "center_line": 190, "out_of_control": false, "timestamp": "2026-07-19T..."}
    ]
  },
  "supplier_quality_matrix": [...]
}

GET /api/shap/cpk
→ 200 OK
{
  "baseline_cpk": 1.5,
  "current_cpk": 0.88,
  "driving_factors": [...top 3 SHAP contributors...],
  "all_contributions": [...sorted by |SHAP|...],
  "interpretation": "Cpk is 0.88. Top 3 explain 68% of variance."
}

GET /api/quality/drift/{parameter_name}/explanation
→ 200 OK { "explanation": "...", "factors": [...], "recommended_action": "..." }

GET /api/quality/drift/{parameter_name}/shap-waterfall
→ 200 OK { "base_value": 2.43, "final_value": 0.51, "features": [{name, value, shap_value}] }
```

### Net Zero

```http
GET /api/carbon-tracker?depot_id={id}
→ 200 OK
{
  "kpis": {
    "total_emissions_tons_co2": 896.5,
    "scope_1_tons": 210.5,
    "scope_2_tons": 71.0,
    "scope_3_tons": 615.0,
    "avoided_emissions_tons": 70.4,
    "carbon_intensity_g_per_km": 269.6,
    "yoy_reduction_pct": 18.5,
    "target_year": 2035,
    "years_to_net_zero": 9,
    "renewable_energy_pct": 35.0,
    "ev_fleet_pct": 40.0,
    "offset_credits_tons": 25.0
  },
  "recommendations": [...LLM-driven specific advice...],
  "scope_breakdown": { "Scope 1": 210.5, "Scope 2": 71.0, "Scope 3": 615.0 }
}
```

---

## 3. Intelligence

### Commodity Feed

```http
GET /api/commodities
→ 200 OK
{
  "prices": [
    {
      "material": "Lithium",
      "symbol": "LITH-USD",
      "price_inr_per_kg": 1100.50,
      "change_pct_24h": -2.34,
      "last_updated": "2026-07-20T...",
      "source": "London Metal Exchange",
      "unit": "kg (LCE)"
    },
    ...
  ],
  "count": 7
}

GET /api/commodities/battery-cost?kwh=100&chemistry=NMC 811
→ 200 OK
{
  "chemistry": "NMC 811",
  "kwh": 100,
  "raw_material_cost_inr": 124567,
  "processing_margin_inr": 31142,
  "total_battery_cost_inr": 155709,
  "cost_per_kwh_inr": 1557,
  "breakdown": [
    {"material": "Lithium", "kg_required": 12, "price_inr_per_kg": 1100, "cost_inr": 13200},
    ...
  ]
}
```

### Forecast

```http
GET /api/forecast/thermal/{vehicle_id}
→ 200 OK
{
  "predictions": [
    {"day_offset": 1, "date": "...", "projected_temp_c": 32.4, "z_score": 0.8, "anomaly_likely": false},
    ...
  ],
  "high_risk_days": [],
  "model": "Rolling Z-Score (Isolation Forest equivalent)",
  "confidence": "High"
}

GET /api/forecast/rul/{vehicle_id}
→ 200 OK
{
  "forecast": [
    {"day": 0, "soh": 98.79, "lower_bound": 96.79, "upper_bound": 100, "date": "..."},
    {"day": 365, "soh": 90.21, "lower_bound": 82.21, "upper_bound": 98.21, "date": "..."}
  ],
  "end_of_life_day": null,
  "end_of_life_estimate": "Beyond 365 days",
  "warning": "Forecast assumes current operating conditions continue unchanged."
}

POST /api/maintenance/cost-prediction/{vehicle_id}
→ 200 OK
{
  "vehicle_id": "EV-003",
  "current_soh": 98.79,
  "projected_soh_180d": 97.32,
  "failure_probability_180d": 0.10,
  "battery_cost_inr": 1557090,
  "scenarios": {
    "replace_now": {"cost_inr": 1557090, "risk": "Low — scheduled downtime"},
    "replace_in_6_months": {"cost_inr": 1712800, "risk": "10% chance of emergency failure"},
    "do_nothing": {"expected_emergency_cost_inr": 217993, "risk": "10% catastrophic failure"}
  },
  "recommendation": "MONITOR — no action needed",
  "estimated_savings_inr": 0
}
```

### What-If Simulator

```http
POST /api/carbon/simulate
Content-Type: application/json

{
  "ev_penetration_pct": 100,
  "renewable_energy_pct": 80,
  "scope_3_reduction_pct": 30
}

→ 200 OK
{
  "scenario": {"ev_penetration_pct": 100, "renewable_energy_pct": 80, "scope_3_reduction_pct": 30},
  "baseline": {
    "total_tons_co2": 896.5,
    "scope_1_tons": 210.5,
    "scope_2_tons": 71.0,
    "scope_3_tons": 615.0,
    "years_to_net_zero": 9
  },
  "simulated": {
    "total_tons_co2": 484.5,
    "scope_1_tons": 42.1,
    "scope_2_tons": 15.6,
    "scope_3_tons": 430.5,
    "years_to_net_zero": 5,
    "reduction_vs_baseline_pct": 46.0
  }
}
```

---

## 4. Operations

### Multi-Fleet Depots

```http
GET /api/depots
→ 200 OK { "depots": [...5 entries...], "summary": { "total_vehicles": 154, ... } }

GET /api/depots/{depot_id}
→ 200 OK { "depot_id": "DEP-PUN-01", "name": "Pune Central Hub", ... }

GET /api/depots/compare
GET /api/depots/compare/heatmap
GET /api/depots/{depot_id}/summary
```

### RBAC

```http
POST /api/permissions/check
Content-Type: application/json

{"role": "maintenance", "action": "view_fleet_readiness"}

→ 200 OK
{
  "role": "maintenance",
  "action": "view_fleet_readiness",
  "allowed": false,
  "all_permissions": { "view_fleet_readiness": false, "view_maintenance": true, ... }
}
```

### Audit Log

```http
GET /api/audit-log?role=admin&limit=10
→ 200 OK { "role": "admin", "can_view": true, "entries": [...] }

GET /api/audit-log/export?role=admin
→ 200 OK (HTML — opens print dialog)
```

### Approval Workflow

```http
POST /api/maintenance/submit-for-approval
Content-Type: application/json

{
  "task_id": "T-099",
  "vehicle_id": "EV-003",
  "task_type": "battery replacement",
  "cost_inr": 850000,
  "reason": "SoH dropped below 80%",
  "requested_by": "system"
}

→ 200 OK
{
  "approval": { "request_id": "abc123de", "status": "pending", "estimated_cost_inr": 850000, ... },
  "auto_approved": false,
  "threshold_inr": 500000
}

GET /api/maintenance/pending-approvals?role=maintenance
→ 200 OK { "pending": [...], "threshold_inr": 500000 }

POST /api/maintenance/decide-approval/{request_id}
Content-Type: application/json

{ "approved": true, "decided_by": "supervisor@ev.io", "role": "maintenance", "reason": "Approved" }
```

---

## 5. Business Analytics

```http
GET /api/analytics/cohort
→ 200 OK
{
  "cohorts": [
    {"cohort_year": 2021, "label": "2021 (3+ yr)", "vehicle_count": 3, "avg_soh": 98.17, "avg_degradation_rate": 0.0066, "interpretation": "..."},
    ...
  ],
  "insight": "Oldest cohort (2021) shows SoH -0.57% vs newest."
}

GET /api/analytics/tco-trend?months=12
GET /api/analytics/vendor-scorecard
GET /api/analytics/carbon-credits
```

---

## 6. Real-Time

```http
WebSocket ws://host:8000/api/alerts/stream
→ Server sends last 10 alerts as backlog, then live updates

GET /api/alerts?limit=20&severity=critical
POST /api/alerts/{alert_id}/acknowledge

GET /api/scheduler/status
→ 200 OK
{
  "status": "running",
  "jobs": [
    {"id": "news_refresh", "next_run": "2026-07-20T14:35:00Z", "trigger": "interval[0:05:00]"},
    {"id": "anomaly_scan", "next_run": "2026-07-20T14:32:00Z", "trigger": "interval[0:02:00]"},
    ...
  ]
}
```

---

## 7. Misc

```http
GET /                  → Root health check
GET /docs              → Swagger UI (auto-generated)
GET /openapi.json      → OpenAPI spec
```

---

## Status codes

| Code | Meaning |
|------|---------|
| 200 | OK — payload returned |
| 401 | Unauthorized — JWT invalid/expired |
| 403 | Forbidden — RBAC denied |
| 404 | Resource not found |
| 422 | Validation error (Pydantic) |
| 500 | Server error (check logs) |

---

## Rate limits

Currently **none**. The platform trusts the auth layer for protection. Add rate limiting at the nginx / reverse proxy level for production deployments.
