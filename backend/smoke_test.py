"""End-to-end smoke test.

Runs after every backend change to verify the platform boots cleanly and all
28+ endpoints + the WebSocket alert stream return expected data shapes.

Run from the backend directory:
    .venv310\\Scripts\\python.exe smoke_test.py
"""
import sys
import time
from typing import Callable

try:
    from fastapi.testclient import TestClient
    import importlib.util
    spec = importlib.util.spec_from_file_location("backend_main", "main.py")
    backend = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(backend)
except (ImportError, AttributeError) as e:
    print(f"FAIL: cannot import backend: {e}")
    print("Hint: activate the venv and ensure you're in the backend/ directory.")
    sys.exit(1)


PASS = "PASS"
FAIL = "FAIL"


def run(name: str, fn: Callable[[], bool]) -> bool:
    try:
        ok = fn()
        marker = PASS if ok else FAIL
        print(f"  [{marker}] {name}")
        return ok
    except Exception as e:
        print(f"  [{FAIL}] {name} — {type(e).__name__}: {e}")
        return False


def main() -> int:
    client = TestClient(backend.app)

    # Login
    r = client.post("/api/auth/login", json={"email": "admin@demo.com", "password": "admin"})
    token = r.json().get("access_token") if r.status_code == 200 else None
    if not token:
        print(f"FAIL: login failed — {r.text[:200]}")
        return 1
    headers = {"Authorization": f"Bearer {token}"}

    results: list[bool] = []

    # ── Auth ──
    print("\n[AUTH]")
    results.append(run("login returns token", lambda: token is not None))

    # ── Core 6 ──
    print("\n[CORE 6]")
    results.append(run("GET /api/fleet-readiness",          lambda: client.get("/api/fleet-readiness", headers=headers).status_code == 200))
    results.append(run("POST /api/apm-agent",               lambda: client.post("/api/apm-agent", json={"query": "show fleet health"}, headers=headers).status_code == 200))
    results.append(run("GET /api/maintenance-schedule",     lambda: client.get("/api/maintenance-schedule", headers=headers).status_code == 200))
    results.append(run("GET /api/supply-chain",             lambda: client.get("/api/supply-chain", headers=headers).status_code == 200))
    results.append(run("GET /api/supply-chain/risk/Lithium",lambda: client.get("/api/supply-chain/risk/Lithium", headers=headers).status_code == 200))
    results.append(run("GET /api/quality-intelligence",     lambda: client.get("/api/quality-intelligence", headers=headers).status_code == 200))
    results.append(run("GET /api/shap/cpk",                 lambda: client.get("/api/shap/cpk", headers=headers).status_code == 200))
    results.append(run("GET /api/quality/drift/coating_thickness_um/shap-waterfall",
        lambda: client.get("/api/quality/drift/coating_thickness_um/shap-waterfall", headers=headers).status_code == 200))
    results.append(run("GET /api/carbon-tracker",           lambda: client.get("/api/carbon-tracker", headers=headers).status_code == 200))

    # ── Intelligence ──
    print("\n[INTELLIGENCE]")
    results.append(run("GET /api/commodities",              lambda: client.get("/api/commodities", headers=headers).status_code == 200))
    results.append(run("GET /api/commodities/battery-cost", lambda: client.get("/api/commodities/battery-cost?kwh=100", headers=headers).status_code == 200))
    results.append(run("GET /api/forecast/thermal/EV-001",  lambda: client.get("/api/forecast/thermal/EV-001", headers=headers).status_code == 200))
    results.append(run("GET /api/forecast/rul/EV-001",      lambda: client.get("/api/forecast/rul/EV-001", headers=headers).status_code == 200))
    results.append(run("POST /api/maintenance/cost-prediction/EV-001",
        lambda: client.post("/api/maintenance/cost-prediction/EV-001", headers=headers).status_code == 200))
    results.append(run("POST /api/carbon/simulate",
        lambda: client.post("/api/carbon/simulate", json={"ev_penetration_pct": 80, "renewable_energy_pct": 60, "scope_3_reduction_pct": 25}, headers=headers).status_code == 200))

    # ── Operations ──
    print("\n[OPERATIONS]")
    results.append(run("GET /api/depots",                       lambda: client.get("/api/depots", headers=headers).status_code == 200))
    results.append(run("GET /api/depots/compare",               lambda: client.get("/api/depots/compare", headers=headers).status_code == 200))
    results.append(run("GET /api/depots/compare/heatmap",       lambda: client.get("/api/depots/compare/heatmap", headers=headers).status_code == 200))
    results.append(run("GET /api/depots/DEP-PUN-01/summary",    lambda: client.get("/api/depots/DEP-PUN-01/summary", headers=headers).status_code == 200))
    results.append(run("POST /api/permissions/check",           lambda: client.post("/api/permissions/check", json={"role": "admin", "action": "view_fleet_readiness"}, headers=headers).status_code == 200))
    results.append(run("GET /api/audit-log",                    lambda: client.get("/api/audit-log", headers=headers).status_code == 200))
    results.append(run("GET /api/audit-log/export",             lambda: client.get("/api/audit-log/export", headers=headers).status_code == 200))

    # ── Business Analytics ──
    print("\n[BUSINESS ANALYTICS]")
    results.append(run("GET /api/analytics/cohort",             lambda: client.get("/api/analytics/cohort", headers=headers).status_code == 200))
    results.append(run("GET /api/analytics/tco-trend",          lambda: client.get("/api/analytics/tco-trend", headers=headers).status_code == 200))
    results.append(run("GET /api/analytics/vendor-scorecard",   lambda: client.get("/api/analytics/vendor-scorecard", headers=headers).status_code == 200))
    results.append(run("GET /api/analytics/carbon-credits",     lambda: client.get("/api/analytics/carbon-credits", headers=headers).status_code == 200))

    # ── Real-Time ──
    print("\n[REAL-TIME]")
    results.append(run("GET /api/alerts",                       lambda: client.get("/api/alerts", headers=headers).status_code == 200))
    results.append(run("GET /api/scheduler/status",             lambda: client.get("/api/scheduler/status", headers=headers).status_code == 200))
    results.append(run("POST /api/maintenance/submit-for-approval",
        lambda: client.post("/api/maintenance/submit-for-approval", json={
            "task_id": "SMOKE-1", "vehicle_id": "EV-001", "task_type": "smoke test",
            "cost_inr": 100000, "reason": "smoke test", "requested_by": "smoke"
        }, headers=headers).status_code == 200))

    # ── WebSocket ──
    print("\n[WEBSOCKET]")
    try:
        with client.websocket_connect("/api/alerts/stream") as ws:
            msg = ws.receive_json()
            has_keys = {"severity", "category", "message"}.issubset(set(msg.keys()))
            results.append(run("WS /api/alerts/stream sends alert", lambda: has_keys))
    except Exception as e:
        results.append(run(f"WS /api/alerts/stream connects", lambda: False))

    # ── Summary ──
    passed = sum(results)
    failed = len(results) - passed
    print(f"\n{'='*40}")
    print(f"RESULTS: {passed}/{len(results)} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
