import re

path = "main.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add auth imports and middleware
auth_code = """
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from auth import create_access_token, verify_token
from database import get_db_connection
import json

security = HTTPBearer()

def require_permission(required_perm: str):
    def permission_checker(credentials: HTTPAuthorizationCredentials = Depends(security)):
        token = credentials.credentials
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        role_id = payload.get("role_id")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if role has the required permission (or is admin)
        cursor.execute('''
            SELECT 1 FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            WHERE rp.role_id = ? AND (p.id = ? OR rp.role_id = 'admin')
        ''', (role_id, required_perm))
        
        if not cursor.fetchone() and role_id != 'admin':
            conn.close()
            raise HTTPException(status_code=403, detail={"error": "Insufficient permissions", "required": required_perm, "your_role": role_id})
            
        conn.close()
        return payload
    return permission_checker

def require_depot_access(depot_id: str, user_payload: dict):
    role_id = user_payload.get("role_id")
    if role_id == 'admin':
        return True
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM role_permissions WHERE role_id = ? AND permission_id = 'depot.all'", (role_id,))
    has_all = cursor.fetchone() is not None
    conn.close()
    
    if has_all:
        return True
        
    depots = user_payload.get("depots", [])
    if depot_id not in depots:
        raise HTTPException(status_code=403, detail={"error": "Access to this depot is restricted"})
    return True

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/login")
def login(req: LoginRequest):
    # Hackathon mock logic: password check is ignored for demo accounts if email matches
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, role_id, assigned_depots FROM users WHERE email = ?", (req.email,))
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    assigned_depots = json.loads(user["assigned_depots"]) if user["assigned_depots"] else []
    
    token = create_access_token(user["id"], user["role_id"], assigned_depots)
    return {
        "access_token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "role": user["role_id"],
            "depots": assigned_depots
        }
    }
"""

if "require_permission" not in content:
    content = content.replace("app = FastAPI(lifespan=lifespan)", "app = FastAPI(lifespan=lifespan)\n" + auth_code)

# 2. Patch endpoints
endpoint_map = {
    r'@app.get\("/api/fleet-readiness"\)\ndef get_fleet_readiness\(': (r'@app.get("/api/fleet-readiness")\ndef get_fleet_readiness(', 'user: dict = Depends(require_permission("fleet.health.view")), '),
    r'@app.get\("/api/supply-chain"\)\ndef get_supply_chain_nodes\(': (r'@app.get("/api/supply-chain")\ndef get_supply_chain_nodes(', 'user: dict = Depends(require_permission("supply_chain.risk.view")), '),
    r'@app.get\("/api/supply-chain/risk/\{material\}"\)\ndef get_supply_chain_risk\(': (r'@app.get("/api/supply-chain/risk/{material}")\ndef get_supply_chain_risk(', 'user: dict = Depends(require_permission("supply_chain.risk.view")), '),
    r'@app.get\("/api/maintenance-schedule"\)\ndef get_maintenance_schedule_endpoint\(': (r'@app.get("/api/maintenance-schedule")\ndef get_maintenance_schedule_endpoint(', 'user: dict = Depends(require_permission("fleet.maintenance.view")), '),
    r'@app.get\("/api/quality-intelligence"\)\ndef get_quality_intelligence_endpoint\(': (r'@app.get("/api/quality-intelligence")\ndef get_quality_intelligence_endpoint(', 'user: dict = Depends(require_permission("quality.qms.view")), '),
    r'@app.get\("/api/quality/drift/\{batch_id\}/explanation"\)\ndef get_quality_drift_explanation\(': (r'@app.get("/api/quality/drift/{batch_id}/explanation")\ndef get_quality_drift_explanation(', 'user: dict = Depends(require_permission("quality.qms.view")), '),
    r'@app.get\("/api/quality/drift/\{batch_id\}/shap-waterfall"\)\ndef api_get_shap_waterfall\(': (r'@app.get("/api/quality/drift/{batch_id}/shap-waterfall")\ndef api_get_shap_waterfall(', 'user: dict = Depends(require_permission("quality.qms.view")), '),
    r'@app.get\("/api/carbon-tracker"\)\ndef get_carbon_tracker_endpoint\(': (r'@app.get("/api/carbon-tracker")\ndef get_carbon_tracker_endpoint(', 'user: dict = Depends(require_permission("carbon.dashboard.view")), '),
    r'@app.get\("/api/shap/cpk"\)\ndef get_shap_for_cpk\(': (r'@app.get("/api/shap/cpk")\ndef get_shap_for_cpk(', 'user: dict = Depends(require_permission("quality.qms.view")), '),
    r'@app.get\("/api/forecast/thermal/\{vehicle_id\}"\)\ndef get_thermal_forecast\(': (r'@app.get("/api/forecast/thermal/{vehicle_id}")\ndef get_thermal_forecast(', 'user: dict = Depends(require_permission("fleet.health.view")), '),
    r'@app.get\("/api/forecast/rul/\{vehicle_id\}"\)\ndef get_rul_forecast\(': (r'@app.get("/api/forecast/rul/{vehicle_id}")\ndef get_rul_forecast(', 'user: dict = Depends(require_permission("fleet.health.view")), '),
    r'@app.post\("/api/maintenance/cost-prediction/\{vehicle_id\}"\)\ndef get_cost_prediction\(': (r'@app.post("/api/maintenance/cost-prediction/{vehicle_id}")\ndef get_cost_prediction(', 'user: dict = Depends(require_permission("fleet.maintenance.view")), '),
    r'@app.post\("/api/carbon/simulate"\)\ndef post_carbon_simulate\(': (r'@app.post("/api/carbon/simulate")\ndef post_carbon_simulate(', 'user: dict = Depends(require_permission("carbon.dashboard.view")), '),
    r'@app.get\("/api/commodities"\)\ndef get_commodities\(': (r'@app.get("/api/commodities")\ndef get_commodities(', 'user: dict = Depends(require_permission("fleet.procurement.view")), '),
    r'@app.get\("/api/commodities/battery-cost"\)\ndef get_battery_cost_endpoint\(': (r'@app.get("/api/commodities/battery-cost")\ndef get_battery_cost_endpoint(', 'user: dict = Depends(require_permission("fleet.procurement.view")), '),
    r'@app.get\("/api/depots/compare"\)\ndef api_get_depots_compare\(': (r'@app.get("/api/depots/compare")\ndef api_get_depots_compare(', 'user: dict = Depends(require_permission("depot.all")), '),
    r'@app.get\("/api/depots/compare/heatmap"\)\ndef api_get_depots_heatmap\(': (r'@app.get("/api/depots/compare/heatmap")\ndef api_get_depots_heatmap(', 'user: dict = Depends(require_permission("depot.all")), '),
    r'@app.get\("/api/depots/\{depot_id\}/summary"\)\ndef api_get_depot_summary\(': (r'@app.get("/api/depots/{depot_id}/summary")\ndef api_get_depot_summary(', 'user: dict = Depends(require_permission("fleet.health.view")), '),
    r'@app.get\("/api/depots"\)\ndef api_get_depots\(': (r'@app.get("/api/depots")\ndef api_get_depots(', 'user: dict = Depends(require_permission("fleet.health.view")), '),
    r'@app.get\("/api/depots/\{depot_id\}"\)\ndef get_depot_endpoint\(': (r'@app.get("/api/depots/{depot_id}")\ndef get_depot_endpoint(', 'user: dict = Depends(require_permission("fleet.health.view")), '),
    r'@app.post\("/api/permissions/check"\)\ndef check_permission\(': (r'@app.post("/api/permissions/check")\ndef check_permission(', 'user: dict = Depends(require_permission("fleet.health.view")), '), # fallback
    r'@app.get\("/api/audit-log"\)\ndef get_audit_log_endpoint\(': (r'@app.get("/api/audit-log")\ndef get_audit_log_endpoint(', 'user: dict = Depends(require_permission("admin.audit.view")), '),
    r'@app.get\("/api/audit-log/export"\)\ndef export_audit_log_endpoint\(': (r'@app.get("/api/audit-log/export")\ndef export_audit_log_endpoint(', 'user: dict = Depends(require_permission("admin.audit.export")), '),
    r'@app.post\("/api/maintenance/submit-for-approval"\)\ndef submit_maintenance_approval\(': (r'@app.post("/api/maintenance/submit-for-approval")\ndef submit_maintenance_approval(', 'user: dict = Depends(require_permission("fleet.maintenance.create")), '),
    r'@app.get\("/api/maintenance/pending-approvals"\)\ndef get_pending_approvals_endpoint\(': (r'@app.get("/api/maintenance/pending-approvals")\ndef get_pending_approvals_endpoint(', 'user: dict = Depends(require_permission("fleet.maintenance.view")), '),
    r'@app.post\("/api/maintenance/decide-approval/\{request_id\}"\)\ndef decide_approval_endpoint\(': (r'@app.post("/api/maintenance/decide-approval/{request_id}")\ndef decide_approval_endpoint(', 'user: dict = Depends(require_permission("fleet.maintenance.approve")), '),
    r'@app.get\("/api/commodity/prices"\)\ndef api_get_commodity_prices\(': (r'@app.get("/api/commodity/prices")\ndef api_get_commodity_prices(', 'user: dict = Depends(require_permission("fleet.procurement.view")), '),
    r'@app.get\("/api/commodity/capex-impact"\)\ndef api_get_capex_impact\(': (r'@app.get("/api/commodity/capex-impact")\ndef api_get_capex_impact(', 'user: dict = Depends(require_permission("fleet.procurement.view")), '),
}

for pattern, (search_str, insert_str) in endpoint_map.items():
    if search_str in content and insert_str not in content:
        # Some methods have default params first, so inserting at the start of args might be tricky if not careful,
        # but Python allows default params (like our Depends) after non-default args, wait... Depends() actually acts as a default param in FastAPI!
        # So we can just put it first, or at the end. Actually FastAPI allows Depends() anywhere.
        # Let's just insert it at the beginning of the arguments.
        
        # Example: def get_fleet_readiness(depot_id: str = None):
        # We want: def get_fleet_readiness(user: dict = Depends(require_permission("...")), depot_id: str = None):
        
        replace_str = search_str.replace("(", "(" + insert_str)
        content = content.replace(search_str, replace_str)

# Add depot checks to endpoints that take depot_id
depot_check_code = """
    if depot_id:
        require_depot_access(depot_id, user)
"""
if "require_depot_access(depot_id, user)" not in content:
    content = content.replace("    if depot_id:\n        seed_value = sum(ord(c) for c in depot_id)", depot_check_code + "        seed_value = sum(ord(c) for c in depot_id)")
    
    # get_depot_endpoint
    content = content.replace("    d = get_depot_by_id(depot_id)\n    if not d:", "    require_depot_access(depot_id, user)\n    d = get_depot_by_id(depot_id)\n    if not d:")

    # api_get_depot_summary
    content = content.replace("    depot = get_depot_by_id(depot_id)\n    if not depot:", "    require_depot_access(depot_id, user)\n    depot = get_depot_by_id(depot_id)\n    if not depot:")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied.")
