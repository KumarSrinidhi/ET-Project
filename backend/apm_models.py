from pydantic import BaseModel
from typing import List
import random
import math


class TelemetryPoint(BaseModel):
    day: int
    soc: float
    temperature_c: float
    cycle_count: int


class BatteryHealthReport(BaseModel):
    vehicle_id: str
    current_soh: float
    predicted_rul_days: int
    is_anomaly: bool
    degradation_rate_per_day: float


def generate_ev_telemetry(vehicle_id: str, days: int = 365) -> List[TelemetryPoint]:
    """Generate reproducible telemetry for an EV based on vehicle_id seed."""
    seed_value = int(vehicle_id.split("-")[1])
    random.seed(seed_value)
    
    telemetry = []
    base_temp = random.uniform(25.0, 35.0)
    
    for day in range(1, days + 1):
        cycle_count = day - 1
        soc = random.uniform(20.0, 100.0)
        
        if 200 <= day <= 202:
            temperature_c = 65.0
        else:
            temperature_c = base_temp
        
        telemetry.append(
            TelemetryPoint(
                day=day,
                soc=soc,
                temperature_c=temperature_c,
                cycle_count=cycle_count,
            )
        )
    
    return telemetry


def calculate_soh(telemetry: List[TelemetryPoint], vehicle_id: str) -> BatteryHealthReport:
    """Calculate State of Health and RUL using exact degradation math."""
    if not telemetry:
        return BatteryHealthReport(
            vehicle_id="",
            current_soh=100.0,
            predicted_rul_days=0,
            is_anomaly=False,
            degradation_rate_per_day=0.0,
        )
    
    days = len(telemetry)
    total_cycles = len(telemetry) - 1
    
    total_degradation_percent = (0.01 * days) + (0.005 * total_cycles)
    current_soh = max(0.0, 100.0 - total_degradation_percent)
    current_soh += random.uniform(-0.5, 0.5)
    
    degradation_rate_per_day = (100.0 - current_soh) / len(telemetry)
    
    if current_soh > 80.0:
        predicted_rul_days = math.floor((current_soh - 80.0) / (0.01 + 0.005))
    else:
        predicted_rul_days = 0
    
    temperatures = [point.temperature_c for point in telemetry]
    mean_temp = sum(temperatures) / len(temperatures)
    variance = sum((t - mean_temp) ** 2 for t in temperatures) / len(temperatures)
    std_dev = math.sqrt(variance)
    
    is_anomaly = any(t > (mean_temp + 3 * std_dev) for t in temperatures)
    
    return BatteryHealthReport(
        vehicle_id=vehicle_id,
        current_soh=round(current_soh, 2),
        predicted_rul_days=predicted_rul_days,
        is_anomaly=is_anomaly,
        degradation_rate_per_day=round(degradation_rate_per_day, 4),
    )


def generate_fleet_telemetry() -> dict:
    """Generate telemetry and health reports for a fleet of 10 EVs."""
    fleet_reports = {}
    
    for i in range(1, 11):
        vehicle_id = f"EV-{i:03d}"
        telemetry = generate_ev_telemetry(vehicle_id, days=365)
        health_report = calculate_soh(telemetry, vehicle_id)
        fleet_reports[vehicle_id] = health_report
    
    return fleet_reports
