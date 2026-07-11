from pydantic import BaseModel
from typing import List
import random
import math


class TelemetryPoint(BaseModel):
    day: int
    soc: float
    temperature_c: float
    cycle_count: int
    charge_rate_c: float
    depth_of_discharge: float


class BatteryHealthReport(BaseModel):
    vehicle_id: str
    chemistry: str
    current_soh: float
    predicted_rul_days: int
    is_anomaly: bool
    degradation_rate_per_day: float
    capacity_ah: float
    internal_resistance_mohm: float
    total_cycles: int
    avg_temperature_c: float
    risk_level: str


def generate_ev_telemetry(vehicle_id: str, days: int = 365) -> List[TelemetryPoint]:
    """Generate reproducible telemetry for an EV based on vehicle_id seed with realistic patterns."""
    seed_value = int(vehicle_id.split("-")[1])
    random.seed(seed_value)
    
    telemetry = []
    base_temp = random.uniform(25.0, 35.0)
    
    for day in range(1, days + 1):
        cycle_count = day - 1
        soc = random.uniform(20.0, 100.0)
        charge_rate = random.choice([0.5, 1.0, 1.5, 2.0])  # C-rate
        dod = random.uniform(0.3, 0.9)  # Depth of discharge
        
        # Seasonal temperature variation
        seasonal_offset = 8 * math.sin(2 * math.pi * day / 365)
        
        # Inject thermal anomaly events for specific vehicles
        if seed_value % 3 == 0 and 200 <= day <= 202:
            temperature_c = random.uniform(60.0, 70.0)  # Thermal event
        elif seed_value % 5 == 0 and 150 <= day <= 155:
            temperature_c = random.uniform(55.0, 62.0)  # Elevated temps
        else:
            temperature_c = base_temp + seasonal_offset + random.gauss(0, 2.0)
        
        telemetry.append(
            TelemetryPoint(
                day=day,
                soc=round(soc, 1),
                temperature_c=round(temperature_c, 1),
                cycle_count=cycle_count,
                charge_rate_c=charge_rate,
                depth_of_discharge=round(dod, 2),
            )
        )
    
    return telemetry


def calculate_soh(telemetry: List[TelemetryPoint], vehicle_id: str) -> BatteryHealthReport:
    """
    Calculate State of Health and RUL using semi-empirical degradation model.
    
    Degradation factors:
    - Calendar aging: time-dependent (Arrhenius-based temperature effect)
    - Cycle aging: DoD-weighted cycle count
    - Fast charging penalty: high C-rate accelerates degradation
    - Temperature stress: sustained high temps damage cathode
    """
    if not telemetry:
        return BatteryHealthReport(
            vehicle_id="",
            chemistry="NMC 811",
            current_soh=100.0,
            predicted_rul_days=0,
            is_anomaly=False,
            degradation_rate_per_day=0.0,
            capacity_ah=65.0,
            internal_resistance_mohm=45.0,
            total_cycles=0,
            avg_temperature_c=25.0,
            risk_level="low",
        )
    
    seed_value = int(vehicle_id.split("-")[1])
    random.seed(seed_value + 100)
    
    # Battery chemistry assignment
    chemistry = "NMC 811" if seed_value % 2 == 0 else "LFP"
    nominal_capacity = 65.0 if chemistry == "NMC 811" else 60.0
    
    days = len(telemetry)
    total_cycles = len(telemetry) - 1
    
    # Calendar aging: 0.5-1.5% per year depending on temperature
    temperatures = [point.temperature_c for point in telemetry]
    avg_temp = sum(temperatures) / len(temperatures)
    # Arrhenius factor: doubles every 10°C above 25°C
    temp_factor = 2.0 ** ((avg_temp - 25.0) / 10.0)
    calendar_degradation = (0.01 * days / 365) * temp_factor
    
    # Cycle aging: weighted by DoD (deeper cycles = more damage)
    avg_dod = sum(p.depth_of_discharge for p in telemetry) / len(telemetry)
    cycle_degradation = 0.005 * total_cycles * (avg_dod ** 1.5) / 365
    
    # Fast charging penalty: C-rates > 1.5C add extra stress
    high_rate_cycles = sum(1 for p in telemetry if p.charge_rate_c > 1.5)
    fast_charge_penalty = 0.002 * high_rate_cycles / 365
    
    # Total degradation
    total_degradation_percent = (calendar_degradation + cycle_degradation + fast_charge_penalty) * 100
    current_soh = max(0.0, 100.0 - total_degradation_percent)
    current_soh += random.uniform(-0.3, 0.3)  # Measurement noise
    
    # Current capacity
    capacity_ah = nominal_capacity * (current_soh / 100.0)
    
    # Internal resistance increases as battery ages
    base_ir = 42.0 if chemistry == "NMC 811" else 38.0
    internal_resistance = base_ir * (1 + (100 - current_soh) * 0.02)
    
    degradation_rate_per_day = (100.0 - current_soh) / max(days, 1)
    
    # RUL prediction: days until SoH reaches 80% (end of life)
    if current_soh > 80.0 and degradation_rate_per_day > 0:
        predicted_rul_days = int((current_soh - 80.0) / degradation_rate_per_day)
    else:
        predicted_rul_days = 0
    
    # Anomaly detection: Z-score based thermal anomaly
    mean_temp = sum(temperatures) / len(temperatures)
    variance = sum((t - mean_temp) ** 2 for t in temperatures) / len(temperatures)
    std_dev = math.sqrt(max(variance, 0.01))
    is_anomaly = any(t > (mean_temp + 3 * std_dev) for t in temperatures)
    
    # Risk classification
    if is_anomaly or current_soh < 75:
        risk_level = "critical"
    elif current_soh < 80:
        risk_level = "high"
    elif current_soh < 85 or degradation_rate_per_day > 0.02:
        risk_level = "medium"
    else:
        risk_level = "low"
    
    return BatteryHealthReport(
        vehicle_id=vehicle_id,
        chemistry=chemistry,
        current_soh=round(current_soh, 2),
        predicted_rul_days=predicted_rul_days,
        is_anomaly=is_anomaly,
        degradation_rate_per_day=round(degradation_rate_per_day, 4),
        capacity_ah=round(capacity_ah, 1),
        internal_resistance_mohm=round(internal_resistance, 1),
        total_cycles=total_cycles,
        avg_temperature_c=round(avg_temp, 1),
        risk_level=risk_level,
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
