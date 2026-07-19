"""Background job scheduler: periodic cache refresh, anomaly detection, alert generation.
Uses APScheduler for cron-style tasks. All jobs run in-process (no external broker).
"""
import threading
import time as _time
from datetime import datetime, timedelta
from typing import Dict, List
from collections import deque
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger


# ─── Alert State ──────────────────────────────────────────────────────────────

class Alert:
    def __init__(self, severity: str, category: str, vehicle_id: str, message: str, value: float = 0):
        self.alert_id = f"ALT-{int(_time.time() * 1000) % 100000:05d}"
        self.timestamp = datetime.utcnow().isoformat() + "Z"
        self.severity = severity  # "critical" | "warning" | "info"
        self.category = category  # "soh" | "thermal" | "drift" | "supply" | "system"
        self.vehicle_id = vehicle_id
        self.message = message
        self.value = value
        self.acknowledged = False

    def to_dict(self):
        return {
            "alert_id": self.alert_id,
            "timestamp": self.timestamp,
            "severity": self.severity,
            "category": self.category,
            "vehicle_id": self.vehicle_id,
            "message": self.message,
            "value": self.value,
            "acknowledged": self.acknowledged,
        }


# Thread-safe alert store. Capped at 100 most recent to avoid memory bloat.
_alert_lock = threading.Lock()
_recent_alerts: deque = deque(maxlen=100)

# Connected WebSocket clients
_ws_lock = threading.Lock()
_ws_clients: set = set()


def push_alert(severity: str, category: str, vehicle_id: str, message: str, value: float = 0) -> Alert:
    alert = Alert(severity, category, vehicle_id, message, value)
    with _alert_lock:
        _recent_alerts.appendleft(alert)
    return alert


def get_recent_alerts(limit: int = 20, severity: str = None) -> List[dict]:
    with _alert_lock:
        items = list(_recent_alerts)
    if severity:
        items = [a for a in items if a.severity == severity]
    return [a.to_dict() for a in items[:limit]]


def acknowledge_alert(alert_id: str) -> bool:
    with _alert_lock:
        for a in _recent_alerts:
            if a.alert_id == alert_id:
                a.acknowledged = True
                return True
    return False


def register_ws(ws):
    with _ws_lock:
        _ws_clients.add(ws)


def unregister_ws(ws):
    with _ws_lock:
        _ws_clients.discard(ws)


async def broadcast_alert(alert: Alert):
    """Push an alert to all connected WebSocket clients."""
    import asyncio
    dead = []
    with _ws_lock:
        clients = list(_ws_clients)
    for ws in clients:
        try:
            await ws.send_json(alert.to_dict())
        except Exception:
            dead.append(ws)
    for d in dead:
        unregister_ws(d)


def broadcast_alert_sync(alert: Alert):
    """Sync version for use in non-async contexts (background jobs)."""
    import asyncio
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return  # no loop, skip
    loop.create_task(broadcast_alert(alert))


# ─── Periodic Jobs ────────────────────────────────────────────────────────────

def _refresh_news_cache_job():
    """Re-fetch RSS feeds every 5 minutes."""
    from main import execute_live_news_risk_assessment
    try:
        execute_live_news_risk_assessment()
    except Exception as e:
        print(f"[scheduler] news refresh failed: {e}")


def _refresh_commodity_cache_job():
    """Commodity prices already cache internally; this just forces a tick."""
    from commodity_feed import get_all_prices
    try:
        get_all_prices()
    except Exception as e:
        print(f"[scheduler] commodity refresh failed: {e}")


def _anomaly_scan_job():
    """Scan fleet telemetry for critical thresholds. Generates alerts."""
    from apm_models import generate_fleet_telemetry
    fleet = generate_fleet_telemetry()
    for vid, health in fleet.items():
        # Critical SoH check
        if health.current_soh < 80:
            a = push_alert("critical", "soh", vid,
                           f"State of Health at {health.current_soh:.1f}% — below critical 80% threshold",
                           value=health.current_soh)
            broadcast_alert_sync(a)
        elif health.current_soh < 85:
            a = push_alert("warning", "soh", vid,
                           f"State of Health at {health.current_soh:.1f}% — below 85%",
                           value=health.current_soh)
            broadcast_alert_sync(a)

        # Thermal anomaly check
        if health.is_anomaly:
            a = push_alert("critical", "thermal", vid,
                           f"Thermal anomaly detected. Avg temp {health.avg_temperature_c:.1f}°C exceeds 3-sigma baseline",
                           value=health.avg_temperature_c)
            broadcast_alert_sync(a)

        # High degradation rate check
        if health.degradation_rate_per_day > 0.02:
            a = push_alert("warning", "soh", vid,
                           f"Degradation rate {health.degradation_rate_per_day:.4f}/day — accelerated aging detected",
                           value=health.degradation_rate_per_day)
            broadcast_alert_sync(a)


def _quality_scan_job():
    """Check for critical drift alerts in manufacturing quality."""
    try:
        from quality_intelligence import generate_quality_report
        report = generate_quality_report()
        if report.kpis.drift_alerts_active > 0:
            a = push_alert("warning", "drift", "QMS",
                           f"{report.kpis.drift_alerts_active} process parameters showing EWMA/CUSUM drift",
                           value=report.kpis.drift_alerts_active)
            broadcast_alert_sync(a)
    except Exception as e:
        print(f"[scheduler] quality scan failed: {e}")


def _supply_chain_scan_job():
    """Re-scan supply chain nodes for high risk."""
    try:
        from supply_chain import get_base_nodes_lazy
        for node in get_base_nodes_lazy():
            if node.composite_risk >= 7.5:
                a = push_alert("critical", "supply", node.entity_name,
                               f"Composite risk {node.composite_risk}/10 — critical geopolitical exposure in {node.country}",
                               value=node.composite_risk)
                broadcast_alert_sync(a)
            elif node.composite_risk >= 6.0:
                a = push_alert("warning", "supply", node.entity_name,
                               f"Composite risk {node.composite_risk}/10 — elevated risk in {node.country}",
                               value=node.composite_risk)
                broadcast_alert_sync(a)
    except Exception as e:
        print(f"[scheduler] supply chain scan failed: {e}")


def _emit_heartbeat_job():
    """Heartbeat so the frontend knows the scheduler is alive."""
    a = push_alert("info", "system", "scheduler",
                   f"Background scanner alive. {len(_recent_alerts)} alerts in queue.",
                   value=_time.time())
    # Don't broadcast heartbeats — they're noise. Just store them.


# ─── Scheduler Setup ──────────────────────────────────────────────────────────

_scheduler: BackgroundScheduler = None


def start_scheduler():
    """Start the background scheduler with all periodic jobs.
    Idempotent — calling twice is a no-op."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(_refresh_news_cache_job, IntervalTrigger(minutes=5), id="news_refresh", replace_existing=True)
    _scheduler.add_job(_refresh_commodity_cache_job, IntervalTrigger(minutes=15), id="commodity_refresh", replace_existing=True)
    _scheduler.add_job(_anomaly_scan_job, IntervalTrigger(minutes=2), id="anomaly_scan", replace_existing=True)
    _scheduler.add_job(_quality_scan_job, IntervalTrigger(minutes=3), id="quality_scan", replace_existing=True)
    _scheduler.add_job(_supply_chain_scan_job, IntervalTrigger(minutes=10), id="supply_scan", replace_existing=True)
    _scheduler.add_job(_emit_heartbeat_job, IntervalTrigger(minutes=15), id="heartbeat", replace_existing=True)
    _scheduler.start()
    print("[scheduler] started — news=5m, commodity=15m, anomaly=2m, quality=3m, supply=10m, heartbeat=15m")
    return _scheduler


def stop_scheduler():
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        print("[scheduler] stopped")


# Backwards-compat alias
shutdown_scheduler = stop_scheduler
