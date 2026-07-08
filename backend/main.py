from typing import List

from fastapi import FastAPI
from pydantic import BaseModel
import random
from fastapi.middleware.cors import CORSMiddleware


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


@app.get("/api/fleet-readiness", response_model=List[ReadinessResult])
def get_fleet_readiness():
    results = [score_vehicle(v) for v in fleet_data]
    results.sort(key=lambda x: x.readiness_score, reverse=True)
    return results


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/fleet-readiness", response_model=List[ReadinessResult])
def get_fleet_readiness():
    results = [score_vehicle(v) for v in fleet_data]
    # Sort results descending by readiness_score
    results.sort(key=lambda x: x.readiness_score, reverse=True)
    return results


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
