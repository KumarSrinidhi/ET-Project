from typing import List
import json
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from pydantic import BaseModel
import random
from fastapi.middleware.cors import CORSMiddleware
from apm_models import generate_fleet_telemetry, BatteryHealthReport, generate_ev_telemetry
from openai import OpenAI
import feedparser
from supply_chain import get_base_nodes_lazy, SupplyNode
from maintenance_optimizer import optimize_schedule, OptimizedSchedule
from quality_intelligence import generate_quality_report, QualityIntelligenceReport, generate_process_data
from carbon_tracker import generate_net_zero_report, NetZeroReport
from commodity_feed import get_all_prices, get_price, estimate_battery_cost_inr
from analytics import (
    shap_for_cpk, estimate_routing_confidence, forecast_soh_curve,
    forecast_thermal_anomalies, predict_replacement_cost, simulate_carbon_scenario,
)
from operations import (
    get_all_depots, get_depot_by_id, get_depot_comparison,
    can, get_role_permissions, log_action,
    get_audit_log, export_audit_log_html,
    submit_for_approval, decide_approval, get_pending_approvals, get_completed_approvals,
    APPROVAL_THRESHOLD_INR, UserRole,
)


from contextlib import asynccontextmanager
from scheduler import start_scheduler, shutdown_scheduler
from database import get_db_connection

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    shutdown_scheduler()

app = FastAPI(lifespan=lifespan)

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


client = None

def get_openai_client():
    global client
    if client is None:
        client = OpenAI()
    return client

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_fleet_health",
            "description": "Gets the battery State of Health, RUL, and degradation rate for all EVs.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_anomalies",
            "description": "Gets only the vehicles that have flagged a thermal anomaly.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_maintenance_schedule",
            "description": "Gets the optimized maintenance schedule for vehicles that need repairs.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_supply_chain_trace",
            "description": "Traces the battery pack to mines using REAL-TIME coordinates, and fetches LIVE news from Mining.com to calculate dynamic geopolitical risk scores. Use this for supply chain queries.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_quality_intelligence",
            "description": "Gets manufacturing quality data including process parameter drift, SPC charts, defect predictions, incoming inspection records, and supplier quality matrix. Use for quality, QMS, defect, drift, SPC, inspection, or manufacturing queries.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_carbon_report",
            "description": "Gets the Net Zero & Carbon Intelligence report including Scope 1/2/3 emissions, fleet EV vs ICE comparison, supply chain carbon footprint, monthly progress tracking, and reduction recommendations. Use for carbon, emissions, net zero, sustainability, or climate queries.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    }
]


class IceVehicle(BaseModel):
    vehicle_id: str
    route_distance_km: float
    payload_tons: float
    elevation_gain_m: float
    dwell_time_hours: float
    shift_length_hours: float


class ReadinessResult(BaseModel):
    vehicle_id: str
    readiness_score: float
    range_feasibility: float
    charging_opportunity: float
    payload_compatibility: float
    infra_proximity: float
    elevation_penalty: float
    tco_savings_pct: float
    recommended_battery_kwh: float
    recommended_chemistry: str


class AgentQuery(BaseModel):
    query: str


class MaintenanceTask(BaseModel):
    vehicle_id: str
    reason: str
    duration_hours: float


class ScheduledTask(BaseModel):
    vehicle_id: str
    reason: str
    bay_number: int
    start_hour: int


def generate_synthetic_fleet() -> List[IceVehicle]:
    fleet: List[IceVehicle] = []
    for i in range(1, 101):
        fleet.append(
            IceVehicle(
                vehicle_id=f"ICE-{i:03d}",
                route_distance_km=random.uniform(40.0, 300.0),
                payload_tons=random.uniform(2.0, 40.0),
                elevation_gain_m=random.uniform(10.0, 500.0),
                dwell_time_hours=random.uniform(1.0, 12.0),
                shift_length_hours=random.uniform(8.0, 16.0),
            )
        )
    return fleet


fleet_data = generate_synthetic_fleet()

apm_fleet_data = generate_fleet_telemetry()


def score_vehicle(v: IceVehicle) -> ReadinessResult:
    # Range feasibility: account for elevation, climate, and safety margin
    elevation_energy_penalty = v.elevation_gain_m * 0.001  # kWh per meter gain
    climate_factor = 1.15  # Winter/heat loss factor
    safety_margin = 1.2
    required_range = v.route_distance_km * safety_margin * climate_factor + elevation_energy_penalty * 100

    if required_range <= 300:
        range_score = 100.0
    elif required_range <= 500:
        range_score = max(0.0, 100.0 - ((required_range - 300.0) / 3.0))
    else:
        range_score = max(0.0, 100.0 - ((required_range - 300.0) / 2.0))

    recommended_battery_kwh = min(required_range * 1.1, 800)  # Cap at 800 kWh

    # Chemistry recommendation based on use case
    if v.payload_tons > 20 or recommended_battery_kwh > 400:
        recommended_chemistry = "LFP"  # Better for heavy-duty, longer life
    else:
        recommended_chemistry = "NMC 811"  # Better energy density for lighter vehicles

    # Charging opportunity: consider dwell time vs charge time with realistic charger speeds
    charger_power_kw = 150.0 if recommended_battery_kwh > 200 else 50.0
    time_to_charge = (recommended_battery_kwh * 0.7) / charger_power_kw  # Charge to 80%
    if v.dwell_time_hours >= time_to_charge:
        charging_score = 100.0
    else:
        charging_score = max(0.0, (v.dwell_time_hours / time_to_charge) * 100.0)

    # Payload compatibility: EV battery weight reduces cargo capacity
    battery_weight_tons = recommended_battery_kwh * 0.006  # ~6 kg/kWh
    ev_base_weight = 15.0 + battery_weight_tons
    max_allowable_payload = 44.0 - ev_base_weight  # EU weight limit
    if v.payload_tons <= max_allowable_payload:
        payload_score = 100.0
    elif v.payload_tons <= max_allowable_payload * 1.1:
        payload_score = 50.0  # Marginal
    else:
        payload_score = 0.0

    # Infrastructure proximity score: varies by route distance
    if v.route_distance_km < 100:
        infra_score = 95.0  # Short urban routes, easy charging
    elif v.route_distance_km < 200:
        infra_score = 80.0
    else:
        infra_score = 60.0  # Long-haul, limited en-route charging

    # Elevation penalty
    elevation_score = max(0.0, 100.0 - (v.elevation_gain_m / 10.0))

    # TCO savings estimate (varies dynamically per vehicle based on payload and elevation)
    # Heavier payloads and higher elevation gain increase fuel consumption for diesel more than EV
    diesel_cost_per_km = 0.35 + (v.payload_tons * 0.015) + (v.elevation_gain_m * 0.0006)
    ev_cost_per_km = 0.09 + (v.payload_tons * 0.003) + (v.elevation_gain_m * 0.0001)
    annual_km = v.route_distance_km * 250  # Working days
    annual_savings = (diesel_cost_per_km - ev_cost_per_km) * annual_km
    ice_annual_cost = diesel_cost_per_km * annual_km
    tco_savings_pct = (annual_savings / ice_annual_cost) * 100 if ice_annual_cost > 0 else 0

    readiness_score = (
        (range_score * 0.35)
        + (charging_score * 0.25)
        + (payload_score * 0.20)
        + (infra_score * 0.10)
        + (elevation_score * 0.10)
    )

    return ReadinessResult(
        vehicle_id=v.vehicle_id,
        readiness_score=round(readiness_score, 2),
        range_feasibility=round(range_score, 2),
        charging_opportunity=round(charging_score, 2),
        payload_compatibility=round(payload_score, 2),
        infra_proximity=round(infra_score, 2),
        elevation_penalty=round(elevation_score, 2),
        tco_savings_pct=round(tco_savings_pct, 1),
        recommended_battery_kwh=round(recommended_battery_kwh, 2),
        recommended_chemistry=recommended_chemistry,
    )


def execute_get_fleet_health():
    return [v.model_dump() for v in apm_fleet_data.values()]


def execute_get_anomalies():
    return [v.model_dump() for v in apm_fleet_data.values() if v.is_anomaly]


def generate_maintenance_schedule() -> list:
    """Use the full constraint-based optimizer from Feature 3."""
    result = optimize_schedule()
    return [s.model_dump() for s in result.schedule]


def execute_get_maintenance_schedule():
    return generate_maintenance_schedule()


def execute_get_quality_intelligence():
    report = generate_quality_report()
    return report.model_dump()


def execute_get_carbon_report():
    report = generate_net_zero_report()
    return report.model_dump()


RSS_FEEDS = [
    "https://www.mining.com/feed/",
    "http://feeds.bbci.co.uk/news/world/rss.xml",
    "http://rss.cnn.com/rss/edition_world.rss",
    "https://www.cnbc.com/id/100727362/device/rss/rss.html",
    "http://feeds.feedburner.com/ndtvnews-world-news",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "https://news.google.com/rss",
    "http://feeds.washingtonpost.com/rss/world",
    "https://www.reddit.com/r/worldnews/.rss",
    "https://timesofindia.indiatimes.com/rssfeeds/296589292.cms",
    "https://www.theguardian.com/world/rss",
    "https://www.yahoo.com/news/rss",
]

def execute_live_news_risk_assessment() -> list:
    """Scrapes live RSS feeds from 12 sources and uses LLM to dynamically score risk.
    Cached for 5 minutes so repeated agent calls don't re-hit the feeds."""
    import json

    # ── 5-minute news cache ────────────────────────────────────────────────
    global _news_cache
    now = time.time()
    if _news_cache and (now - _news_cache["fetched_at"]) < 300:
        age = int(now - _news_cache["fetched_at"])
        print(f"[news cache] HIT ({age}s old, {len(_news_cache['entries'])} articles)")
        # Re-use cached data, but re-run the LLM portion with the current query
        all_entries = _news_cache["entries"]
        citations = _news_cache["citations"]
    else:
        print(f"Fetching live news from {len(RSS_FEEDS)} RSS feeds...")
        all_entries = []
        citations = []
        for url in RSS_FEEDS:
            try:
                feed = feedparser.parse(url)
                for entry in feed.entries[:3]:
                    title = entry.get("title", "").strip()
                    if title:
                        citations.append({
                            "title": title,
                            "url": entry.get("link", ""),
                            "source": url,
                            "published": entry.get("published", ""),
                        })
                all_entries.extend(feed.entries[:3])
                print(f"  OK: {url} ({len(feed.entries)} articles)")
            except Exception as e:
                print(f"  FAIL: {url} - {e}")
        _news_cache = {
            "entries": all_entries,
            "citations": citations,
            "fetched_at": now,
        }
        print(f"[news cache] MISS — populated with {len(citations)} articles")

    news_text = ""
    seen = set()
    for entry in all_entries:
        title = entry.get("title", "").strip()
        if title and title not in seen:
            seen.add(title)
            summary = entry.get("summary", "")[:200]
            news_text += f"- {title}. {summary}\n"

    print(f"Total unique headlines aggregated: {len(seen)}")

    if not news_text:
        baseline_nodes = [n.model_dump() for n in get_base_nodes_lazy()]
        for n in baseline_nodes:
            n["citations"] = []
        return baseline_nodes

    prompt = f"""
You are an EV Supply Chain Risk Analyst. Based STRICTLY on the following live news headlines from today,
assess the supply chain risk (1-10) for these specific regions: Chile (Lithium), DRC (Cobalt), Indonesia (Nickel), Australia (Spodumene/Lithium), China (Processing/Cathode/Cells), Belgium (Refining), USA (Manufacturing).
If a region is not mentioned in the news, assign a baseline risk of 4.0.
If there are strikes, export bans, conflicts, or trade restrictions, increase the risk. If there are new investments, trade deals, or smooth operations, decrease it.

LIVE NEWS:
{news_text}

Respond ONLY with a valid JSON object mapping the country name to a dictionary containing "risk_score" (float), "justification" (short string), and "citation_index" (integer — which headline number in the list above most directly supports this assessment, 1-indexed; use 0 if no specific headline applies).

Example format:
{{
    "Chile": {{"risk_score": 8.5, "justification": "Major lithium miner strike announced today.", "citation_index": 3}},
    "DRC": {{"risk_score": 4.0, "justification": "No major news today.", "citation_index": 0}}
}}
"""

    try:
        response = get_openai_client().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            timeout=30
        )
        raw_response = response.choices[0].message.content
        clean_json = raw_response.replace("```json", "").replace("```", "").strip()
        import re
        clean_json = re.sub(r"<think>.*?</think>", "", clean_json, flags=re.DOTALL).strip()
        risk_assessments = json.loads(clean_json)
    except json.JSONDecodeError as e:
        print(f"LLM News JSON parse failed: {e}")
        return [{"error": "News analysis failed", "message": "LLM returned malformed data."}]
    except Exception as e:
        print(f"Unexpected error during news analysis: {e}")
        return [{"error": "News analysis failed", "message": "Internal server error."}]

    final_nodes = []
    for node in get_base_nodes_lazy():
        assessment = risk_assessments.get(node.country, {
            "risk_score": 5.0,
            "justification": "News analysis inconclusive.",
            "citation_index": 0
        })
        # Attach citation chain: which news article drove this score
        cit_idx = int(assessment.get("citation_index", 0)) - 1  # convert to 0-indexed
        node_citations = []
        if 0 <= cit_idx < len(citations):
            node_citations = [citations[cit_idx]]
        elif cit_idx == -1:  # explicit "no specific headline"
            node_citations = []
        else:
            # Show first 2 citations as general context
            node_citations = citations[:2]

        final_nodes.append(SupplyNode(
            entity_name=node.entity_name,
            tier=node.tier,
            material=node.material,
            country=node.country,
            latitude=node.latitude,
            longitude=node.longitude,
            composite_risk=float(assessment.get("risk_score", 5.0)),
            risk_justification=assessment.get("justification", ""),
            esg_score=node.esg_score,
            lead_time_days=node.lead_time_days,
            criticality=node.criticality,
        ))

    # Return nodes with citations as a dict wrapper
    result = {
        "nodes": [n.model_dump() for n in final_nodes],
        "citations": citations[:20],  # Top 20 articles referenced
        "total_articles_analyzed": len(citations),
    }
    return result


@app.get("/api/fleet-readiness")
def get_fleet_readiness(depot_id: str = None):

    if depot_id:
        require_depot_access(depot_id, user)
        seed_value = sum(ord(c) for c in depot_id)
        random.seed(seed_value)
        num_vehicles = 15 + (seed_value % 15)
        local_fleet = []
        for i in range(1, num_vehicles + 1):
            local_fleet.append(
                IceVehicle(
                    vehicle_id=f"{depot_id}-ICE-{i:03d}",
                    route_distance_km=random.uniform(40.0, 300.0),
                    payload_tons=random.uniform(2.0, 40.0),
                    elevation_gain_m=random.uniform(10.0, 500.0),
                    dwell_time_hours=random.uniform(1.0, 12.0),
                    shift_length_hours=random.uniform(8.0, 16.0),
                )
            )
        results = [score_vehicle(v) for v in local_fleet]
    else:
        results = [score_vehicle(v) for v in fleet_data]
        
    results.sort(key=lambda x: x.readiness_score, reverse=True)
    return [
        {"estimated_capex_inr": int(r.recommended_battery_kwh * 15000), **r.model_dump()}
        for r in results
    ]


@app.get("/api/supply-chain")
def get_supply_chain_nodes(depot_id: str = None):
    """Feature 4: Returns supply chain nodes with live news risk scoring.
    Tries the full LLM news analysis pipeline first; falls back to baseline
    nodes with a clear 'baseline' marker if the LLM is unavailable."""
    try:
        result = execute_live_news_risk_assessment()
        if isinstance(result, dict) and "nodes" in result:
            nodes = result["nodes"]
        elif isinstance(result, list) and len(result) > 0 and isinstance(result[0], dict) and "error" in result[0]:
            raise RuntimeError(result[0].get("message", "News analysis failed"))
        else:
            nodes = result
    except Exception as e:
        baseline_nodes = [n.model_dump() for n in get_base_nodes_lazy()]
        for n in baseline_nodes:
            if n.get("risk_justification") == "Awaiting live news analysis...":
                n["risk_justification"] = (
                    f"Baseline 5.0/10. Live news analysis unavailable "
                    f"({str(e)[:60]}). Run APM Agent > 'Trace supply chain' for live data."
                )
        nodes = baseline_nodes

    if depot_id and isinstance(nodes, list):
        seed_value = sum(ord(c) for c in depot_id)
        random.seed(seed_value)
        # Deep copy to avoid mutating cache
        import copy
        nodes = copy.deepcopy(nodes)
        for node in nodes:
            node["composite_risk"] = round(max(1.0, min(10.0, node["composite_risk"] + random.uniform(-1.2, 1.2))), 1)
            node["lead_time_days"] = int(max(1, node["lead_time_days"] + random.randint(-4, 4)))

    return nodes


@app.get("/api/supply-chain/risk/{material}")
def get_supply_chain_risk(material: str):
    """Returns the composite risk score with full citation chain for a material."""
    db = get_db_connection()
    cursor = db.cursor()
    
    # 1. Get the main risk score
    cursor.execute("""
        SELECT overall_risk, level, last_updated
        FROM risk_scores
        WHERE material = ? COLLATE NOCASE
    """, (material,))
    risk_row = cursor.fetchone()
    
    if not risk_row:
        db.close()
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"No risk score found for {material}")
    
    response_data = {
        "material": material,
        "overall_risk": round(risk_row["overall_risk"], 1),
        "level": risk_row["level"],
        "last_updated": risk_row["last_updated"],
        "sub_scores": {}
    }
    
    WEIGHTS = {
        "geopolitical": 0.40,
        "regulatory": 0.25,
        "operational": 0.20,
        "environmental": 0.15
    }
    
    # 2. Get the citations and build sub-scores
    cursor.execute("""
        SELECT c.risk_type, a.id, a.title, a.source, a.url, a.published_date, a.sentiment,
               m.relevance_score, m.extracted_claims
        FROM risk_citations c
        JOIN news_articles a ON c.article_id = a.id
        JOIN article_risk_mapping m ON a.id = m.article_id AND m.material = ? COLLATE NOCASE AND m.risk_type = c.risk_type
        WHERE c.risk_score_id = (SELECT id FROM risk_scores WHERE material = ? COLLATE NOCASE)
    """, (material, material))
    
    citation_rows = cursor.fetchall()
    db.close()
    
    # Group by risk_type
    grouped_citations = {rt: [] for rt in WEIGHTS}
    for row in citation_rows:
        rt = row["risk_type"].lower()
        if rt in grouped_citations:
            claims = []
            if row["extracted_claims"]:
                try:
                    claims = json.loads(row["extracted_claims"])
                except:
                    pass
            
            grouped_citations[rt].append({
                "id": row["id"],
                "title": row["title"],
                "source": row["source"],
                "url": row["url"],
                "published_date": row["published_date"],
                "relevance_score": round(row["relevance_score"], 2),
                "sentiment": row["sentiment"],
                "extracted_claims": claims
            })
            
    # Assemble final sub_scores (mocking the sub-score value calculation since it wasn't saved separately)
    # We can recalculate or just assign a flat 50 base + modifiers like in ingestion.
    REALISTIC_DEFAULTS = {
        "cobalt": {"geopolitical": 85.0, "regulatory": 62.0, "operational": 71.0, "environmental": 88.0},
        "lithium": {"geopolitical": 55.0, "regulatory": 68.0, "operational": 64.0, "environmental": 59.0},
        "nickel": {"geopolitical": 72.0, "regulatory": 58.0, "operational": 65.0, "environmental": 70.0},
        "spodumene": {"geopolitical": 28.0, "regulatory": 35.0, "operational": 45.0, "environmental": 40.0},
        "graphite": {"geopolitical": 64.0, "regulatory": 55.0, "operational": 56.0, "environmental": 58.0}
    }
    
    mat_key = material.lower()
    defaults = REALISTIC_DEFAULTS.get(mat_key, {
        "geopolitical": 50.0,
        "regulatory": 50.0,
        "operational": 50.0,
        "environmental": 50.0
    })

    for rt, weight in WEIGHTS.items():
        base_score = defaults.get(rt, 50.0)
        for cit in grouped_citations[rt]:
            impact = cit["relevance_score"] * 10
            if cit["sentiment"] == "negative":
                base_score = min(100.0, base_score + impact)
            elif cit["sentiment"] == "positive":
                base_score = max(0.0, base_score - impact)
        
        response_data["sub_scores"][rt] = {
            "score": round(base_score, 1),
            "weight": weight,
            "weighted_contribution": round(base_score * weight, 1),
            "citations": grouped_citations[rt]
        }
        
    return response_data


@app.get("/api/maintenance-schedule")
def get_maintenance_schedule_endpoint(depot_id: str = None):
    """Feature 3: Full optimized maintenance schedule with KPIs and constraints."""
    result = optimize_schedule()

    if depot_id:
        require_depot_access(depot_id, user)
        seed_value = sum(ord(c) for c in depot_id)
        random.seed(seed_value)
        data = result.model_dump()
        for task in data["schedule"]:
            try:
                num = int(task["vehicle_id"].split("-")[1])
            except Exception:
                num = 1
            task["vehicle_id"] = f"{depot_id}-V{num:03d}"
            
        data["kpis"]["total_tasks"] = 5 + (seed_value % 8)
        data["kpis"]["scheduled_tasks"] = min(data["kpis"]["total_tasks"], 4 + (seed_value % 6))
        data["kpis"]["overflow_tasks"] = max(0, data["kpis"]["total_tasks"] - data["kpis"]["scheduled_tasks"])
        data["kpis"]["total_cost_inr"] = int(100000 + (seed_value % 15) * 50000)
        data["kpis"]["bay_utilization_pct"] = [
            min(100, 30 + (seed_value * (i+1)) % 70)
            for i in range(4)
        ]
        return data
    return result.model_dump()


QUALITY_SNAPSHOT_CACHE = {}


@app.get("/api/quality-intelligence")
def get_quality_intelligence_endpoint(depot_id: str = None):
    """Feature 5: Manufacturing Quality Intelligence with drift detection and defect prediction."""
    report = generate_quality_report()

    if depot_id:
        require_depot_access(depot_id, user)
        seed_value = sum(ord(c) for c in depot_id)
        random.seed(seed_value)
        data = report.model_dump()
        data["kpis"]["overall_yield_pct"] = round(90.0 + (seed_value % 95) / 10.0, 2)
        data["kpis"]["first_pass_yield_pct"] = round(data["kpis"]["overall_yield_pct"] - random.uniform(1.0, 3.0), 2)
        data["kpis"]["defect_rate_ppm"] = int(100 + (seed_value % 45) * 10)
        data["kpis"]["drift_alerts_active"] = seed_value % 3
        for p in data["process_parameters"]:
            p["current_value"] = round(p["target_value"] + random.uniform(-1.5, 1.5) * (p["ucl"] - p["target_value"]), 2)
            p["drift_detected"] = p["current_value"] > p["ucl"] or p["current_value"] < p["lcl"]
            if p["drift_detected"]:
                p["drift_severity"] = "critical" if random.choice([True, False]) else "warning"
            else:
                p["drift_severity"] = "normal"
        report_data = data
    else:
        report_data = report.model_dump()

    # Cache process parameters for batch explanations
    snapshot = {}
    name_to_key = {
        "Coating Thickness": "coating_thickness_um",
        "Drying Temperature": "drying_temp_c",
        "Drying Time": "drying_time_s",
        "Calendering Pressure": "calendering_pressure_mpa",
        "Electrolyte Volume": "electrolyte_fill_volume_ml",
        "Formation Cycle Count": "formation_cycle_count",
        "Ambient Humidity": "ambient_humidity_pct",
        "Slurry Viscosity": "slurry_viscosity_cps",
        "Electrode Density": "electrode_density_g_cc",
        "Tab Welding Power": "tab_welding_power_w"
    }
    for p in report_data.get("process_parameters", []):
        key = name_to_key.get(p["parameter_name"])
        if key:
            snapshot[key] = p["current_value"]

    for pred in report_data.get("defect_predictions", []):
        bid = pred["batch_id"].lower()
        QUALITY_SNAPSHOT_CACHE[bid] = snapshot

    return report_data


@app.get("/api/quality/drift/{batch_id}/explanation")
def get_quality_drift_explanation(batch_id: str):
    """Returns SHAP explainability factors for a process drift on a specific batch."""
    bid = batch_id.lower()
    if bid in QUALITY_SNAPSHOT_CACHE:
        snapshot = QUALITY_SNAPSHOT_CACHE[bid]
    else:
        from shap_service import get_mock_snapshot
        snapshot = get_mock_snapshot()
        
    from shap_service import get_or_create_explanation
    explanation = get_or_create_explanation(batch_id, snapshot)
    return explanation


@app.get("/api/carbon-tracker")
def get_carbon_tracker_endpoint(depot_id: str = None):
    """Feature 6: Net Zero Progress & Carbon Intelligence Tracker."""
    report = generate_net_zero_report()

    if depot_id:
        require_depot_access(depot_id, user)
        seed_value = sum(ord(c) for c in depot_id)
        random.seed(seed_value)
        data = report.model_dump()
        scale = 0.5 + (seed_value % 10) / 10.0
        data["kpis"]["total_emissions_tons_co2"] = round(data["kpis"]["total_emissions_tons_co2"] * scale, 1)
        data["kpis"]["scope_1_tons"] = round(data["kpis"]["scope_1_tons"] * scale, 1)
        data["kpis"]["scope_2_tons"] = round(data["kpis"]["scope_2_tons"] * scale, 1)
        data["kpis"]["scope_3_tons"] = round(data["kpis"]["scope_3_tons"] * scale, 1)
        data["kpis"]["ev_fleet_pct"] = round(40.0 + (seed_value % 50), 1)
        for vehicle in data["fleet_comparison"]:
            try:
                num = int(vehicle["vehicle_id"].split("-")[1])
            except Exception:
                num = 1
            vehicle["vehicle_id"] = f"{depot_id}-V{num:03d}"
        return data
    return report.model_dump()


# ─── Trust & Explainability Endpoints ────────────────────────────────────────

@app.get("/api/shap/cpk")
def get_shap_for_cpk():
    """SHAP-style per-parameter contribution to overall Cpk score."""
    params = generate_process_data()
    return shap_for_cpk(params)


@app.get("/api/forecast/thermal/{vehicle_id}")
def get_thermal_forecast(vehicle_id: str):
    """7-day thermal anomaly forecast using rolling Z-score (Isolation Forest equivalent)."""
    telemetry = generate_ev_telemetry(vehicle_id, days=120)
    days_data = [t.model_dump() for t in telemetry]
    return forecast_thermal_anomalies(days_data)


@app.get("/api/forecast/rul/{vehicle_id}")
def get_rul_forecast(vehicle_id: str):
    """365-day SoH curve with confidence band for one vehicle."""
    fleet = generate_fleet_telemetry()
    health = fleet.get(vehicle_id)
    if not health:
        return {"error": f"Vehicle {vehicle_id} not found"}
    return forecast_soh_curve(health.current_soh, health.degradation_rate_per_day)


@app.post("/api/maintenance/cost-prediction/{vehicle_id}")
def get_cost_prediction(vehicle_id: str):
    """Compare replace-now vs replace-in-6-months cost scenarios."""
    fleet = generate_fleet_telemetry()
    health = fleet.get(vehicle_id)
    if not health:
        return {"error": f"Vehicle {vehicle_id} not found"}
    cost = estimate_battery_cost_inr(100, health.chemistry)["total_battery_cost_inr"]
    return predict_replacement_cost(vehicle_id, health.current_soh, health.degradation_rate_per_day, cost)


# ─── What-If Carbon Simulator ───────────────────────────────────────────────

class WhatIfRequest(BaseModel):
    ev_penetration_pct: float
    renewable_energy_pct: float
    scope_3_reduction_pct: float

@app.post("/api/carbon/simulate")
def post_carbon_simulate(req: WhatIfRequest):
    """Simulate 'what if' changes to EV penetration, renewables, and Scope 3."""
    report = generate_net_zero_report()
    return simulate_carbon_scenario(
        report.kpis.model_dump(),
        req.ev_penetration_pct,
        req.renewable_energy_pct,
        req.scope_3_reduction_pct,
    )


# ─── Commodity Feed Endpoints ────────────────────────────────────────────────

@app.get("/api/commodities")
def get_commodities():
    """Live BSE/MCX commodity prices for battery materials."""
    return {"prices": [p.model_dump() for p in get_all_prices()], "count": len(get_all_prices())}


@app.get("/api/commodities/battery-cost")
def get_battery_cost_endpoint(kwh: float = 100, chemistry: str = "NMC 811"):
    """Live battery cost in INR based on current commodity prices."""
    return estimate_battery_cost_inr(kwh, chemistry)


# ─── Operations Endpoints ───────────────────────────────────────────────────

@app.get("/api/depots/compare")
def api_get_depots_compare(region: str = None):
    return get_depot_comparison(region)

@app.get("/api/depots/compare/heatmap")
def api_get_depots_heatmap(metric: str = "availability"):
    depots = get_all_depots()
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    matrix = []
    for d in depots:
        for day in days:
            val = 70 + (sum(ord(c) for c in d.id) + len(day)) % 30
            matrix.append({
                "depot_id": d.id,
                "depot_name": d.name,
                "day": day,
                "value": round(val, 1)
            })
    return {"matrix": matrix}

@app.get("/api/depots/{depot_id}/summary")
def api_get_depot_summary(depot_id: str):
    require_depot_access(depot_id, user)
    depot = get_depot_by_id(depot_id)
    if not depot:
        return {"error": "Depot not found"}
    seed = sum(ord(c) for c in depot.id)
    kpis = {
        "avg_soh": round(80 + (seed % 20) / 10.0, 1),
        "availability": 70 + (seed % 25),
        "rul": 100 + (seed % 50),
        "alert_count": seed % 3
    }
    top_alerts = [
        {"id": "A1", "message": f"Critical degradation detected on {depot.id}-V001", "severity": "high"}
    ] if kpis["alert_count"] > 0 else []
    recent_maintenance = [
        {"id": "M1", "vehicle_id": f"{depot.id}-V002", "task": "Coolant Flush", "status": "completed"}
    ]
    return {
        "depot": depot.model_dump(),
        "kpis": kpis,
        "top_alerts": top_alerts,
        "recent_maintenance": recent_maintenance
    }

@app.get("/api/depots")
def api_get_depots():
    return {"depots": [d.model_dump() for d in get_all_depots()]}

@app.get("/api/depots/{depot_id}")
def get_depot_endpoint(depot_id: str):
    """Single depot details."""
    require_depot_access(depot_id, user)
    d = get_depot_by_id(depot_id)
    if not d:
        return {"error": "Depot not found"}
    return d.model_dump()


class RoleCheckRequest(BaseModel):
    role: str
    action: str

@app.post("/api/permissions/check")
def check_permission(req: RoleCheckRequest):
    """Check if a role has permission to perform an action."""
    return {
        "role": req.role,
        "action": req.action,
        "allowed": can(req.role, req.action),
        "all_permissions": get_role_permissions(req.role),
    }


@app.get("/api/audit-log")
def get_audit_log_endpoint(role: str = "admin", limit: int = 50):
    """Recent audit log entries. Role-gated."""
    return {
        "role": role,
        "can_view": can(role, "view_audit_log"),
        "entries": [e.model_dump() for e in get_audit_log(role, limit)],
    }


@app.get("/api/audit-log/export")
def export_audit_log_endpoint(role: str = "admin"):
    """Export audit log as a printable HTML page (can be saved as PDF via browser)."""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=export_audit_log_html(role))


# ─── Approval Workflow Endpoints ─────────────────────────────────────────────

class ApprovalDecisionRequest(BaseModel):
    approved: bool
    decided_by: str
    role: str
    reason: str = ""

class MaintenanceSubmitRequest(BaseModel):
    task_id: str
    vehicle_id: str
    task_type: str
    cost_inr: float
    reason: str
    requested_by: str = "system"

@app.post("/api/maintenance/submit-for-approval")
def submit_maintenance_approval(req: MaintenanceSubmitRequest):
    """Submit a maintenance task for approval. Auto-approves if cost < threshold."""
    approval = submit_for_approval(req.task_id, req.vehicle_id, req.task_type,
                                    req.cost_inr, req.reason, req.requested_by)
    return {
        "approval": approval.model_dump(),
        "auto_approved": approval.approved_by == "auto_threshold",
        "threshold_inr": APPROVAL_THRESHOLD_INR,
    }


@app.get("/api/maintenance/pending-approvals")
def get_pending_approvals_endpoint(role: str = "maintenance"):
    """Pending maintenance approvals. Role-gated."""
    if not can(role, "view_maintenance"):
        return {"error": "Access denied"}
    return {
        "pending": [a.model_dump() for a in get_pending_approvals()],
        "threshold_inr": APPROVAL_THRESHOLD_INR,
    }


@app.post("/api/maintenance/decide-approval/{request_id}")
def decide_approval_endpoint(request_id: str, req: ApprovalDecisionRequest):
    """Approve or reject a pending maintenance task."""
    result = decide_approval(request_id, req.approved, req.decided_by, req.role, req.reason)
    if not result:
        return {"error": "Request not found or access denied"}
    return result.model_dump()


TOOL_KEYWORD_MAP = {
    "health": "get_fleet_health",
    "soh": "get_fleet_health",
    "battery": "get_fleet_health",
    "rul": "get_fleet_health",
    "degradation": "get_fleet_health",
    "anomal": "get_anomalies",
    "thermal": "get_anomalies",
    "flag": "get_anomalies",
    "maintenance": "get_maintenance_schedule",
    "schedule": "get_maintenance_schedule",
    "repair": "get_maintenance_schedule",
    "supply": "get_supply_chain_trace",
    "trace": "get_supply_chain_trace",
    "chain": "get_supply_chain_trace",
    "risk": "get_supply_chain_trace",
    "supplier": "get_supply_chain_trace",
    "quality": "get_quality_intelligence",
    "qms": "get_quality_intelligence",
    "defect": "get_quality_intelligence",
    "drift": "get_quality_intelligence",
    "spc": "get_quality_intelligence",
    "inspection": "get_quality_intelligence",
    "manufacturing": "get_quality_intelligence",
    "yield": "get_quality_intelligence",
    "carbon": "get_carbon_report",
    "emission": "get_carbon_report",
    "net zero": "get_carbon_report",
    "sustainability": "get_carbon_report",
    "co2": "get_carbon_report",
    "scope": "get_carbon_report",
    "climate": "get_carbon_report",
    "green": "get_carbon_report",
}

TOOL_EXECUTORS = {
    "get_fleet_health": execute_get_fleet_health,
    "get_anomalies": execute_get_anomalies,
    "get_maintenance_schedule": execute_get_maintenance_schedule,
    "get_supply_chain_trace": execute_live_news_risk_assessment,
    "get_quality_intelligence": execute_get_quality_intelligence,
    "get_carbon_report": execute_get_carbon_report,
}

# Human-readable labels for each tool - shown when the LLM uses a tool
TOOL_HUMAN_PHRASES = {
    "get_fleet_health": "Pulling fleet health data...",
    "get_anomalies": "Checking for thermal anomalies...",
    "get_maintenance_schedule": "Loading maintenance schedule...",
    "get_supply_chain_trace": "Tracing supply chain with live news...",
    "get_quality_intelligence": "Analyzing manufacturing quality...",
    "get_carbon_report": "Compiling carbon emissions report...",
}


def _fallback_tool(query_text: str) -> str | None:
    q = query_text.lower()
    for keyword, tool_name in TOOL_KEYWORD_MAP.items():
        if keyword in q:
            return tool_name
    return None


@app.post("/api/apm-agent")
def apm_agent(query: AgentQuery):
    function_name = None

    system_prompt = """You are a strict data-routing function. You have NO personality.
DO NOT act human. DO NOT generate data, vehicle stats, or analysis.
Your ONLY job is to read the user's input and select the most relevant tool to fetch the actual data.
Do not add conversational filler."""

    # Step 1: LLM picks the right tool (forced — even "hi" must trigger a tool)
    try:
        response = get_openai_client().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query.query}
            ],
            tools=tools,
            tool_choice="required",
            timeout=15
        )
        message = response.choices[0].message
        if message.tool_calls:
            tool_call = message.tool_calls[0]
            function_name = tool_call.function.name

            # Map tool names to clean, non-robotic UI text
            display_text = {
                "get_fleet_health": "Retrieving fleet battery health and degradation metrics...",
                "get_anomalies": "Filtering for thermal anomalies and critical alerts...",
                "get_maintenance_schedule": "Calculating optimized maintenance schedule...",
                "get_supply_chain_trace": "Fetching live supply chain risk and geospatial data...",
                "get_quality_intelligence": "Running EWMA/CUSUM drift analysis on manufacturing data...",
                "get_carbon_report": "Aggregating Scope 1, 2, and 3 carbon emissions..."
            }.get(function_name, f"Executing {function_name}...")

            if function_name in TOOL_EXECUTORS:
                try:
                    data_result = TOOL_EXECUTORS[function_name]()
                except Exception as e:
                    return {
                        "agent_thought_process": f"Could not complete the request: {str(e)}",
                        "results": []
                    }
            else:
                data_result = []

            if isinstance(data_result, list) and len(data_result) > 0 and isinstance(data_result[0], dict) and "error" in data_result[0]:
                return {
                    "agent_thought_process": data_result[0].get("message", "Failed to fetch data."),
                    "routing_confidence": estimate_routing_confidence(query.query, function_name),
                    "results": []
                }

            return {
                "agent_thought_process": display_text,
                "routing_confidence": estimate_routing_confidence(query.query, function_name),
                "results": data_result
            }
    except Exception:
        pass

    # Fallback: keyword matching if LLM is unavailable
    if not function_name:
        function_name = _fallback_tool(query.query)

    if not function_name or function_name not in TOOL_EXECUTORS:
        return {
            "agent_thought_process": "Not sure what you're looking for. Try: 'Show fleet health', 'Check for thermal anomalies', 'Generate maintenance schedule', or 'Trace supply chain'.",
            "results": []
        }

    # Execute the fallback-selected tool
    try:
        data_result = TOOL_EXECUTORS[function_name]()
    except Exception as e:
        return {
            "agent_thought_process": f"Could not complete the request: {str(e)}",
            "results": []
        }

    if isinstance(data_result, list) and len(data_result) > 0 and isinstance(data_result[0], dict) and "error" in data_result[0]:
        return {
            "agent_thought_process": data_result[0].get("message", "Failed to fetch data."),
            "routing_confidence": estimate_routing_confidence(query.query, function_name),
            "results": []
        }

    display_text = {
        "get_fleet_health": "Retrieving fleet battery health and degradation metrics...",
        "get_anomalies": "Filtering for thermal anomalies and critical alerts...",
        "get_maintenance_schedule": "Calculating optimized maintenance schedule...",
        "get_supply_chain_trace": "Fetching live supply chain risk and geospatial data...",
        "get_quality_intelligence": "Running EWMA/CUSUM drift analysis on manufacturing data...",
        "get_carbon_report": "Aggregating Scope 1, 2, and 3 carbon emissions..."
    }.get(function_name, f"Executing {function_name}...")

    return {
        "agent_thought_process": display_text,
        "routing_confidence": estimate_routing_confidence(query.query, function_name),
        "results": data_result
    }


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:5173"),
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from commodity_feed import calculate_capex

@app.get("/api/commodity/prices")
def api_get_commodity_prices():
    return get_all_prices()

@app.get("/api/commodity/capex-impact")
def api_get_capex_impact(vehicle_type: str = "electric_truck_5t"):
    return calculate_capex(vehicle_type)

from shap_service import get_or_create_explanation, get_shap_waterfall_data, get_mock_snapshot, NORMAL_RANGES

def get_dynamic_snapshot():
    params = generate_process_data()
    name_to_key = {
        "Coating Thickness": "coating_thickness_um",
        "Drying Temperature": "drying_temp_c",
        "Drying Time": "drying_time_s",
        "Calendering Pressure": "calendering_pressure_mpa",
        "Electrolyte Volume": "electrolyte_fill_volume_ml",
        "Formation Cycle Count": "formation_cycle_count",
        "Ambient Humidity": "ambient_humidity_pct",
        "Slurry Viscosity": "slurry_viscosity_cps",
        "Electrode Density": "electrode_density_g_cc",
        "Tab Welding Power": "tab_welding_power_w"
    }
    snapshot = {}
    for p in params:
        key = name_to_key.get(p.parameter_name)
        if key:
            snapshot[key] = p.current_value
            
    for key, range_val in NORMAL_RANGES.items():
        if key not in snapshot:
            snapshot[key] = (range_val[0] + range_val[1]) / 2.0
            
    return snapshot

@app.get("/api/quality/drift/{batch_id}/shap-waterfall")
def api_get_shap_waterfall(batch_id: str):
    bid = batch_id.lower()
    if bid in QUALITY_SNAPSHOT_CACHE:
        snapshot = QUALITY_SNAPSHOT_CACHE[bid]
    else:
        snapshot = get_dynamic_snapshot()
    return get_shap_waterfall_data(batch_id, snapshot)




@app.get("/")
def root():
    return {
        "platform": "EV Supply Chain & Asset Intelligence",
        "status": "running",
        "features": {
            "1": "Fleet Electrification Readiness & Procurement Intelligence",
            "2": "EV Asset Performance Management (APM) Agent",
            "3": "Maintenance Operations Optimiser",
            "4": "EV Supply Chain Risk & Traceability Agent",
            "5": "Manufacturing Quality Intelligence (QMS Integration)",
            "6": "Net Zero Progress & Carbon Intelligence Tracker",
        },
        "endpoints": [
            "/api/fleet-readiness",
            "/api/maintenance-schedule",
            "/api/quality-intelligence",
            "/api/carbon-tracker",
            "/api/apm-agent",
        ],
    }
