# Developer Quickstart

Local development setup, file structure tour, and conventions. For architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md). For deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md). For per-feature deep-dives, see [FEATURES.md](./FEATURES.md).

---

## Prerequisites

- **Node.js 20+** (Vite 8 + React 19)
- **Python 3.10+** (Pydantic v2, FastAPI 0.139+)
- **Windows / macOS / Linux** — all work
- Optional: **Groq API key** (free at https://console.groq.com — agent features work in demo mode without it)

---

## Install + run

```bash
# Backend
cd backend
py -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm install --include=dev
npm run dev   # http://localhost:5173
```

Open the frontend URL. Login: `admin` / `admin`.

---

## File structure tour

### Backend (`backend/`)

```
main.py                   # 1,300 lines — FastAPI app, all 28+ endpoints, lifespan, RBAC
apm_models.py             # 200 — Synthetic telemetry + non-linear SoH math
analytics.py              # 300 — SHAP, thermal forecast, cost prediction, what-if sim
business_analytics.py     # 200 — Cohort, TCO, scorecard, carbon credits
carbon_tracker.py         # 400 — Scope 1/2/3, LLM recommendations
commodity_feed.py         # 150 — BSE/MCX live prices, battery cost model
maintenance_optimizer.py  # 600 — Constraint-based greedy scheduler
operations.py             # 350 — Depots, RBAC, audit log, approvals
quality_intelligence.py   # 500 — EWMA/CUSUM, Cpk, defect predictions
scheduler.py              # 250 — APScheduler, WebSocket alert broadcasting
shap_service.py           # 300 — Fallback SHAP explainer
supply_chain.py           # 100 — Lazy OSM geocoder
auth.py                   # 100 — JWT, role decorators
database.py               # 50  — SQLite connection helper
requirements.txt          # 25 packages
```

### Frontend (`frontend/src/`)

```
App.tsx                   # 250 — Router, role-gated routes, mounts <LiveAlerts />
api.ts                    # 580 — Typed Axios client, all backend types
AuthContext.tsx           # 150 — JWT, role views
Login.tsx                 # 80  — Login form
ExecutiveDashboard.tsx    # 100 — Executive role home
MaintenanceDashboard.tsx   # 290 — Constrained + mobile/desktop toggle
QualityDashboard.tsx      # 350 — SPC charts, drift table, supplier matrix
NetZeroDashboard.tsx      # 400 — Scope breakdown, monthly, recommendations
SupplyChainDashboard.tsx  # 200 — Leaflet map + risk register

components/
  ApmAgentView.tsx           # Search box + result tables + low-confidence banner
  BusinessAnalyticsView.tsx  # 4 sub-tabs (Cohort / TCO / Scorecard / Credits)
  CommodityPriceWidget.tsx   # Compact price ticker
  DashboardShell.tsx         # Shared loading + error wrapper
  DepotSelector.tsx          # Multi-fleet selector
  ErrorBoundary.tsx          # White-card recoverable error UI
  FleetComparisonDashboard.tsx
  FleetReadinessView.tsx     # Ranked fleet table with INR CapEx
  IntelligenceView.tsx       # Commodity + SHAP + Forecast + Simulator + Ops
  LiveAlerts.tsx             # Floating bell + toast stack + drawer
  MaintenanceMobileView.tsx  # Shop-floor task cards
  RiskScoreCard.tsx
  ShapExplainability.tsx
```

---

## Key conventions

### Python
- **Pydantic v2** for all data models (no dataclasses)
- **Type hints everywhere** (function signatures + return types)
- **No bare `except:`** — always specific exception types
- **Pydantic validators** for input sanitization (e.g. clamp input range)
- **Threading locks** on in-process state (alert deque, audit log, approvals)

### TypeScript / React
- **Strict mode** (`"strict": true` in `tsconfig.json`)
- **Interfaces for all API types** in `api.ts` — no `any` in production code
- **One component per file** (except small helpers like `KPICard`)
- **`<ErrorBoundary>` wrap** on every routed tab
- **Tailwind utility classes** for styling (no styled-components, no CSS-in-JS)
- **`text-[11px] uppercase tracking-wider text-gray-400 font-medium`** for table headers / section labels
- **`font-mono`** for numbers and metrics
- **`bg-canvas rounded-xl border border-hairline shadow-sm`** for the standard elevated card
- **`bg-graphite-900 rounded-xl p-5`** with `text-ink-inverse` for the dark-emphasis card
- **No emojis** anywhere in the UI

### Git
- Conventional commits: `feat:`, `fix:`, `style:`, `chore:`
- Co-authored-by trailer on every commit from the assistant
- Direct push to `main` (single-branch repo for hackathon)

---

## Tests run

Both backend and frontend currently pass `npm run build` (0 errors) and `python -c "import main"` (no import errors).

Manual test scripts:
```bash
# Test all endpoints return 200
cd backend
.venv\Scripts\python.exe -c "
import main
from fastapi.testclient import TestClient
c = TestClient(main.app)
# login + run
"
```

---

## Conventions for adding a new feature

### New backend endpoint

1. Add the math/logic in a separate file under `backend/` (e.g. `feature_new.py`)
2. Add the FastAPI route at the bottom of `main.py` — keep the routes grouped by feature
3. If it requires new math, add the engine to `analytics.py` or a new module
4. If it touches supply chain / APM / quality / carbon, follow the existing patterns for response shape
5. Use `Pydantic BaseModel` for the response schema
6. Add the endpoint to the Frontend `api.ts` interface and a `fetchXxx` function
7. Render in `components/FeatureXxxView.tsx`
8. Add the route to `AuthContext.tsx` for the appropriate role

### New dashboard tab

1. Create the component in `frontend/src/components/`
2. Add a route in `App.tsx: renderContent()` (wrap in `<ErrorBoundary>`)
3. Add the route to `AuthContext.tsx: ROLE_VIEWS.{role}.navItems`
4. Pick an icon from `lucide-react`
5. Use the standard card pattern: `bg-canvas rounded-xl border border-hairline shadow-sm`

### New background job

1. Add a function to `scheduler.py` following the `_xxx_job()` naming convention
2. Register it in `start_scheduler()` with an `IntervalTrigger`
3. Use `push_alert(severity, category, vehicle_id, message, value)` to emit alerts
4. The `LiveAlerts` component on the frontend will automatically pick up new alert categories

---

## Common pitfalls

### "Loading Platform..." hangs forever
- Backend hasn't fully started (cold start takes 6-9 s). The frontend has a 5-retry loop with exponential backoff. If it still hangs, hit the `Retry Connection` button after 30 s.
- Backend crashed during startup. Check the server logs for the traceback.

### "Could not complete the request: name 'X' is not defined"
- The backend hasn't loaded an environment variable or the LLM key isn't set. The agent falls back to keyword matching. Check the server logs.

### WebSocket disconnects immediately
- The browser is connecting to `ws://localhost:8000` but the backend is on a different port. Check the `PORT` and `VITE_API_URL` env vars match.

### Map shows "Awaiting live news analysis..."
- This was a bug in an earlier version. Now fixed: the SupplyChain self-populates with live data on mount, or shows a clear baseline message if the LLM is unavailable.

### MaintenanceOptimizer shows all tasks `delayed_parts`
- Check `maintenance_optimizer.py:PRIORITY` constants for normal mapping. Re-running will generate new random spare-parts availability.

---

*Happy hacking. For questions: see `git log` for recent changes or open an issue.*
