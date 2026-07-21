"""Battery Material Passport — EU Battery Regulation 2027 compliant traceability.

Links each vehicle's battery chemistry to its full supply chain provenance:
mine of origin → refinery → cell/pack manufacturer → vehicle installation.
Includes digital passport metadata: manufacturing date, warranty status,
recycled content %, and recycling eligibility.
"""
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from supply_chain import get_base_nodes_lazy, SupplyNode
from apm_models import generate_fleet_telemetry, BatteryHealthReport
from analytics import forecast_soh_curve


# ─── Chemistry-to-Supply-Chain Mapping ─────────────────────────────────────
# Each chemistry traces a specific set of tier-3→2→1 nodes

NMC_SUPPLY_CHAIN = {
    "chemistry": "NMC 811",
    "description": "Nickel-Manganese-Cobalt cathode, high energy density for long-range vehicles",
    "nodes": [
        # Tier 3 — Raw Materials (Mines)
        {"entity_name": "Salar de Atacama Mine", "role": "Lithium Extraction"},
        {"entity_name": "Lubumbashi Cobalt Mine", "role": "Cobalt Mining"},
        {"entity_name": "Sulawesi Nickel Mine", "role": "Nickel Mining"},
        # Tier 2 — Processing / Refining
        {"entity_name": "Shanghai Cathode Corp", "role": "NMC Cathode Synthesis"},
        {"entity_name": "Umicore Refinery", "role": "Cobalt Refining"},
        # Tier 1 — Cell / Pack Assembly
        {"entity_name": "Panasonic EV Pack Plant", "role": "Battery Pack Assembly"},
    ],
    "recycling_efficiency_pct": 65,
    "regulatory_status": "EU Battery Regulation 2027 Compliant",
    "conflict_minerals_risk": "Medium — Cobalt sourced from DRC, requires enhanced due diligence",
    "recycled_content_pct": 12,
    "carbon_footprint_kg_co2_per_kwh": 72,
}

LFP_SUPPLY_CHAIN = {
    "chemistry": "LFP",
    "description": "Lithium Iron Phosphate cathode, safer chemistry with longer cycle life for commercial fleets",
    "nodes": [
        # Tier 3
        {"entity_name": "Pilbara Lithium Mine", "role": "Spodumene / Lithium Extraction"},
        {"entity_name": "Heilongjiang Graphite", "role": "Graphite Anode Material"},
        # Tier 2 — skipped (LFP cathode doesn't require cobalt/nickel refining)
        # Tier 1
        {"entity_name": "CATL Cell Factory", "role": "LFP Cell Manufacturing"},
    ],
    "recycling_efficiency_pct": 55,
    "regulatory_status": "EU Battery Regulation 2027 Compliant",
    "conflict_minerals_risk": "Low — Cobalt-free chemistry, no DRC dependency",
    "recycled_content_pct": 8,
    "carbon_footprint_kg_co2_per_kwh": 58,
}


def _resolve_node(entity_name: str, all_nodes: List[SupplyNode]) -> Optional[dict]:
    """Find a base node by entity_name and return its serialized form."""
    for n in all_nodes:
        if n.entity_name == entity_name:
            return n.model_dump()
    return None


def assemble_battery_passport(vehicle_id: str) -> dict:
    """Build the full digital battery passport for a single vehicle.

    Returns a dict with:
    - vehicle: BatteryHealthReport + forecast
    - supply_chain: tiered trace with resolved node data
    - passport_metadata: manufacturing date, warranty, recycling, regulatory
    - recycling: eligibility, recovery rates, environmental metrics
    """
    fleet = generate_fleet_telemetry()
    health = fleet.get(vehicle_id)
    if not health:
        return {"error": f"Vehicle {vehicle_id} not found in APM fleet"}

    # Determine chemistry and map
    chem_config = NMC_SUPPLY_CHAIN if health.chemistry == "NMC 811" else LFP_SUPPLY_CHAIN

    # Get all supply chain nodes (cached)
    all_nodes = get_base_nodes_lazy()

    # Resolve each node in the supply chain against real SupplyNode data
    trace = []
    for step in chem_config["nodes"]:
        resolved = _resolve_node(step["entity_name"], all_nodes)
        trace.append({
            "entity_name": step["entity_name"],
            "role": step["role"],
            "data": resolved,  # full SupplyNode dict or None
        })

    # SoH forecast (365-day projection)
    forecast = forecast_soh_curve(health.current_soh, health.degradation_rate_per_day, days=365)

    # Manufacturing metadata (deterministic per vehicle)
    seed = sum(ord(c) for c in vehicle_id)
    manufacture_date = (datetime.utcnow() - timedelta(days=365 + seed % 180)).strftime("%Y-%m-%d")
    warranty_years = 8 if health.chemistry == "LFP" else 6
    warranty_expiry = (datetime.strptime(manufacture_date, "%Y-%m-%d") + timedelta(days=warranty_years * 365)).strftime("%Y-%m-%d")
    days_since_manufacture = (datetime.utcnow() - datetime.strptime(manufacture_date, "%Y-%m-%d")).days
    warranty_remaining_days = max(0, warranty_years * 365 - days_since_manufacture)
    under_warranty = warranty_remaining_days > 0

    # Recycling eligibility
    eol_threshold_soh = 70.0
    recycle_now = health.current_soh <= eol_threshold_soh
    # Total material content in pack (kg) — based on nominal capacity and chemistry
    pack_kg_per_ah = 0.45
    pack_mass_kg = health.capacity_ah * pack_kg_per_ah * (health.current_soh / 100.0)
    recoverable_materials = {
        "Lithium (kg)": round(pack_mass_kg * 0.022, 2),
        "Cobalt (kg)": round(pack_mass_kg * 0.045, 2) if health.chemistry == "NMC 811" else 0.0,
        "Nickel (kg)": round(pack_mass_kg * 0.12, 2) if health.chemistry == "NMC 811" else 0.0,
        "Manganese (kg)": round(pack_mass_kg * 0.05, 2) if health.chemistry == "NMC 811" else 0.0,
        "Graphite (kg)": round(pack_mass_kg * 0.16, 2),
        "Iron/Phosphate (kg)": round(pack_mass_kg * 0.10, 2) if health.chemistry == "LFP" else 0.0,
        "Copper (kg)": round(pack_mass_kg * 0.08, 2),
        "Aluminium (kg)": round(pack_mass_kg * 0.12, 2),
    }

    return {
        "passport_id": f"BP-{vehicle_id}-{manufacture_date[:4]}",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "vehicle": {
            "vehicle_id": vehicle_id,
            "chemistry": health.chemistry,
            "chemistry_label": chem_config["chemistry"],
            "chemistry_description": chem_config["description"],
            "current_soh": health.current_soh,
            "predicted_rul_days": health.predicted_rul_days,
            "degradation_rate_per_day": health.degradation_rate_per_day,
            "capacity_ah": health.capacity_ah,
            "internal_resistance_mohm": health.internal_resistance_mohm,
            "total_cycles": health.total_cycles,
            "avg_temperature_c": health.avg_temperature_c,
            "is_anomaly": health.is_anomaly,
            "risk_level": health.risk_level,
        },
        "supply_chain": {
            "chemistry": chem_config["chemistry"],
            "trace": trace,
            "conflict_minerals_risk": chem_config["conflict_minerals_risk"],
            "carbon_footprint_kg_co2_per_kwh": chem_config["carbon_footprint_kg_co2_per_kwh"],
        },
        "passport_metadata": {
            "manufacture_date": manufacture_date,
            "installed_date": manufacture_date,
            "warranty_years": warranty_years,
            "warranty_expiry": warranty_expiry,
            "warranty_remaining_days": warranty_remaining_days,
            "under_warranty": under_warranty,
            "regulatory_status": chem_config["regulatory_status"],
            "recycled_content_pct": chem_config["recycled_content_pct"],
        },
        "recycling": {
            "eligible_for_recycling": recycle_now or health.current_soh < 80.0,
            "end_of_life_soh_threshold": eol_threshold_soh,
            "recycling_efficiency_pct": chem_config["recycling_efficiency_pct"],
            "recoverable_materials": recoverable_materials,
            "recommended_action": (
                "Immediate recycling recommended — SoH below threshold. Estimated recovery value: " +
                f"₹{int(sum(v * 5000 for v in recoverable_materials.values())):,.0f}"
            ) if recycle_now else "Continue monitoring. Battery still above end-of-life threshold.",
        },
        "soh_forecast": forecast,
    }
