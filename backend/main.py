from typing import List
import json
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend/ directory
load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI
from pydantic import BaseModel
import random
from fastapi.middleware.cors import CORSMiddleware
from apm_models import generate_fleet_telemetry, BatteryHealthReport
from openai import OpenAI
import httpx
import feedparser
from supply_chain import BASE_NODES, SupplyNode
from maintenance_optimizer import optimize_schedule, OptimizedSchedule
from quality_intelligence import generate_quality_report, QualityIntelligenceReport
from carbon_tracker import generate_net_zero_report, NetZeroReport


app = FastAPI()

client = None

def get_openai_client():
    global client
    if client is None:
        client = OpenAI(http_client=httpx.Client(verify=False))
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

    # TCO savings estimate (simplified)
    diesel_cost_per_km = 0.45  # USD
    ev_cost_per_km = 0.12  # USD (electricity + maintenance savings)
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
    """Scrapes live RSS feeds from 12 sources and uses LLM to dynamically score risk."""
    import json

    print(f"Fetching live news from {len(RSS_FEEDS)} RSS feeds...")
    all_entries = []
    for url in RSS_FEEDS:
        try:
            feed = feedparser.parse(url)
            all_entries.extend(feed.entries[:3])  # 3 articles per source = ~36 total
            print(f"  OK: {url} ({len(feed.entries)} articles)")
        except Exception as e:
            print(f"  FAIL: {url} - {e}")

    news_text = ""
    seen = set()
    for entry in all_entries:
        title = entry.get("title", "").strip()
        if title and title not in seen:
            seen.add(title)
            summary = entry.get("summary", "")[:200]  # Cap summary length
            news_text += f"- {title}. {summary}\n"

    print(f"Total unique headlines aggregated: {len(seen)}")

    if not news_text:
        return [n.model_dump() for n in BASE_NODES]

    prompt = f"""
You are an EV Supply Chain Risk Analyst. Based STRICTLY on the following live news headlines from today,
assess the supply chain risk (1-10) for these specific regions: Chile (Lithium), DRC (Cobalt), Indonesia (Nickel), Australia (Spodumene/Lithium), China (Processing/Cathode/Cells), Belgium (Refining), USA (Manufacturing).
If a region is not mentioned in the news, assign a baseline risk of 4.0.
If there are strikes, export bans, conflicts, or trade restrictions, increase the risk. If there are new investments, trade deals, or smooth operations, decrease it.

LIVE NEWS:
{news_text}

Respond ONLY with a valid JSON object mapping the country name to a dictionary containing "risk_score" (float) and "justification" (short string).
Example format:
{{
    "Chile": {{"risk_score": 8.5, "justification": "Major lithium miner strike announced today."}},
    "DRC": {{"risk_score": 4.0, "justification": "No major news today."}}
}}
"""

    try:
        response = get_openai_client().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )
        raw_response = response.choices[0].message.content
        clean_json = raw_response.replace("```json", "").replace("```", "").strip()
        # Strip any <think>...</think> blocks from reasoning models
        import re
        clean_json = re.sub(r"<think>.*?</think>", "", clean_json, flags=re.DOTALL).strip()
        risk_assessments = json.loads(clean_json)
    except Exception as e:
        print(f"LLM News analysis failed: {e}")
        risk_assessments = {}

    final_nodes = []
    for node in BASE_NODES:
        assessment = risk_assessments.get(node.country, {"risk_score": 5.0, "justification": "News analysis inconclusive."})
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

    return [n.model_dump() for n in final_nodes]


@app.get("/api/fleet-readiness", response_model=List[ReadinessResult])
def get_fleet_readiness():
    results = [score_vehicle(v) for v in fleet_data]
    results.sort(key=lambda x: x.readiness_score, reverse=True)
    return results


@app.get("/api/supply-chain")
def get_supply_chain_nodes():
    """Feature 4: Returns supply chain nodes with baseline risk (no LLM needed)."""
    return [n.model_dump() for n in BASE_NODES]


@app.get("/api/maintenance-schedule")
def get_maintenance_schedule_endpoint():
    """Feature 3: Full optimized maintenance schedule with KPIs and constraints."""
    result = optimize_schedule()
    return result.model_dump()


@app.get("/api/quality-intelligence")
def get_quality_intelligence_endpoint():
    """Feature 5: Manufacturing Quality Intelligence with drift detection and defect prediction."""
    report = generate_quality_report()
    return report.model_dump()


@app.get("/api/carbon-tracker")
def get_carbon_tracker_endpoint():
    """Feature 6: Net Zero Progress & Carbon Intelligence Tracker."""
    report = generate_net_zero_report()
    return report.model_dump()


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


def _fallback_tool(query_text: str) -> str | None:
    q = query_text.lower()
    for keyword, tool_name in TOOL_KEYWORD_MAP.items():
        if keyword in q:
            return tool_name
    return None


@app.post("/api/apm-agent")
def apm_agent(query: AgentQuery):
    function_name = None

    # Try LLM tool selection first
    try:
        response = get_openai_client().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are an EV fleet management and supply chain intelligence assistant. Use the provided tools to answer queries about fleet health, anomalies, maintenance schedules, supply chain tracing, manufacturing quality (QMS/defects/drift), and carbon emissions (net zero/sustainability). Always use a tool. Pick the most relevant tool based on the user's query."},
                {"role": "user", "content": query.query}
            ],
            tools=tools,
            tool_choice="auto"
        )
        message = response.choices[0].message
        if message.tool_calls:
            function_name = message.tool_calls[0].function.name
    except Exception:
        pass

    # Fallback: keyword matching if LLM failed or didn't pick a tool
    if not function_name:
        function_name = _fallback_tool(query.query)

    if function_name and function_name in TOOL_EXECUTORS:
        try:
            data_result = TOOL_EXECUTORS[function_name]()
        except Exception as e:
            return {
                "agent_thought_process": f"Tool {function_name} failed: {str(e)}",
                "results": []
            }
        return {
            "agent_thought_process": f"LLM decided to use tool: {function_name}",
            "results": data_result
        }

    return {
        "agent_thought_process": "Could not determine which tool to use. Try: 'Show fleet health', 'Show anomalies', 'Generate maintenance schedule', or 'Trace supply chain'.",
        "results": []
    }


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
