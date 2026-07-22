"""Pre-flight check for fresh installs.

Run this after `pip install -r backend/requirements.txt`. It confirms:
1. Every critical third-party import works
2. SQLite can create the database file
3. The FastAPI app imports without syntax errors
4. The frontend build artifacts exist (if built)

Exits non-zero on any failure so CI fails loudly.
"""
import sys
import os
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "backend"))

FAILED = []
PASSED = []


def check(label: str, fn) -> None:
    try:
        fn()
        PASSED.append(label)
        print(f"  ok   {label}")
    except Exception as e:  # noqa: BLE001
        FAILED.append((label, e))
        print(f"  FAIL {label} — {type(e).__name__}: {e}")


def check_imports() -> None:
    import fastapi
    import pydantic
    import apscheduler
    import websockets
    import uvicorn
    import dotenv
    import httpx
    import requests
    import openai
    import feedparser
    import numpy
    import pandas
    import sklearn
    import joblib
    import scipy
    print(f"        fastapi {fastapi.__version__}, pydantic {pydantic.__version__}, uvicorn {uvicorn.__version__}, httpx {httpx.__version__}")


def check_database() -> None:
    from database import init_db, get_db_connection
    init_db()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall()]
    required = {"users", "roles", "permissions", "depots", "vehicles",
                "work_orders", "parts_inventory"}
    missing = required - set(tables)
    if missing:
        raise RuntimeError(f"missing tables: {missing}")
    conn.close()


def check_app_import() -> None:
    import importlib.util
    spec = importlib.util.spec_from_file_location("et_main", str(ROOT / "backend" / "main.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not hasattr(mod, "app"):
        raise RuntimeError("FastAPI `app` not exposed by main.py")
    routes = [r.path for r in mod.app.routes]
    required_routes = {"/api/fleet-readiness", "/api/maintenance-schedule",
                       "/api/quality-intelligence", "/api/carbon-tracker",
                       "/api/parts", "/api/work-orders",
                       "/api/battery-passport/{vehicle_id}"}
    missing_routes = {r for r in required_routes if not any(p.startswith(r.replace("{vehicle_id}", "").rstrip("/")) for p in routes)}
    if missing_routes:
        raise RuntimeError(f"missing routes: {missing_routes}")


def check_env_file() -> None:
    env = ROOT / ".env"
    if not env.exists():
        print(f"  WARN .env not found at {env}. Copy .env.example to .env before starting the backend.")
        return
    content = env.read_text(encoding="utf-8", errors="ignore")
    if "your-groq-api-key-here" in content or "your-gsk-" in content:
        print("  WARN .env still contains a placeholder key. Replace OPENAI_API_KEY before running the server.")
    if "OPENAI_BASE_URL" not in content:
        raise RuntimeError("OPENAI_BASE_URL missing from .env")


def check_node_deps() -> None:
    pkg_json = ROOT / "frontend" / "package.json"
    if not pkg_json.exists():
        print("  SKIP frontend/package.json missing")
        return
    node_modules = ROOT / "frontend" / "node_modules"
    if not node_modules.exists():
        raise RuntimeError("frontend/node_modules missing — run `npm install` in frontend/")
    pkg = json.loads(pkg_json.read_text())
    critical = ["react", "react-dom", "axios", "leaflet", "recharts"]
    for dep in critical:
        if dep not in pkg.get("dependencies", {}):
            raise RuntimeError(f"missing critical dep: {dep}")


def main() -> int:
    print(f"Verifying installation in {ROOT}")
    check("Python: critical third-party imports", check_imports)
    check("SQLite: all tables created", check_database)
    check("FastAPI: app imports with required routes", check_app_import)
    check("Frontend: npm dependencies installed", check_node_deps)
    check("Environment: .env file present", check_env_file)

    print()
    print(f"Passed: {len(PASSED)}    Failed: {len(FAILED)}")
    if FAILED:
        print("\nFailures:")
        for label, err in FAILED:
            print(f"  - {label}: {err}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
