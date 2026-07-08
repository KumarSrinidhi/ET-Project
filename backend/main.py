from typing import List
import json

from fastapi import FastAPI
from pydantic import BaseModel
import random
from fastapi.middleware.cors import CORSMiddleware
from apm_models import generate_fleet_telemetry, BatteryHealthReport
from openai import OpenAI


app = FastAPI()

client = OpenAI()

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
    recommended_battery_kwh: float


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


def execute_get_fleet_health():
    return [v.model_dump() for v in apm_fleet_data.values()]


def execute_get_anomalies():
    return [v.model_dump() for v in apm_fleet_data.values() if v.is_anomaly]


def generate_maintenance_schedule() -> list:
    tasks = []
    for v in apm_fleet_data.values():
        if v.is_anomaly:
            tasks.append(MaintenanceTask(vehicle_id=v.vehicle_id, reason="Thermal Anomaly Deep-Dive", duration_hours=8.0))
        elif v.current_soh < 85.0:
            tasks.append(MaintenanceTask(vehicle_id=v.vehicle_id, reason="SoH Inspection / Battery Swap", duration_hours=4.0))

    tasks.sort(key=lambda x: x.duration_hours, reverse=True)

    bays = {1: 0, 2: 0, 3: 0}
    schedule = []

    for task in tasks:
        for bay_num, current_hour in bays.items():
            if current_hour + task.duration_hours <= 16:
                schedule.append(ScheduledTask(
                    vehicle_id=task.vehicle_id,
                    reason=task.reason,
                    bay_number=bay_num,
                    start_hour=current_hour
                ))
                bays[bay_num] += task.duration_hours
                break

    return [s.model_dump() for s in schedule]


def execute_get_maintenance_schedule():
    return generate_maintenance_schedule()


@app.get("/api/fleet-readiness", response_model=List[ReadinessResult])
def get_fleet_readiness():
    results = [score_vehicle(v) for v in fleet_data]
    results.sort(key=lambda x: x.readiness_score, reverse=True)
    return results


@app.post("/api/apm-agent")
def apm_agent(query: AgentQuery):
    response = client.chat.completions.create(
        model="qwen/qwen3-32b",
        messages=[{"role": "user", "content": query.query}],
        tools=tools,
        tool_choice="auto"
    )

    message = response.choices[0].message

    if message.tool_calls:
        tool_call = message.tool_calls[0]
        function_name = tool_call.function.name

        if function_name == "get_fleet_health":
            data_result = execute_get_fleet_health()
        elif function_name == "get_anomalies":
            data_result = execute_get_anomalies()
        elif function_name == "get_maintenance_schedule":
            data_result = execute_get_maintenance_schedule()
        else:
            data_result = []

        return {
            "agent_thought_process": f"LLM decided to use tool: {function_name}",
            "results": data_result
        }
    else:
        return {
            "agent_thought_process": message.content,
            "results": []
        }


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
