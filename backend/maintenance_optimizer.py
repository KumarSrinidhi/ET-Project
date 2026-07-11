"""
Feature 3: Maintenance Operations Optimiser
============================================
Constraint-based scheduling engine that consumes APM triggers (Feature 2)
and produces an optimized maintenance plan respecting workshop capacity,
technician shifts, charging infrastructure, and spare-parts lead times.

Core techniques:
- Priority-weighted scheduling with preemption
- Multi-resource constraint satisfaction (bays, technicians, chargers)
- Cost & downtime minimization objective
- KPI reporting (utilization, avg wait, throughput)
"""

from pydantic import BaseModel
from typing import List, Optional
from enum import Enum
import math
import random
from datetime import datetime, timedelta
from apm_models import generate_fleet_telemetry, BatteryHealthReport


# ─── Domain Models ────────────────────────────────────────────────────────────

class Priority(str, Enum):
    CRITICAL = "critical"       # Thermal anomaly - safety risk
    HIGH = "high"               # SoH < 80% - end of useful life
    MEDIUM = "medium"           # SoH 80-85% - degraded performance
    LOW = "low"                 # Preventive / scheduled checkup


class TaskType(str, Enum):
    THERMAL_INSPECTION = "Thermal Anomaly Deep-Dive"
    BATTERY_SWAP = "Battery Pack Replacement"
    SOH_INSPECTION = "SoH Degradation Inspection"
    PREVENTIVE = "Preventive Maintenance"
    CHARGING_CALIBRATION = "Charging System Calibration"
    COOLANT_SERVICE = "Coolant Loop Service"


class Technician(BaseModel):
    tech_id: str
    name: str
    skill_level: str             # "senior", "mid", "junior"
    shift_start_hour: int
    shift_end_hour: int
    specialization: str          # "thermal", "electrical", "general"


class MaintenanceBay(BaseModel):
    bay_id: int
    bay_name: str
    equipment: List[str]         # e.g. ["lift", "diagnostics", "thermal_scanner"]
    max_vehicle_weight_tons: float
    has_charger: bool


class MaintenanceTask(BaseModel):
    task_id: str
    vehicle_id: str
    task_type: TaskType
    priority: Priority
    estimated_duration_hours: float
    required_equipment: List[str]
    requires_senior_tech: bool
    spare_parts_needed: List[str]
    spare_parts_available: bool
    estimated_cost_inr: float


class ScheduledTask(BaseModel):
    task_id: str
    vehicle_id: str
    task_type: str
    priority: str
    bay_id: int
    bay_name: str
    technician_id: str
    technician_name: str
    start_hour: float
    end_hour: float
    estimated_cost_inr: float
    spare_parts_needed: List[str]
    status: str                  # "scheduled", "delayed_parts", "overflow"


class ScheduleKPIs(BaseModel):
    total_tasks: int
    scheduled_tasks: int
    overflow_tasks: int
    delayed_tasks: int
    total_cost_inr: float
    avg_wait_hours: float
    bay_utilization_pct: List[float]     # per bay
    total_downtime_hours: float
    throughput_tasks_per_shift: float
    critical_tasks_same_day_pct: float


class OptimizedSchedule(BaseModel):
    schedule: List[ScheduledTask]
    kpis: ScheduleKPIs
    shift_date: str
    constraints_summary: dict


# ─── Workshop Configuration ───────────────────────────────────────────────────

MAINTENANCE_BAYS = [
    MaintenanceBay(
        bay_id=1, bay_name="Bay A - Heavy Duty",
        equipment=["lift", "diagnostics", "thermal_scanner", "battery_crane"],
        max_vehicle_weight_tons=50.0, has_charger=True
    ),
    MaintenanceBay(
        bay_id=2, bay_name="Bay B - General",
        equipment=["lift", "diagnostics", "thermal_scanner"],
        max_vehicle_weight_tons=30.0, has_charger=True
    ),
    MaintenanceBay(
        bay_id=3, bay_name="Bay C - General",
        equipment=["lift", "diagnostics"],
        max_vehicle_weight_tons=30.0, has_charger=False
    ),
    MaintenanceBay(
        bay_id=4, bay_name="Bay D - Quick Service",
        equipment=["diagnostics", "charging_station"],
        max_vehicle_weight_tons=20.0, has_charger=True
    ),
]

TECHNICIANS = [
    Technician(tech_id="T-001", name="R. Singh", skill_level="senior",
               shift_start_hour=6, shift_end_hour=14, specialization="thermal"),
    Technician(tech_id="T-002", name="M. Patel", skill_level="senior",
               shift_start_hour=6, shift_end_hour=14, specialization="electrical"),
    Technician(tech_id="T-003", name="A. Kumar", skill_level="mid",
               shift_start_hour=6, shift_end_hour=14, specialization="general"),
    Technician(tech_id="T-004", name="S. Verma", skill_level="mid",
               shift_start_hour=14, shift_end_hour=22, specialization="thermal"),
    Technician(tech_id="T-005", name="D. Rao", skill_level="mid",
               shift_start_hour=14, shift_end_hour=22, specialization="electrical"),
    Technician(tech_id="T-006", name="K. Joshi", skill_level="junior",
               shift_start_hour=14, shift_end_hour=22, specialization="general"),
]

SHIFT_START = 6   # 6:00 AM
SHIFT_END = 22    # 10:00 PM (two 8-hour shifts)
TOTAL_SHIFT_HOURS = SHIFT_END - SHIFT_START  # 16 hours available

# Spare parts inventory simulation
SPARE_PARTS_INVENTORY = {
    "battery_pack_nmc": 2,
    "battery_pack_lfp": 3,
    "thermal_paste": 10,
    "coolant_fluid": 8,
    "bms_module": 4,
    "charging_connector": 6,
    "fuse_kit": 12,
    "sensor_array": 5,
}


# ─── Task Generation from APM Data ───────────────────────────────────────────

def generate_maintenance_tasks_from_apm() -> List[MaintenanceTask]:
    """
    Consumes Feature 2 APM outputs (SoH, anomalies, RUL) and generates
    prioritized maintenance tasks with resource requirements.
    """
    fleet_data = generate_fleet_telemetry()
    tasks: List[MaintenanceTask] = []
    task_counter = 0

    for vehicle_id, health_report in fleet_data.items():
        # Critical: Thermal anomaly detected
        if health_report.is_anomaly:
            task_counter += 1
            tasks.append(MaintenanceTask(
                task_id=f"MNT-{task_counter:04d}",
                vehicle_id=vehicle_id,
                task_type=TaskType.THERMAL_INSPECTION,
                priority=Priority.CRITICAL,
                estimated_duration_hours=6.0,
                required_equipment=["lift", "diagnostics", "thermal_scanner"],
                requires_senior_tech=True,
                spare_parts_needed=["thermal_paste", "sensor_array"],
                spare_parts_available=True,
                estimated_cost_inr=4500.0,
            ))
            # Critical vehicles also need coolant service
            task_counter += 1
            tasks.append(MaintenanceTask(
                task_id=f"MNT-{task_counter:04d}",
                vehicle_id=vehicle_id,
                task_type=TaskType.COOLANT_SERVICE,
                priority=Priority.HIGH,
                estimated_duration_hours=2.0,
                required_equipment=["lift"],
                requires_senior_tech=False,
                spare_parts_needed=["coolant_fluid"],
                spare_parts_available=True,
                estimated_cost_inr=800.0,
            ))

        # High: Battery at end of life
        elif health_report.current_soh < 80.0:
            task_counter += 1
            chemistry = random.choice(["battery_pack_nmc", "battery_pack_lfp"])
            available = SPARE_PARTS_INVENTORY.get(chemistry, 0) > 0
            tasks.append(MaintenanceTask(
                task_id=f"MNT-{task_counter:04d}",
                vehicle_id=vehicle_id,
                task_type=TaskType.BATTERY_SWAP,
                priority=Priority.HIGH,
                estimated_duration_hours=8.0,
                required_equipment=["lift", "diagnostics", "battery_crane"],
                requires_senior_tech=True,
                spare_parts_needed=[chemistry, "bms_module"],
                spare_parts_available=available,
                estimated_cost_inr=12000.0,
            ))

        # Medium: Degrading battery
        elif health_report.current_soh < 85.0:
            task_counter += 1
            tasks.append(MaintenanceTask(
                task_id=f"MNT-{task_counter:04d}",
                vehicle_id=vehicle_id,
                task_type=TaskType.SOH_INSPECTION,
                priority=Priority.MEDIUM,
                estimated_duration_hours=3.0,
                required_equipment=["diagnostics"],
                requires_senior_tech=False,
                spare_parts_needed=["sensor_array"],
                spare_parts_available=True,
                estimated_cost_inr=1200.0,
            ))

        # Low: Preventive maintenance for healthy vehicles approaching threshold
        elif health_report.current_soh < 90.0 and health_report.predicted_rul_days < 200:
            task_counter += 1
            tasks.append(MaintenanceTask(
                task_id=f"MNT-{task_counter:04d}",
                vehicle_id=vehicle_id,
                task_type=TaskType.PREVENTIVE,
                priority=Priority.LOW,
                estimated_duration_hours=1.5,
                required_equipment=["diagnostics"],
                requires_senior_tech=False,
                spare_parts_needed=[],
                spare_parts_available=True,
                estimated_cost_inr=350.0,
            ))

        # Charging calibration for vehicles with high degradation rate
        if health_report.degradation_rate_per_day > 0.015:
            task_counter += 1
            tasks.append(MaintenanceTask(
                task_id=f"MNT-{task_counter:04d}",
                vehicle_id=vehicle_id,
                task_type=TaskType.CHARGING_CALIBRATION,
                priority=Priority.MEDIUM,
                estimated_duration_hours=2.0,
                required_equipment=["diagnostics", "charging_station"],
                requires_senior_tech=False,
                spare_parts_needed=["charging_connector"],
                spare_parts_available=True,
                estimated_cost_inr=600.0,
            ))

    return tasks


# ─── Constraint-Based Optimizer ───────────────────────────────────────────────

PRIORITY_WEIGHTS = {
    Priority.CRITICAL: 100,
    Priority.HIGH: 75,
    Priority.MEDIUM: 50,
    Priority.LOW: 25,
}


def _bay_has_equipment(bay: MaintenanceBay, required: List[str]) -> bool:
    """Check if bay has all required equipment."""
    return all(eq in bay.equipment for eq in required)


def _tech_available_at(tech: Technician, start_hour: float, end_hour: float) -> bool:
    """Check if technician's shift covers the task window."""
    return tech.shift_start_hour <= start_hour and tech.shift_end_hour >= end_hour


def _tech_suitable(tech: Technician, task: MaintenanceTask) -> bool:
    """Check if technician has the right skill level and specialization."""
    if task.requires_senior_tech and tech.skill_level != "senior":
        return False
    # Thermal tasks prefer thermal specialist
    if task.task_type == TaskType.THERMAL_INSPECTION and tech.specialization != "thermal":
        if tech.skill_level != "senior":  # Senior can handle any
            return False
    return True


def optimize_schedule() -> OptimizedSchedule:
    """
    Multi-constraint optimization engine.
    
    Constraints:
    1. Bay capacity & equipment compatibility
    2. Technician availability (shift windows)
    3. Technician skill requirements
    4. Spare parts availability
    5. No overlapping assignments (bay or technician)
    6. Priority ordering (critical first, then by cost-of-delay)
    
    Objective: Minimize total fleet downtime while respecting all constraints.
    """
    tasks = generate_maintenance_tasks_from_apm()

    # Sort by priority weight (descending), then by duration (longest first for bin-packing)
    tasks.sort(key=lambda t: (-PRIORITY_WEIGHTS[t.priority], -t.estimated_duration_hours))

    # Track resource occupancy: bay_id -> list of (start, end) intervals
    bay_timeline: dict[int, List[tuple[float, float]]] = {b.bay_id: [] for b in MAINTENANCE_BAYS}
    # Track technician occupancy: tech_id -> list of (start, end)
    tech_timeline: dict[str, List[tuple[float, float]]] = {t.tech_id: [] for t in TECHNICIANS}

    scheduled: List[ScheduledTask] = []
    overflow: List[ScheduledTask] = []
    delayed: List[ScheduledTask] = []

    for task in tasks:
        placed = False

        # If spare parts not available, mark as delayed
        if not task.spare_parts_available:
            delayed.append(ScheduledTask(
                task_id=task.task_id,
                vehicle_id=task.vehicle_id,
                task_type=task.task_type.value,
                priority=task.priority.value,
                bay_id=0,
                bay_name="N/A",
                technician_id="N/A",
                technician_name="N/A",
                start_hour=0,
                end_hour=0,
                estimated_cost_inr=task.estimated_cost_inr,
                spare_parts_needed=task.spare_parts_needed,
                status="delayed_parts",
            ))
            continue

        # Try to place in the earliest available slot across all compatible bays
        best_start = float('inf')
        best_bay: Optional[MaintenanceBay] = None
        best_tech: Optional[Technician] = None

        for bay in MAINTENANCE_BAYS:
            # Check equipment compatibility
            if not _bay_has_equipment(bay, task.required_equipment):
                continue

            # Find earliest slot in this bay
            earliest_in_bay = SHIFT_START
            for interval in sorted(bay_timeline[bay.bay_id]):
                if earliest_in_bay + task.estimated_duration_hours <= interval[0]:
                    break  # Found a gap
                earliest_in_bay = max(earliest_in_bay, interval[1])

            # Check if task fits within the shift
            task_end = earliest_in_bay + task.estimated_duration_hours
            if task_end > SHIFT_END:
                continue

            # Find a suitable technician available at this time
            for tech in TECHNICIANS:
                if not _tech_suitable(tech, task):
                    continue
                if not _tech_available_at(tech, earliest_in_bay, task_end):
                    continue
                # Check tech is not already booked
                tech_busy = any(
                    not (task_end <= s or earliest_in_bay >= e)
                    for s, e in tech_timeline[tech.tech_id]
                )
                if tech_busy:
                    continue

                # This is a valid placement
                if earliest_in_bay < best_start:
                    best_start = earliest_in_bay
                    best_bay = bay
                    best_tech = tech
                break  # Take first suitable tech for this bay

        if best_bay and best_tech:
            task_end = best_start + task.estimated_duration_hours
            bay_timeline[best_bay.bay_id].append((best_start, task_end))
            tech_timeline[best_tech.tech_id].append((best_start, task_end))

            scheduled.append(ScheduledTask(
                task_id=task.task_id,
                vehicle_id=task.vehicle_id,
                task_type=task.task_type.value,
                priority=task.priority.value,
                bay_id=best_bay.bay_id,
                bay_name=best_bay.bay_name,
                technician_id=best_tech.tech_id,
                technician_name=best_tech.name,
                start_hour=best_start,
                end_hour=task_end,
                estimated_cost_inr=task.estimated_cost_inr,
                spare_parts_needed=task.spare_parts_needed,
                status="scheduled",
            ))
            placed = True

        if not placed and task.spare_parts_available:
            overflow.append(ScheduledTask(
                task_id=task.task_id,
                vehicle_id=task.vehicle_id,
                task_type=task.task_type.value,
                priority=task.priority.value,
                bay_id=0,
                bay_name="N/A (Overflow)",
                technician_id="N/A",
                technician_name="N/A",
                start_hour=0,
                end_hour=0,
                estimated_cost_inr=task.estimated_cost_inr,
                spare_parts_needed=task.spare_parts_needed,
                status="overflow",
            ))

    # ─── Calculate KPIs ───────────────────────────────────────────────────────
    all_results = scheduled + overflow + delayed
    total_tasks = len(tasks)
    scheduled_count = len(scheduled)
    overflow_count = len(overflow)
    delayed_count = len(delayed)

    total_cost = sum(t.estimated_cost_inr for t in all_results)

    # Average wait: how long from shift start until task begins
    if scheduled:
        avg_wait = sum(t.start_hour - SHIFT_START for t in scheduled) / len(scheduled)
    else:
        avg_wait = 0.0

    # Bay utilization: occupied hours / total available hours per bay
    bay_util = []
    for bay in MAINTENANCE_BAYS:
        occupied = sum(e - s for s, e in bay_timeline[bay.bay_id])
        util_pct = (occupied / TOTAL_SHIFT_HOURS) * 100.0
        bay_util.append(round(util_pct, 1))

    # Total downtime = sum of all scheduled task durations
    total_downtime = sum(t.end_hour - t.start_hour for t in scheduled)

    # Throughput
    throughput = scheduled_count / (TOTAL_SHIFT_HOURS / 8.0) if TOTAL_SHIFT_HOURS > 0 else 0

    # Critical same-day completion rate
    critical_tasks = [t for t in tasks if t.priority == Priority.CRITICAL]
    critical_scheduled = [t for t in scheduled if t.priority == Priority.CRITICAL.value]
    critical_pct = (len(critical_scheduled) / len(critical_tasks) * 100.0) if critical_tasks else 100.0

    kpis = ScheduleKPIs(
        total_tasks=total_tasks,
        scheduled_tasks=scheduled_count,
        overflow_tasks=overflow_count,
        delayed_tasks=delayed_count,
        total_cost_inr=round(total_cost, 2),
        avg_wait_hours=round(avg_wait, 2),
        bay_utilization_pct=bay_util,
        total_downtime_hours=round(total_downtime, 1),
        throughput_tasks_per_shift=round(throughput, 1),
        critical_tasks_same_day_pct=round(critical_pct, 1),
    )

    constraints_summary = {
        "bays_available": len(MAINTENANCE_BAYS),
        "technicians_available": len(TECHNICIANS),
        "shift_window": f"{SHIFT_START}:00 - {SHIFT_END}:00 ({TOTAL_SHIFT_HOURS}h)",
        "shift_pattern": "2 shifts x 8 hours",
        "priority_levels": ["critical", "high", "medium", "low"],
        "optimization_method": "Priority-weighted constraint satisfaction with earliest-fit",
    }

    return OptimizedSchedule(
        schedule=all_results,
        kpis=kpis,
        shift_date=datetime.now().strftime("%Y-%m-%d"),
        constraints_summary=constraints_summary,
    )
