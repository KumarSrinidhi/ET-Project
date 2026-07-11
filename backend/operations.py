"""Operations layer: multi-fleet, RBAC, audit log, approval workflow.
Designed to feel like a real enterprise back-office system, not a demo."""
import time
import json
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from pydantic import BaseModel
from collections import defaultdict
import threading


# ─── Multi-Fleet Depots ──────────────────────────────────────────────────────

class Depot(BaseModel):
    depot_id: str
    name: str
    city: str
    state: str
    vehicle_count: int
    region: str
    primary_use: str  # "logistics", "delivery", "long-haul"
    manager: str


DEPOTS: List[Depot] = [
    Depot(depot_id="DEP-PUN-01", name="Pune Central Hub",       city="Pune",      state="Maharashtra", vehicle_count=42, region="West",  primary_use="logistics", manager="Anita Desai"),
    Depot(depot_id="DEP-MUM-02", name="Mumbai Port Logistics",  city="Mumbai",    state="Maharashtra", vehicle_count=38, region="West",  primary_use="long-haul", manager="Rajesh Kulkarni"),
    Depot(depot_id="DEP-BLR-03", name="Bangalore Tech Park",    city="Bangalore", state="Karnataka",   vehicle_count=25, region="South", primary_use="delivery",  manager="Priya Iyer"),
    Depot(depot_id="DEP-DEL-04", name="Delhi NCR Distribution", city="Delhi",     state="Delhi",       vehicle_count=31, region="North", primary_use="delivery",  manager="Vikram Singh"),
    Depot(depot_id="DEP-CHE-05", name="Chennai Manufacturing",  city="Chennai",   state="Tamil Nadu",  vehicle_count=18, region="South", primary_use="long-haul", manager="Karthik Raman"),
]


def get_all_depots() -> List[Depot]:
    return DEPOTS


def get_depot_comparison() -> Dict:
    """Return a side-by-side comparison of all depots."""
    rows = []
    for d in DEPOTS:
        # Deterministic per-depot metrics
        seed = sum(ord(c) for c in d.depot_id)
        soh_avg = 95 + (seed % 30) / 10.0  # 95.0 - 98.0
        anomalies = seed % 5
        cost = d.vehicle_count * 180000
        rows.append({
            "depot_id": d.depot_id,
            "name": d.name,
            "city": d.city,
            "vehicle_count": d.vehicle_count,
            "avg_soh": round(soh_avg, 1),
            "active_anomalies": anomalies,
            "monthly_cost_inr": cost,
            "primary_use": d.primary_use,
        })
    # Best / worst
    best = max(rows, key=lambda r: r["avg_soh"])
    worst = min(rows, key=lambda r: r["avg_soh"])
    return {
        "depots": rows,
        "summary": {
            "total_vehicles": sum(r["vehicle_count"] for r in rows),
            "best_performer": best["name"],
            "needs_attention": worst["name"],
            "total_monthly_cost_inr": sum(r["monthly_cost_inr"] for r in rows),
        },
    }


def get_depot_by_id(depot_id: str) -> Optional[Depot]:
    return next((d for d in DEPOTS if d.depot_id == depot_id), None)


# ─── Role-Based Access Control ───────────────────────────────────────────────

class UserRole:
    PROCUREMENT = "procurement"
    MAINTENANCE = "maintenance"
    EXECUTIVE = "executive"
    ADMIN = "admin"


# Each role has access to specific API endpoints / dashboard sections
ROLE_PERMISSIONS = {
    UserRole.PROCUREMENT: {
        "view_fleet_readiness": True,
        "view_costs": True,
        "view_supply_chain": True,
        "view_carbon": True,
        "view_maintenance": False,
        "approve_maintenance": False,
        "view_audit_log": False,
        "export_reports": True,
    },
    UserRole.MAINTENANCE: {
        "view_fleet_readiness": False,
        "view_costs": False,
        "view_supply_chain": False,
        "view_carbon": False,
        "view_maintenance": True,
        "approve_maintenance": True,
        "view_audit_log": True,
        "export_reports": False,
    },
    UserRole.EXECUTIVE: {
        "view_fleet_readiness": True,
        "view_costs": True,
        "view_supply_chain": True,
        "view_carbon": True,
        "view_maintenance": True,
        "approve_maintenance": True,
        "view_audit_log": True,
        "export_reports": True,
    },
    UserRole.ADMIN: {
        "view_fleet_readiness": True,
        "view_costs": True,
        "view_supply_chain": True,
        "view_carbon": True,
        "view_maintenance": True,
        "approve_maintenance": True,
        "view_audit_log": True,
        "export_reports": True,
    },
}


def get_role_permissions(role: str) -> Dict:
    return ROLE_PERMISSIONS.get(role, {})


def can(role: str, action: str) -> bool:
    return ROLE_PERMISSIONS.get(role, {}).get(action, False)


# ─── Audit Log ───────────────────────────────────────────────────────────────

class AuditEntry(BaseModel):
    entry_id: str
    timestamp: str
    user: str
    role: str
    action: str
    resource: str
    details: Dict
    ip_address: str = "127.0.0.1"


_audit_log: List[AuditEntry] = []
_audit_lock = threading.Lock()


def log_action(user: str, role: str, action: str, resource: str, details: Dict) -> AuditEntry:
    entry = AuditEntry(
        entry_id=str(uuid.uuid4())[:8],
        timestamp=datetime.utcnow().isoformat() + "Z",
        user=user,
        role=role,
        action=action,
        resource=resource,
        details=details,
    )
    with _audit_lock:
        _audit_log.append(entry)
    return entry


def get_audit_log(role: str = None, limit: int = 100) -> List[AuditEntry]:
    if role and not can(role, "view_audit_log"):
        return []
    return list(reversed(_audit_log[-limit:]))


def export_audit_log_html(role: str) -> str:
    """Generate a printable HTML page of the audit log. Can be saved as PDF via browser."""
    if not can(role, "view_audit_log"):
        return "<html><body><h1>Access Denied</h1></body></html>"

    rows = "".join(
        f"<tr><td>{e.timestamp}</td><td>{e.user}</td><td>{e.role}</td>"
        f"<td>{e.action}</td><td>{e.resource}</td>"
        f"<td><code>{json.dumps(e.details)[:100]}</code></td></tr>"
        for e in get_audit_log()
    )
    return f"""<!DOCTYPE html>
<html><head><title>Audit Log Export</title>
<style>
  body {{ font-family: -apple-system, system-ui, sans-serif; padding: 24px; color: #1c1917; }}
  h1 {{ font-size: 18px; margin-bottom: 4px; }}
  .meta {{ color: #78716c; font-size: 12px; margin-bottom: 24px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
  th {{ text-align: left; padding: 8px; background: #f5f5f4; border-bottom: 2px solid #d6d3d1;
        text-transform: uppercase; letter-spacing: 0.05em; color: #57534e; font-weight: 600; }}
  td {{ padding: 8px; border-bottom: 1px solid #e7e5e4; }}
  code {{ font-family: ui-monospace, monospace; font-size: 11px; color: #44403c; }}
  @media print {{ body {{ padding: 12px; }} }}
</style></head><body>
<h1>EV Platform — Audit Log Export</h1>
<div class="meta">Generated {datetime.utcnow().isoformat()}Z · Role: {role} · {len(get_audit_log())} entries</div>
<table>
<thead><tr><th>Timestamp</th><th>User</th><th>Role</th><th>Action</th><th>Resource</th><th>Details</th></tr></thead>
<tbody>{rows}</tbody>
</table>
</body></html>"""


# ─── Approval Workflow ───────────────────────────────────────────────────────

class ApprovalRequest(BaseModel):
    request_id: str
    task_id: str
    vehicle_id: str
    task_type: str
    estimated_cost_inr: float
    requested_by: str
    requested_at: str
    status: str  # "pending", "approved", "rejected"
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    reason: str  # why this task needs doing


# Cost threshold: anything above this requires supervisor approval
APPROVAL_THRESHOLD_INR = 500_000.0

_pending_approvals: Dict[str, ApprovalRequest] = {}
_completed_approvals: List[ApprovalRequest] = []
_approval_lock = threading.Lock()


def submit_for_approval(task_id: str, vehicle_id: str, task_type: str,
                         cost_inr: float, reason: str, requested_by: str = "system") -> ApprovalRequest:
    req = ApprovalRequest(
        request_id=str(uuid.uuid4())[:8],
        task_id=task_id,
        vehicle_id=vehicle_id,
        task_type=task_type,
        estimated_cost_inr=cost_inr,
        requested_by=requested_by,
        requested_at=datetime.utcnow().isoformat() + "Z",
        status="pending",
        reason=reason,
    )
    with _approval_lock:
        if cost_inr >= APPROVAL_THRESHOLD_INR:
            _pending_approvals[req.request_id] = req
            log_action(requested_by, "maintenance", "submit_approval", req.request_id,
                       {"vehicle_id": vehicle_id, "cost_inr": cost_inr})
        else:
            # Auto-approve below threshold
            req.status = "approved"
            req.approved_by = "auto_threshold"
            req.approved_at = datetime.utcnow().isoformat() + "Z"
            _completed_approvals.append(req)
    return req


def decide_approval(request_id: str, approve: bool, decided_by: str, role: str,
                     reason: str = "") -> Optional[ApprovalRequest]:
    if not can(role, "approve_maintenance"):
        return None
    with _approval_lock:
        req = _pending_approvals.get(request_id)
        if not req:
            return None
        if approve:
            req.status = "approved"
            req.approved_by = decided_by
            req.approved_at = datetime.utcnow().isoformat() + "Z"
        else:
            req.status = "rejected"
            req.approved_by = decided_by
            req.approved_at = datetime.utcnow().isoformat() + "Z"
            req.rejection_reason = reason
        _completed_approvals.append(req)
        del _pending_approvals[request_id]
    log_action(decided_by, role, "approval_decision", request_id,
               {"approved": approve, "reason": reason, "cost_inr": req.estimated_cost_inr})
    return req


def get_pending_approvals() -> List[ApprovalRequest]:
    return list(_pending_approvals.values())


def get_completed_approvals(limit: int = 50) -> List[ApprovalRequest]:
    return list(reversed(_completed_approvals[-limit:]))
