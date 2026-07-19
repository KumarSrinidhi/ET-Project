"""Business analytics: cohort analysis, TCO trends, vendor scorecards, carbon credit market.
"""
import math
import time
from datetime import datetime, timedelta
from typing import List, Dict
from pydantic import BaseModel


# ─── Cohort Analysis ──────────────────────────────────────────────────────────

def cohort_analysis_by_age() -> Dict:
    """Group vehicles by age cohort and compare SoH/degradation metrics.
    Uses deterministic vehicle IDs EV-001..EV-010 as synthetic 'purchase year' cohorts."""
    from apm_models import generate_fleet_telemetry
    fleet = generate_fleet_telemetry()

    # Map vehicle index to synthetic purchase year (newer vehicles have higher numbers)
    # In a real system, this comes from a vehicles table
    cohorts = {}
    for vid, health in fleet.items():
        idx = int(vid.split("-")[1])
        if idx <= 3:
            year = 2021  # oldest
            label = "2021 (3+ yr)"
        elif idx <= 6:
            year = 2022
            label = "2022 (2-3 yr)"
        elif idx <= 8:
            year = 2023
            label = "2023 (1-2 yr)"
        else:
            year = 2024
            label = "2024 (<1 yr)"

        cohorts.setdefault(year, {"label": label, "vehicles": [], "soh_values": [], "deg_rates": []})
        cohorts[year]["vehicles"].append(vid)
        cohorts[year]["soh_values"].append(health.current_soh)
        cohorts[year]["deg_rates"].append(health.degradation_rate_per_day)

    rows = []
    for year in sorted(cohorts.keys()):
        c = cohorts[year]
        avg_soh = sum(c["soh_values"]) / len(c["soh_values"])
        avg_deg = sum(c["deg_rates"]) / len(c["deg_rates"])
        rows.append({
            "cohort_year": year,
            "label": c["label"],
            "vehicle_count": len(c["vehicles"]),
            "avg_soh": round(avg_soh, 2),
            "avg_degradation_rate": round(avg_deg, 4),
            "interpretation": (
                f"Cohort average {avg_soh:.1f}% SoH with {avg_deg:.4f}/day degradation."
            ),
        })

    # Insight: is the oldest cohort degrading fastest?
    if len(rows) >= 2:
        oldest = rows[0]
        newest = rows[-1]
        delta = oldest["avg_soh"] - newest["avg_soh"]
        insight = (
            f"Oldest cohort ({oldest['label']}) shows SoH {delta:+.2f}% vs newest. "
            + ("Normal aging pattern." if delta > 0 else "Anomaly — newer vehicles degrading faster.")
        )
    else:
        insight = "Insufficient cohort data."

    return {"cohorts": rows, "insight": insight}


# ─── TCO Trend Over Time ────────────────────────────────────────────────────

def tco_trend(months: int = 12) -> Dict:
    """Synthesize a 12-month TCO-per-km trend based on current fleet state.
    Uses the deterministic current fleet to back-cast trend with seasonal noise."""
    from apm_models import generate_fleet_telemetry
    fleet = generate_fleet_telemetry()

    # Compute current per-km cost from fleet
    # Indian market: electricity ~₹8/kWh, maintenance ~₹0.30/km, depreciation ~₹1.20/km
    current_cost_per_km = 8.0 / 5 + 0.30 + 1.20  # ~₹3.10/km for EV

    now = datetime.utcnow()
    history = []
    for i in range(months):
        # Seasonal: winter (Dec-Feb) sees 8% cost increase from heating losses
        month_date = now - timedelta(days=30 * (months - 1 - i))
        seasonal = 1.08 if month_date.month in [12, 1, 2] else 1.0
        # Slight efficiency improvement over time (battery tech improvement ~0.5%/month)
        tech_improvement = 1.0 - (0.005 * (months - 1 - i))
        cost = current_cost_per_km * seasonal * tech_improvement
        history.append({
            "month": month_date.strftime("%Y-%m"),
            "cost_per_km_inr": round(cost, 2),
            "delta_from_baseline_pct": round((cost / current_cost_per_km - 1) * 100, 2),
        })

    latest = history[-1]["cost_per_km_inr"]
    earliest = history[0]["cost_per_km_inr"]
    trend_pct = round((latest - earliest) / earliest * 100, 2)

    return {
        "history": history,
        "current_cost_per_km_inr": latest,
        "trend_pct_12mo": trend_pct,
        "interpretation": (
            f"TCO trending {'down' if trend_pct < 0 else 'up'} {abs(trend_pct):.1f}% over the last {months} months. "
            f"Current ₹{latest:.2f}/km."
        ),
    }


# ─── Vendor Scorecard ────────────────────────────────────────────────────────

def vendor_scorecard() -> Dict:
    """Quarterly scorecard for Tier 1-3 suppliers. Combines delivery, ESG, defect rate."""
    from supply_chain import get_base_nodes_lazy
    from quality_intelligence import generate_inspection_records

    nodes = get_base_nodes_lazy()
    inspections = generate_inspection_records()

    # Aggregate inspection data per supplier
    supplier_quality = {}
    for r in inspections:
        # Inspections use supplier names from quality_intelligence; supply_chain uses entity_name
        s = r.supplier
        supplier_quality.setdefault(s, {"batches": 0, "defects": 0, "scores": []})
        supplier_quality[s]["batches"] += 1
        supplier_quality[s]["defects"] += r.defects_found
        supplier_quality[s]["scores"].append(r.quality_score)

    rows = []
    for node in nodes:
        sq = supplier_quality.get(node.entity_name, {})
        batches = sq.get("batches", 0)
        defects = sq.get("defects", 0)
        avg_quality = sum(sq.get("scores", [75])) / max(len(sq.get("scores", [1])), 1)
        defect_rate = (defects / max(batches * 100, 1)) * 1_000_000 if batches else 0

        # Composite score (0-100): weighted blend
        # Quality 40%, ESG 30%, Lead time reliability 20%, Risk 10%
        esg = node.esg_score * 10  # already 0-10 scale
        # Lead time reliability: shorter lead time = more reliable (capped at 14 days = 100%)
        lead_time_score = max(0, 100 - max(0, node.lead_time_days - 14) * 2)
        # Risk: lower composite risk = better score (1-10 scale inverted to 0-100)
        risk_score = (10 - node.composite_risk) * 10

        composite = round(
            avg_quality * 0.40 +
            esg * 0.30 +
            lead_time_score * 0.20 +
            risk_score * 0.10,
            1,
        )

        # Letter grade
        if composite >= 85: grade = "A"
        elif composite >= 70: grade = "B"
        elif composite >= 55: grade = "C"
        else: grade = "D"

        rows.append({
            "supplier": node.entity_name,
            "country": node.country,
            "tier": node.tier,
            "material": node.material,
            "batches_inspected": batches,
            "defect_rate_ppm": round(defect_rate, 1),
            "avg_quality_score": round(avg_quality, 1),
            "esg_score": round(node.esg_score, 1),
            "lead_time_days": node.lead_time_days,
            "composite_risk": round(node.composite_risk, 1),
            "composite_score": composite,
            "grade": grade,
            "recommendation": (
                "Renew contract — top performer." if grade == "A" else
                "Monitor — meets requirements." if grade == "B" else
                "Audit required — below threshold." if grade == "C" else
                "Replace — failing performance."
            ),
        })

    rows.sort(key=lambda r: -r["composite_score"])

    return {
        "quarter": f"Q{((datetime.utcnow().month - 1) // 3) + 1} {datetime.utcnow().year}",
        "vendors": rows,
        "summary": {
            "total_suppliers": len(rows),
            "grade_a_count": sum(1 for r in rows if r["grade"] == "A"),
            "grade_d_count": sum(1 for r in rows if r["grade"] == "D"),
            "avg_score": round(sum(r["composite_score"] for r in rows) / max(len(rows), 1), 1),
        },
    }


# ─── Carbon Credit Marketplace ─────────────────────────────────────────────

def carbon_credit_marketplace() -> Dict:
    """Convert avoided emissions to tradeable carbon credits with ₹ valuation.
    Indian carbon market: ~₹800-1500 per tonne CO2 (2025 estimate)."""
    from carbon_tracker import generate_net_zero_report
    report = generate_net_zero_report()
    avoided = report.kpis.avoided_emissions_tons
    offset_purchased = report.kpis.offset_credits_tons

    # Net tradable = avoided - already purchased
    net_tradable = max(0, avoided - offset_purchased)

    # Market pricing scenarios
    price_low = 800      # ₹/tCO2 (compliance market floor)
    price_mid = 1200     # voluntary market average
    price_high = 1800    # premium / removal credits

    return {
        "fleet_id": "EV-Fleet-2026",
        "avoided_emissions_tons": avoided,
        "offset_credits_purchased_tons": offset_purchased,
        "net_tradable_credits_tons": round(net_tradable, 1),
        "valuation": {
            "conservative_inr": round(net_tradable * price_low, 0),
            "market_inr": round(net_tradable * price_mid, 0),
            "premium_inr": round(net_tradable * price_high, 0),
        },
        "market_data": {
            "price_low_inr_per_ton": price_low,
            "price_mid_inr_per_ton": price_mid,
            "price_high_inr_per_ton": price_high,
            "source": "Indian Carbon Market (ICX) indicative pricing 2025",
        },
        "equivalent_impact": {
            "passenger_cars_off_road_1yr": round(net_tradable / 4.6, 0),  # avg car emits ~4.6t/yr
            "homes_electricity_1yr": round(net_tradable / 4.0, 0),  # avg home ~4t/yr
            "flights_delhi_mumbai": round(net_tradable / 0.15, 0),  # ~150kg per flight
        },
        "recommendation": (
            f"You have {round(net_tradable, 0)} tonnes of net tradable avoided emissions. "
            f"At market rates (₹{price_mid}/t), this is worth ₹{round(net_tradable * price_mid, 0):,}."
        ),
    }
