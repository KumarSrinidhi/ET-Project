"""
Feature 5: Manufacturing Quality Intelligence (QMS Integration)
================================================================
Drift detection and defect classification on manufacturing process
and incoming inspection data. Integrates with Feature 4's supplier/material data.

Core techniques:
- Statistical Process Control (SPC) with control limits
- Process parameter drift detection (CUSUM / EWMA)
- Defect classification using gradient boosting
- Incoming quality inspection scoring
- Supplier quality correlation analysis
"""

from pydantic import BaseModel
from typing import List, Optional
from enum import Enum
import random
import math
from datetime import datetime, timedelta
from supply_chain import BASE_NODES


# ─── Domain Models ────────────────────────────────────────────────────────────

class ProcessStage(str, Enum):
    ELECTRODE_COATING = "Electrode Coating"
    CELL_ASSEMBLY = "Cell Assembly"
    ELECTROLYTE_FILLING = "Electrolyte Filling"
    FORMATION_CYCLING = "Formation & Cycling"
    MODULE_ASSEMBLY = "Module Assembly"
    PACK_INTEGRATION = "Pack Integration"
    FINAL_TEST = "Final Testing"


class DefectType(str, Enum):
    COATING_DEFECT = "Coating Uniformity Defect"
    CONTAMINATION = "Particle Contamination"
    WELD_DEFECT = "Weld Joint Failure"
    ELECTROLYTE_LEAK = "Electrolyte Leakage"
    CAPACITY_DEVIATION = "Capacity Deviation"
    IR_DEVIATION = "Internal Resistance Deviation"
    THERMAL_NONUNIFORMITY = "Thermal Non-Uniformity"
    MECHANICAL_DAMAGE = "Mechanical Damage"


class DriftSeverity(str, Enum):
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"


class ProcessParameter(BaseModel):
    parameter_name: str
    stage: str
    current_value: float
    target_value: float
    ucl: float  # Upper Control Limit
    lcl: float  # Lower Control Limit
    unit: str
    drift_detected: bool
    drift_severity: str
    ewma_value: float
    cusum_pos: float
    cusum_neg: float


class InspectionRecord(BaseModel):
    batch_id: str
    supplier: str
    material: str
    inspection_date: str
    sample_size: int
    defects_found: int
    defect_rate_ppm: float
    pass_fail: str
    defect_types: List[str]
    quality_score: float


class DefectPrediction(BaseModel):
    batch_id: str
    stage: str
    predicted_defect_type: str
    confidence: float
    risk_factors: List[str]
    recommended_action: str


class QualityKPIs(BaseModel):
    overall_yield_pct: float
    first_pass_yield_pct: float
    defect_rate_ppm: float
    scrap_cost_usd: float
    supplier_quality_index: float
    process_capability_cpk: float
    drift_alerts_active: int
    batches_at_risk: int


class SPCChartPoint(BaseModel):
    timestamp: str
    value: float
    ucl: float
    lcl: float
    center_line: float
    out_of_control: bool


class QualityIntelligenceReport(BaseModel):
    process_parameters: List[ProcessParameter]
    inspection_records: List[InspectionRecord]
    defect_predictions: List[DefectPrediction]
    spc_charts: dict  # stage -> list of SPC points
    kpis: QualityKPIs
    supplier_quality_matrix: List[dict]


# ─── Process Parameter Definitions ───────────────────────────────────────────

PROCESS_PARAMS = [
    {"name": "Coating Thickness", "stage": ProcessStage.ELECTRODE_COATING, "target": 85.0, "ucl": 92.0, "lcl": 78.0, "unit": "μm"},
    {"name": "Coating Speed", "stage": ProcessStage.ELECTRODE_COATING, "target": 15.0, "ucl": 18.0, "lcl": 12.0, "unit": "m/min"},
    {"name": "Slurry Viscosity", "stage": ProcessStage.ELECTRODE_COATING, "target": 3500.0, "ucl": 4200.0, "lcl": 2800.0, "unit": "mPa·s"},
    {"name": "Drying Temperature", "stage": ProcessStage.ELECTRODE_COATING, "target": 130.0, "ucl": 140.0, "lcl": 120.0, "unit": "°C"},
    {"name": "Stacking Alignment", "stage": ProcessStage.CELL_ASSEMBLY, "target": 0.05, "ucl": 0.15, "lcl": -0.05, "unit": "mm offset"},
    {"name": "Tab Weld Current", "stage": ProcessStage.CELL_ASSEMBLY, "target": 8.5, "ucl": 9.5, "lcl": 7.5, "unit": "kA"},
    {"name": "Electrolyte Volume", "stage": ProcessStage.ELECTROLYTE_FILLING, "target": 450.0, "ucl": 470.0, "lcl": 430.0, "unit": "mL"},
    {"name": "Vacuum Level", "stage": ProcessStage.ELECTROLYTE_FILLING, "target": -95.0, "ucl": -90.0, "lcl": -100.0, "unit": "kPa"},
    {"name": "Formation Voltage", "stage": ProcessStage.FORMATION_CYCLING, "target": 4.20, "ucl": 4.25, "lcl": 4.15, "unit": "V"},
    {"name": "Initial Capacity", "stage": ProcessStage.FORMATION_CYCLING, "target": 65.0, "ucl": 70.0, "lcl": 60.0, "unit": "Ah"},
    {"name": "Torque - Module Bolts", "stage": ProcessStage.MODULE_ASSEMBLY, "target": 25.0, "ucl": 28.0, "lcl": 22.0, "unit": "N·m"},
    {"name": "Thermal Pad Compression", "stage": ProcessStage.MODULE_ASSEMBLY, "target": 1.5, "ucl": 2.0, "lcl": 1.0, "unit": "mm"},
    {"name": "Coolant Flow Rate", "stage": ProcessStage.PACK_INTEGRATION, "target": 12.0, "ucl": 14.0, "lcl": 10.0, "unit": "L/min"},
    {"name": "Insulation Resistance", "stage": ProcessStage.FINAL_TEST, "target": 500.0, "ucl": 1000.0, "lcl": 100.0, "unit": "MΩ"},
    {"name": "Pack Voltage Spread", "stage": ProcessStage.FINAL_TEST, "target": 0.02, "ucl": 0.05, "lcl": 0.0, "unit": "V"},
]


# ─── Drift Detection Engine ──────────────────────────────────────────────────

def detect_drift_ewma(values: List[float], target: float, lambda_: float = 0.2) -> tuple[float, bool]:
    """Exponentially Weighted Moving Average drift detection."""
    ewma = target
    sigma = math.sqrt(sum((v - target) ** 2 for v in values) / max(len(values), 1))
    ucl_ewma = target + 3 * sigma * math.sqrt(lambda_ / (2 - lambda_))
    lcl_ewma = target - 3 * sigma * math.sqrt(lambda_ / (2 - lambda_))

    for val in values:
        ewma = lambda_ * val + (1 - lambda_) * ewma

    drift_detected = ewma > ucl_ewma or ewma < lcl_ewma
    return ewma, drift_detected


def detect_drift_cusum(values: List[float], target: float, allowance: float = 0.5) -> tuple[float, float, bool]:
    """Cumulative Sum (CUSUM) drift detection."""
    sigma = math.sqrt(sum((v - target) ** 2 for v in values) / max(len(values), 1))
    k = allowance * sigma
    h = 5 * sigma  # Decision interval

    cusum_pos = 0.0
    cusum_neg = 0.0

    for val in values:
        cusum_pos = max(0, cusum_pos + (val - target) - k)
        cusum_neg = max(0, cusum_neg - (val - target) - k)

    drift_detected = cusum_pos > h or cusum_neg > h
    return cusum_pos, cusum_neg, drift_detected


# ─── Synthetic Data Generation ────────────────────────────────────────────────

def generate_process_data(seed: int = 42) -> List[ProcessParameter]:
    """Generate process parameter readings with some drift injected."""
    random.seed(seed)
    params = []

    for p in PROCESS_PARAMS:
        target = p["target"]
        ucl = p["ucl"]
        lcl = p["lcl"]
        sigma = (ucl - target) / 3.0

        # Generate 50 historical readings
        readings = [random.gauss(target, sigma * 0.6) for _ in range(50)]

        # Inject drift in some parameters (20% chance)
        has_drift = random.random() < 0.20
        if has_drift:
            drift_direction = random.choice([1, -1])
            drift_amount = sigma * random.uniform(1.5, 2.5)
            readings[-10:] = [r + drift_direction * drift_amount for r in readings[-10:]]

        current_value = readings[-1]
        ewma_value, ewma_drift = detect_drift_ewma(readings, target)
        cusum_pos, cusum_neg, cusum_drift = detect_drift_cusum(readings, target)

        drift_detected = ewma_drift or cusum_drift or current_value > ucl or current_value < lcl

        if drift_detected and (current_value > ucl or current_value < lcl):
            severity = DriftSeverity.CRITICAL.value
        elif drift_detected:
            severity = DriftSeverity.WARNING.value
        else:
            severity = DriftSeverity.NORMAL.value

        params.append(ProcessParameter(
            parameter_name=p["name"],
            stage=p["stage"].value if isinstance(p["stage"], ProcessStage) else p["stage"],
            current_value=round(current_value, 3),
            target_value=target,
            ucl=ucl,
            lcl=lcl,
            unit=p["unit"],
            drift_detected=drift_detected,
            drift_severity=severity,
            ewma_value=round(ewma_value, 3),
            cusum_pos=round(cusum_pos, 3),
            cusum_neg=round(cusum_neg, 3),
        ))

    return params


def generate_inspection_records(seed: int = 42) -> List[InspectionRecord]:
    """Generate incoming inspection records linked to supply chain suppliers."""
    random.seed(seed)
    records = []

    suppliers_materials = [
        ("Salar de Atacama Mine", "Lithium Carbonate"),
        ("Lubumbashi Cobalt Mine", "Cobalt Sulfate"),
        ("Sulawesi Nickel Mine", "Nickel Sulfate"),
        ("Shanghai Cathode Corp", "NMC 811 Cathode"),
        ("Panasonic EV Pack Plant", "Battery Cells"),
    ]

    base_date = datetime(2026, 6, 1)

    for batch_num in range(1, 26):  # 25 batches
        supplier, material = random.choice(suppliers_materials)
        sample_size = random.choice([50, 100, 150, 200])

        # Different suppliers have different quality levels
        if "Atacama" in supplier:
            base_defect_rate = 0.005
        elif "Lubumbashi" in supplier:
            base_defect_rate = 0.025  # Higher defect rate from DRC
        elif "Sulawesi" in supplier:
            base_defect_rate = 0.015
        elif "Shanghai" in supplier:
            base_defect_rate = 0.008
        else:
            base_defect_rate = 0.003

        defects = max(0, int(random.gauss(base_defect_rate * sample_size, 1.5)))
        defect_rate_ppm = (defects / sample_size) * 1_000_000

        defect_types = []
        if defects > 0:
            possible_defects = [DefectType.CONTAMINATION.value, DefectType.CAPACITY_DEVIATION.value,
                                DefectType.IR_DEVIATION.value, DefectType.MECHANICAL_DAMAGE.value]
            defect_types = random.sample(possible_defects, min(defects, len(possible_defects)))

        quality_score = max(0.0, 100.0 - (defect_rate_ppm / 500.0))
        pass_fail = "PASS" if defect_rate_ppm < 10000 else "FAIL"

        inspection_date = base_date + timedelta(days=batch_num * 2)

        records.append(InspectionRecord(
            batch_id=f"BATCH-{batch_num:04d}",
            supplier=supplier,
            material=material,
            inspection_date=inspection_date.strftime("%Y-%m-%d"),
            sample_size=sample_size,
            defects_found=defects,
            defect_rate_ppm=round(defect_rate_ppm, 1),
            pass_fail=pass_fail,
            defect_types=defect_types,
            quality_score=round(quality_score, 1),
        ))

    return records


def generate_defect_predictions(process_params: List[ProcessParameter], seed: int = 42) -> List[DefectPrediction]:
    """Predict defects based on process parameter drift - simulates a gradient boosting classifier."""
    random.seed(seed)
    predictions = []

    drifting_params = [p for p in process_params if p.drift_detected]

    # Map process stages to likely defect types
    stage_defect_map = {
        ProcessStage.ELECTRODE_COATING.value: (DefectType.COATING_DEFECT.value, "Reduce coating speed, check slurry preparation"),
        ProcessStage.CELL_ASSEMBLY.value: (DefectType.WELD_DEFECT.value, "Recalibrate weld head, inspect electrode alignment"),
        ProcessStage.ELECTROLYTE_FILLING.value: (DefectType.ELECTROLYTE_LEAK.value, "Check seal integrity, verify vacuum level"),
        ProcessStage.FORMATION_CYCLING.value: (DefectType.CAPACITY_DEVIATION.value, "Adjust formation protocol, check cell temperature"),
        ProcessStage.MODULE_ASSEMBLY.value: (DefectType.THERMAL_NONUNIFORMITY.value, "Re-torque bolts, inspect thermal interface"),
        ProcessStage.PACK_INTEGRATION.value: (DefectType.THERMAL_NONUNIFORMITY.value, "Verify coolant connections, check flow distribution"),
        ProcessStage.FINAL_TEST.value: (DefectType.IR_DEVIATION.value, "Full electrical inspection, check BMS connections"),
    }

    batch_counter = 100
    for param in drifting_params:
        batch_counter += 1
        defect_info = stage_defect_map.get(param.stage, (DefectType.CONTAMINATION.value, "General inspection required"))

        # Confidence based on severity of drift
        if param.drift_severity == DriftSeverity.CRITICAL.value:
            confidence = random.uniform(0.85, 0.97)
        else:
            confidence = random.uniform(0.60, 0.84)

        risk_factors = [f"{param.parameter_name} drift detected ({param.drift_severity})"]
        if param.current_value > param.ucl:
            risk_factors.append(f"Above UCL: {param.current_value} > {param.ucl} {param.unit}")
        elif param.current_value < param.lcl:
            risk_factors.append(f"Below LCL: {param.current_value} < {param.lcl} {param.unit}")

        predictions.append(DefectPrediction(
            batch_id=f"BATCH-{batch_counter:04d}",
            stage=param.stage,
            predicted_defect_type=defect_info[0],
            confidence=round(confidence, 3),
            risk_factors=risk_factors,
            recommended_action=defect_info[1],
        ))

    # Add some predictions based on inspection history patterns
    for i in range(3):
        batch_counter += 1
        stage = random.choice(list(ProcessStage)).value
        defect_info = stage_defect_map.get(stage, (DefectType.CONTAMINATION.value, "General inspection"))
        predictions.append(DefectPrediction(
            batch_id=f"BATCH-{batch_counter:04d}",
            stage=stage,
            predicted_defect_type=defect_info[0],
            confidence=round(random.uniform(0.55, 0.75), 3),
            risk_factors=["Historical pattern match", "Supplier quality trend declining"],
            recommended_action=defect_info[1],
        ))

    return predictions


def generate_spc_charts(seed: int = 42) -> dict:
    """Generate SPC control chart data for key process stages."""
    random.seed(seed)
    charts = {}

    key_params = [
        ("Coating Thickness", ProcessStage.ELECTRODE_COATING.value, 85.0, 92.0, 78.0),
        ("Formation Voltage", ProcessStage.FORMATION_CYCLING.value, 4.20, 4.25, 4.15),
        ("Initial Capacity", ProcessStage.FORMATION_CYCLING.value, 65.0, 70.0, 60.0),
        ("Coolant Flow Rate", ProcessStage.PACK_INTEGRATION.value, 12.0, 14.0, 10.0),
    ]

    base_date = datetime(2026, 6, 1)

    for param_name, stage, target, ucl, lcl in key_params:
        sigma = (ucl - target) / 3.0
        points = []

        for i in range(30):  # 30 days of data
            # Inject a drift pattern around day 20-25
            if 20 <= i <= 25:
                value = random.gauss(target + sigma * 1.5, sigma * 0.5)
            else:
                value = random.gauss(target, sigma * 0.6)

            out_of_control = value > ucl or value < lcl

            points.append(SPCChartPoint(
                timestamp=(base_date + timedelta(days=i)).strftime("%Y-%m-%d"),
                value=round(value, 3),
                ucl=ucl,
                lcl=lcl,
                center_line=target,
                out_of_control=out_of_control,
            ))

        chart_key = f"{stage} - {param_name}"
        charts[chart_key] = [p.model_dump() for p in points]

    return charts


def calculate_quality_kpis(
    process_params: List[ProcessParameter],
    inspections: List[InspectionRecord],
    predictions: List[DefectPrediction]
) -> QualityKPIs:
    """Calculate manufacturing quality KPIs."""
    # Overall yield (simulated from process parameters)
    drift_count = sum(1 for p in process_params if p.drift_detected)
    overall_yield = 98.5 - (drift_count * 0.8)

    # First pass yield
    first_pass_yield = overall_yield - random.uniform(0.5, 1.5)

    # Defect rate from inspections
    total_samples = sum(r.sample_size for r in inspections)
    total_defects = sum(r.defects_found for r in inspections)
    defect_rate_ppm = (total_defects / max(total_samples, 1)) * 1_000_000

    # Scrap cost estimate
    scrap_cost = total_defects * random.uniform(150, 350)

    # Supplier quality index (average quality score)
    supplier_quality = sum(r.quality_score for r in inspections) / max(len(inspections), 1)

    # Process capability (Cpk) - simplified
    cpk_values = []
    for p in process_params:
        if not p.drift_detected:
            sigma_est = (p.ucl - p.lcl) / 6.0
            if sigma_est > 0:
                cpu = (p.ucl - p.current_value) / (3 * sigma_est)
                cpl = (p.current_value - p.lcl) / (3 * sigma_est)
                cpk_values.append(min(cpu, cpl))
    avg_cpk = sum(cpk_values) / max(len(cpk_values), 1)

    return QualityKPIs(
        overall_yield_pct=round(overall_yield, 2),
        first_pass_yield_pct=round(first_pass_yield, 2),
        defect_rate_ppm=round(defect_rate_ppm, 1),
        scrap_cost_usd=round(scrap_cost, 2),
        supplier_quality_index=round(supplier_quality, 1),
        process_capability_cpk=round(avg_cpk, 2),
        drift_alerts_active=drift_count,
        batches_at_risk=len(predictions),
    )


def generate_supplier_quality_matrix(inspections: List[InspectionRecord]) -> List[dict]:
    """Generate quality matrix linking suppliers to defect rates."""
    supplier_stats: dict = {}

    for record in inspections:
        if record.supplier not in supplier_stats:
            supplier_stats[record.supplier] = {
                "supplier": record.supplier,
                "total_batches": 0,
                "total_defects": 0,
                "total_samples": 0,
                "avg_quality_score": 0.0,
                "pass_rate_pct": 0.0,
                "quality_scores": [],
                "passes": 0,
            }
        stats = supplier_stats[record.supplier]
        stats["total_batches"] += 1
        stats["total_defects"] += record.defects_found
        stats["total_samples"] += record.sample_size
        stats["quality_scores"].append(record.quality_score)
        if record.pass_fail == "PASS":
            stats["passes"] += 1

    result = []
    for supplier, stats in supplier_stats.items():
        stats["avg_quality_score"] = round(sum(stats["quality_scores"]) / len(stats["quality_scores"]), 1)
        stats["pass_rate_pct"] = round((stats["passes"] / stats["total_batches"]) * 100, 1)
        stats["defect_rate_ppm"] = round((stats["total_defects"] / max(stats["total_samples"], 1)) * 1_000_000, 1)
        del stats["quality_scores"]
        del stats["passes"]
        result.append(stats)

    return sorted(result, key=lambda x: x["avg_quality_score"])


# ─── Main Report Generator ───────────────────────────────────────────────────

def generate_quality_report() -> QualityIntelligenceReport:
    """Generate the full Quality Intelligence report."""
    seed = datetime.now().day  # Changes daily for variety

    process_params = generate_process_data(seed)
    inspections = generate_inspection_records(seed)
    predictions = generate_defect_predictions(process_params, seed)
    spc_charts = generate_spc_charts(seed)
    kpis = calculate_quality_kpis(process_params, inspections, predictions)
    supplier_matrix = generate_supplier_quality_matrix(inspections)

    return QualityIntelligenceReport(
        process_parameters=process_params,
        inspection_records=inspections,
        defect_predictions=predictions,
        spc_charts=spc_charts,
        kpis=kpis,
        supplier_quality_matrix=supplier_matrix,
    )
