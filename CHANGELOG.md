# Changelog

All notable changes to the EV Asset & Supply Chain Intelligence Platform.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- Initial release of all 23 features across 9 categories (Fleet Readiness, APM Agent, Maintenance, Supply Chain, QMS, Net Zero, Commodity, Intelligence, Business Analytics, Real-Time, Operations, Mobile)
- WebSocket live alert stream with 5-second auto-reconnect
- APScheduler background jobs (news 5m, commodity 15m, anomaly 2m, quality 3m, supply 10m, heartbeat 15m)
- SHAP-style explainability for Cpk process capability
- Multi-RBAC with 4 roles (procurement, maintenance, executive, admin)
- 5-depot multi-fleet view (Pune, Mumbai, Bangalore, Delhi, Chennai)
- Audit log with A4-styled HTML PDF export
- Approval workflow with ₹5L threshold and auto-approve
- Carbon credit marketplace valuation with 3 price tiers
- Cohort analysis, TCO trend, vendor scorecard with letter grades
- What-if carbon simulator (EV/renewable/scope-3 sliders)
- Mobile-first maintenance view (auto-selects on viewports < 768px)
- Live Alerts component (bell + toast stack + history drawer)
- Lazy OSM coordinate cache with `Referer` header for Nominatim policy compliance
- 5-minute RSS news TTL cache
- LLM agent with `tool_choice="required"` (anti-hallucination) and per-query routing confidence
- Indian Rupee (₹) currency throughout — costs, valuations, carbon credits
- Open Street Map tile layer for supply chain map
- SQLite for auth + audit (with `database.py`)
- JWT auth (`admin / admin` default)

### Changed
- Migrated from inline-rendered fleet page to multi-tabbed SPA with sidebar router
- Migrated all `$` USD references to `₹` INR (₹15,000/kWh battery baseline)
- Replaced all `border-gray-200` thick borders with `bg-gray-50/80 rounded-xl` elevated cards

### Fixed
- Frontend build was broken (missing `lucide-react`, `recharts`, `typescript` deps) — installed and rebuilt
- SHAP waterfall endpoint returned 500 when LLM unavailable — now falls back to mock snapshot
- Supply chain dashboard showed "Awaiting live news analysis..." forever — now self-populates on mount
- OSM Nominatim was blocking us — added `Referer` header
- RSS re-fetched on every call — added 5-minute cache

---

## [0.1.0] - Initial scaffold

### Added
- Project structure: `backend/` (FastAPI + Python 3.10) and `frontend/` (React + TypeScript + Vite)
- 6 core features (Fleet Readiness, APM Agent, Maintenance, Supply Chain, QMS, Net Zero)
- Git workflow with conventional commits

---

## Migration Notes (from initial dev to current state)

The codebase evolved through these major phases:

1. **Phase 1 — Demo MVP**: 6 features, monolithic `App.tsx`, all emoji-laden
2. **Phase 2 — Enterprise polish**: split into components, monochrome design, removed emojis, ₹ migration
3. **Phase 3 — Intelligence layer**: commodity feed, SHAP, forecasting, simulator, operations
4. **Phase 4 — Real-time**: APScheduler, WebSocket alerts, mobile-first maintenance, business analytics
5. **Phase 5 — Stability**: build fixes, error boundaries, retry loops, OSM compliance, cache warming
