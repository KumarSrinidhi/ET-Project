from typing import List

from fastapi import FastAPI
from pydantic import BaseModel
import random
from fastapi.middleware.cors import CORSMiddleware
from apm_models import generate_fleet_telemetry, BatteryHealthReport


app = FastAPI()


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
    recommended_battery_kwh: float


class AgentQuery(BaseModel):
    query: str


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
    required_range = v.route_distance_km * 1.5 * 1.2
    if required_range <= 300:
        range_score = 100.0
    else:
        range_score = max(0.0, 100.0 - ((required_range - 300.0) / 2.0))

    recommended_battery_kwh = required_range

    time_to_charge = recommended_battery_kwh / 50.0
    if v.dwell_time_hours >= time_to_charge:
        charging_score = 100.0
    else:
        charging_score = max(0.0, (v.dwell_time_hours / time_to_charge) * 100.0)

    max_allowable_payload = 44.0 - (15.0 + (recommended_battery_kwh * 0.006))
    if v.payload_tons <= max_allowable_payload:
        payload_score = 100.0
    else:
        payload_score = 0.0

    infra_score = 85.0

    readiness_score = (
        (range_score * 0.4)
        + (charging_score * 0.3)
        + (payload_score * 0.2)
        + (infra_score * 0.1)
    )

    return ReadinessResult(
        vehicle_id=v.vehicle_id,
        readiness_score=round(readiness_score, 2),
        range_feasibility=round(range_score, 2),
        charging_opportunity=round(charging_score, 2),
        payload_compatibility=round(payload_score, 2),
        infra_proximity=round(infra_score, 2),
        recommended_battery_kwh=round(recommended_battery_kwh, 2),
    )


def tool_get_fleet_health() -> list:
    """Agent Tool: Returns health of all vehicles."""
    return list(apm_fleet_data.values())


def tool_get_anomalies() -> list:
    """Agent Tool: Returns ONLY vehicles with detected thermal anomalies."""
    return [v for v in apm_fleet_data.values() if v.is_anomaly]


@app.get("/api/fleet-readiness", response_model=List[ReadinessResult])
def get_fleet_readiness():
    results = [score_vehicle(v) for v in fleet_data]
    results.sort(key=lambda x: x.readiness_score, reverse=True)
    return results


@app.post("/api/apm-agent")
def apm_agent(query: AgentQuery):
    user_query = query.query.lower()
    agent_thought = ""
    data_result = []
    
    # Simple keyword-based agent routing (simulating LLM tool calling)
    if "anomaly" in user_query or "thermal" in user_query or "danger" in user_query:
        agent_thought = "User asked about anomalies. Using tool: tool_get_anomalies."
        data_result = tool_get_anomalies()
    elif "replacement" in user_query or "soonest" in user_query or "lowest soh" in user_query:
        agent_thought = "User asked for replacement priorities. Using tool: tool_get_fleet_health, sorting by SoH."
        all_health = tool_get_fleet_health()
        data_result = sorted(all_health, key=lambda x: x.current_soh)
    else:
        agent_thought = "General fleet health query. Using tool: tool_get_fleet_health."
        data_result = tool_get_fleet_health()
        
    return {
        "agent_thought_process": agent_thought,
        "results": data_result
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
