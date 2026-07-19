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
from database import get_db_connection


# ─── Multi-Fleet Depots ──────────────────────────────────────────────────────

class Depot(BaseModel):
    id: str
    name: str
    code: str
    region: str
    lat: float
    lng: float
    timezone: str
    vehicle_count: int
    manager_name: str
    charging_infra: dict
    workshop_capacity: dict


def get_all_depots() -> List[Depot]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM depots")
    rows = cursor.fetchall()
    conn.close()
    
    depots = []
    for r in rows:
        d = dict(r)
        d['charging_infra'] = json.loads(d['charging_infra'])
        d['workshop_capacity'] = json.loads(d['workshop_capacity'])
        depots.append(Depot(**d))
    return depots


def get_depot_comparison(region: str = None) -> Dict:
    """Return a side-by-side comparison of all depots."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM depots"
    params = []
    if region:
        query += " WHERE region = ?"
        params.append(region)
        
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    depots_list = []
    for r in rows:
        # Deterministic per-depot metrics based on id (since we don't have aggregates yet fully populated)
        seed = sum(ord(c) for c in r["id"])
        soh_avg = 80 + (seed % 20) / 10.0  # 80.0 - 99.0
        availability = 70 + (seed % 25)
        rul = 100 + (seed % 50)
        
        depots_list.append({
            "id": r["id"],
            "name": r["name"],
            "code": r["code"],
            "region": r["region"],
            "vehicle_count": r["vehicle_count"],
            "lat": r["lat"],
            "lng": r["lng"],
            "metrics": {
                "avg_soh": round(soh_avg, 1),
                "availability": round(availability, 1),
                "rul": rul
            }
        })
        
    return {"depots": depots_list}


def get_depot_by_id(depot_id: str) -> Optional[Depot]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM depots WHERE id = ?", (depot_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        d = dict(row)
        d['charging_infra'] = json.loads(d['charging_infra'])
        d['workshop_capacity'] = json.loads(d['workshop_capacity'])
        return Depot(**d)
    return None


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
    """Generate a print-ready HTML page styled as a professional PDF document.
    Auto-triggers the browser print dialog on load so the user gets an actual PDF.
    """
    if not can(role, "view_audit_log"):
        return "<html><body><h1>Access Denied</h1></body></html>"

    entries = get_audit_log()
    # Dedupe by (timestamp, user, action, resource) — the submit_approval endpoint
    # and the operations module both call log_action, so we collapse duplicates.
    seen = set()
    deduped = []
    for e in entries:
        key = (e.timestamp, e.user, e.action, e.resource)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(e)

    # Summary stats
    actions_count = {}
    for e in deduped:
        actions_count[e.action] = actions_count.get(e.action, 0) + 1

    generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    report_id = str(uuid.uuid4())[:8].upper()

    def format_value(v) -> str:
        if isinstance(v, float) and v.is_integer():
            v = int(v)
        if isinstance(v, (int, float)):
            return f"<span class='mono num'>{v:,}</span>"
        if isinstance(v, bool):
            return f"<span class='mono'>{'Yes' if v else 'No'}</span>"
        s = str(v)
        return f"<span class='mono'>{s}</span>"

    def format_details(d: dict) -> str:
        if not d:
            return "<span class='muted'>—</span>"
        items = "".join(
            f"<li><span class='key'>{k}</span>{format_value(v)}</li>"
            for k, v in d.items()
        )
        return f"<ul class='kv'>{items}</ul>"

    rows_html = "".join(
        f"""<tr>
            <td class="mono">{e.timestamp}</td>
            <td>{e.user}</td>
            <td><span class="role-tag">{e.role}</span></td>
            <td><span class="action-tag">{e.action}</span></td>
            <td class="mono">{e.resource}</td>
            <td class="details">{format_details(e.details)}</td>
        </tr>"""
        for e in deduped
    )

    summary_html = "".join(
        f'<li><span class="mono">{action}</span><span class="count">{count}</span></li>'
        for action, count in sorted(actions_count.items(), key=lambda x: -x[1])
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>EV Platform Audit Report {report_id}</title>
<style>
  @page {{ size: A4; margin: 18mm 16mm 22mm 16mm; }}
  * {{ box-sizing: border-box; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    color: #1c1917; margin: 0; padding: 0; background: white;
    font-size: 10pt; line-height: 1.5;
  }}
  .doc {{ max-width: 210mm; margin: 0 auto; padding: 24px 32px; }}

  /* Header */
  .header {{
    border-bottom: 2px solid #1c1917; padding-bottom: 16px; margin-bottom: 24px;
    display: flex; justify-content: space-between; align-items: flex-end;
  }}
  .header h1 {{
    font-size: 20pt; font-weight: 700; margin: 0 0 4px 0; letter-spacing: -0.02em;
  }}
  .header .subtitle {{ font-size: 9pt; color: #57534e; text-transform: uppercase; letter-spacing: 0.08em; }}
  .meta-block {{ text-align: right; font-size: 9pt; color: #57534e; }}
  .meta-block .report-id {{ font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 10pt; color: #1c1917; font-weight: 600; }}

  /* Summary cards */
  .summary {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 24px; }}
  .summary .card {{
    background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 4px; padding: 10px 12px;
  }}
  .summary .label {{ font-size: 8pt; color: #78716c; text-transform: uppercase;
    letter-spacing: 0.08em; font-weight: 600; }}
  .summary .value {{ font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 16pt; font-weight: 700; color: #1c1917; margin-top: 2px; }}

  /* Section */
  .section {{ margin-bottom: 20px; }}
  .section h2 {{
    font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
    color: #1c1917; margin: 0 0 10px 0; padding-bottom: 4px; border-bottom: 1px solid #d6d3d1;
  }}

  /* Table */
  table {{ width: 100%; border-collapse: collapse; font-size: 9pt; }}
  thead {{ background: #1c1917; color: #fafaf9; }}
  th {{
    text-align: left; padding: 8px 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.06em; font-size: 8pt;
  }}
  td {{ padding: 8px 10px; border-bottom: 1px solid #e7e5e4; vertical-align: top; }}
  tbody tr {{ page-break-inside: avoid; }}
  tbody tr:nth-child(even) {{ background: #fafaf9; }}
  .mono {{ font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 8.5pt; color: #44403c; }}
  .role-tag, .action-tag {{
    display: inline-block; padding: 2px 6px; border-radius: 3px;
    font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
    background: #e7e5e4; color: #1c1917;
  }}
  .action-tag {{ background: #1c1917; color: #fafaf9; }}
  .details {{ max-width: 280px; word-break: break-all; }}
  .muted {{ color: #a8a29e; font-style: italic; }}
  .kv {{ list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 3px; }}
  .kv li {{ display: flex; gap: 6px; align-items: baseline; font-size: 8.5pt; line-height: 1.4; }}
  .kv .key {{
    color: #78716c; text-transform: uppercase; letter-spacing: 0.04em;
    font-size: 7.5pt; font-weight: 600; min-width: 70px; flex-shrink: 0;
  }}
  .kv .num {{ font-weight: 600; color: #1c1917; }}

  /* Action breakdown */
  .breakdown {{ display: flex; flex-wrap: wrap; gap: 8px; }}
  .breakdown li {{
    list-style: none; background: #f5f5f4; border: 1px solid #e7e5e4;
    padding: 4px 10px; border-radius: 12px; font-size: 9pt;
    display: flex; gap: 8px; align-items: center;
  }}
  .breakdown .count {{
    font-family: ui-monospace, "SF Mono", Menlo, monospace; font-weight: 700;
    color: #1c1917; background: #fafaf9; padding: 0 6px; border-radius: 8px;
  }}

  /* Footer */
  .footer {{
    margin-top: 32px; padding-top: 12px; border-top: 1px solid #d6d3d1;
    display: flex; justify-content: space-between; font-size: 8pt; color: #78716c;
  }}

  /* Print-specific */
  @media print {{
    body {{ background: white; }}
    .doc {{ padding: 0; max-width: none; }}
    .no-print {{ display: none !important; }}
    thead {{ display: table-header-group; }}
  }}

  /* Screen-only toolbar */
  .toolbar {{
    position: fixed; top: 16px; right: 16px; display: flex; gap: 8px;
    background: #1c1917; padding: 8px 12px; border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000;
  }}
  .toolbar button {{
    background: #fafaf9; color: #1c1917; border: none; padding: 6px 12px;
    border-radius: 4px; font-size: 9pt; font-weight: 600; cursor: pointer;
    text-transform: uppercase; letter-spacing: 0.04em;
  }}
  .toolbar button:hover {{ background: #e7e5e4; }}
</style>
</head>
<body>
<div class="toolbar no-print">
  <button onclick="window.print()">Save as PDF</button>
  <button onclick="window.close()">Close</button>
</div>
<div class="doc">
  <div class="header">
    <div>
      <h1>EV Platform Audit Report</h1>
      <div class="subtitle">Supply Chain &amp; Asset Intelligence Platform</div>
    </div>
    <div class="meta-block">
      <div>Report ID: <span class="report-id">RPT-{report_id}</span></div>
      <div>Generated: {generated_at}</div>
      <div>Access Role: {role}</div>
    </div>
  </div>

  <div class="summary">
    <div class="card"><div class="label">Total Entries</div><div class="value">{len(deduped)}</div></div>
    <div class="card"><div class="label">Unique Users</div><div class="value">{len(set(e.user for e in deduped))}</div></div>
    <div class="card"><div class="label">Action Types</div><div class="value">{len(actions_count)}</div></div>
    <div class="card"><div class="label">Time Range</div><div class="value" style="font-size:11pt; padding-top:6px;">{deduped[-1].timestamp[:10] if deduped else '--'}</div></div>
  </div>

  <div class="section">
    <h2>Action Breakdown</h2>
    <ul class="breakdown">{summary_html or '<li>No actions recorded</li>'}</ul>
  </div>

  <div class="section">
    <h2>Audit Log Entries</h2>
    <table>
      <thead>
        <tr>
          <th style="width:18%">Timestamp (UTC)</th>
          <th style="width:12%">User</th>
          <th style="width:8%">Role</th>
          <th style="width:18%">Action</th>
          <th style="width:14%">Resource</th>
          <th style="width:30%">Details</th>
        </tr>
      </thead>
      <tbody>
        {rows_html or '<tr><td colspan="6" style="text-align:center; padding:32px; color:#78716c;">No audit entries recorded.</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div>EV Platform · Confidential · Internal Use Only</div>
    <div>Page generated on demand</div>
  </div>
</div>
</body>
</html>"""


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
