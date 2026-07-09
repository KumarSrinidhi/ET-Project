"""
Feature 4: EV Supply Chain Risk & Traceability Agent
Run:  python feature4.py
URL:  http://localhost:8002
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime
import random, uuid

random.seed(42)
app = FastAPI(title="Feature 4 — Supply Chain Risk & Traceability", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ═══════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════

class BatteryChemistry(str, Enum):
    LFP = "LFP"
    NMC = "NMC"

class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

class SupplierTier(str, Enum):
    TIER1 = "Tier 1 - Cell/Pack"
    TIER2 = "Tier 2 - Materials"
    TIER3 = "Tier 3 - Mining"

class BatteryPack(BaseModel):
    id: str; chemistry: BatteryChemistry; capacity_kwh: float; manufacturer: str
    tier1_supplier_id: str; cathode_supplier_id: str; anode_supplier_id: str
    lithium_source_id: str; cobalt_source_id: Optional[str] = None
    nickel_source_id: Optional[str] = None; graphite_source_id: str

class Supplier(BaseModel):
    id: str; name: str; tier: SupplierTier; country: str; lat: float; lng: float
    specialization: str; materials: list[str]; supplies_to: list[str]; sourced_from: list[str]
    geopolitical_risk: float; financial_risk: float; quality_risk: float
    concentration_risk: float; esg_risk: float; lead_time_risk: float
    overall_risk: float; risk_level: RiskLevel; revenue_musd: float
    defect_ppm: float; lead_time_days: float; lead_time_var_days: float
    certifications: list[str]; esg_score: float; notes: str

class TraceNode(BaseModel):
    supplier: Supplier; materials: list[str]; risk_contribution: float

class TraceabilityPath(BaseModel):
    pack_id: str; chemistry: BatteryChemistry; tier1: TraceNode
    tier2: list[TraceNode]; tier3: list[TraceNode]
    aggregated_risk: float; risk_by_category: dict; critical_path: list[str]

class Alert(BaseModel):
    id: str; severity: RiskLevel; category: str; supplier_id: str
    supplier_name: str; message: str; affected_packs: list[str]; recommendation: str
    timestamp: datetime

class AnalysisResponse(BaseModel):
    query_type: str; subject_id: str; subject_name: str
    findings: list[dict]; recommendation: str; key_metrics: dict

# ═══════════════════════════════════════════════════════════
# SYNTHETIC DATA
# ═══════════════════════════════════════════════════════════

RAW_SUPPLIERS = [
    {"id":"S-T1-01","name":"CATL","tier":"Tier 1 - Cell/Pack","country":"China","lat":26.07,"lng":119.30,
     "spec":"LFP & NMC Cells","materials":["LFP Cells","NMC Cells"],"supplies_to":[],"sourced_from":["S-T2-01","S-T2-02","S-T2-03","S-T2-05"],
     "geo":55,"fin":25,"qual":20,"conc":35,"esg":50,"lt":30,"rev":42000,"ppm":45,"lt_d":28,"lt_v":5,
     "certs":["ISO 9001","IATF 16949","ISO 14001"],"esg_s":62,"notes":"World's largest battery maker. Heavy China concentration risk."},
    {"id":"S-T1-02","name":"BYD FinDreams","tier":"Tier 1 - Cell/Pack","country":"China","lat":22.54,"lng":114.06,
     "spec":"LFP Blade Cells","materials":["LFP Cells"],"supplies_to":[],"sourced_from":["S-T2-01","S-T2-03","S-T2-05"],
     "geo":55,"fin":20,"qual":25,"conc":50,"esg":55,"lt":25,"rev":18000,"ppm":55,"lt_d":25,"lt_v":4,
     "certs":["ISO 9001","ISO 14001"],"esg_s":58,"notes":"Vertical integration advantage. LFP specialist, no cobalt/nickel."},
    {"id":"S-T1-03","name":"LG Energy Solution","tier":"Tier 1 - Cell/Pack","country":"South Korea","lat":37.26,"lng":127.03,
     "spec":"NMC Cells","materials":["NMC Cells"],"supplies_to":[],"sourced_from":["S-T2-02","S-T2-04","S-T2-06"],
     "geo":30,"fin":20,"qual":15,"conc":30,"esg":25,"lt":25,"rev":22000,"ppm":30,"lt_d":35,"lt_v":7,
     "certs":["ISO 9001","IATF 16949","ISO 14001","SA8000"],"esg_s":78,"notes":"Strong quality. NMC-focused with diversified sourcing."},
    {"id":"S-T1-04","name":"Panasonic Energy","tier":"Tier 1 - Cell/Pack","country":"Japan","lat":34.69,"lng":135.50,
     "spec":"NMC Cells","materials":["NMC Cells"],"supplies_to":[],"sourced_from":["S-T2-02","S-T2-04","S-T2-06"],
     "geo":20,"fin":25,"qual":10,"conc":35,"esg":15,"lt":20,"rev":15000,"ppm":20,"lt_d":40,"lt_v":8,
     "certs":["ISO 9001","IATF 16949","ISO 14001"],"esg_s":85,"notes":"Premium quality, Tesla supplier. Aging workforce concern."},
    {"id":"S-T1-05","name":"SK On","tier":"Tier 1 - Cell/Pack","country":"South Korea","lat":36.35,"lng":127.39,
     "spec":"NMC Cells","materials":["NMC Cells"],"supplies_to":[],"sourced_from":["S-T2-02","S-T2-04","S-T2-06"],
     "geo":30,"fin":40,"qual":25,"conc":30,"esg":25,"lt":30,"rev":8000,"ppm":40,"lt_d":35,"lt_v":6,
     "certs":["ISO 9001","IATF 16949"],"esg_s":75,"notes":"Rapidly scaling. Higher financial risk from expansion capex."},
    {"id":"S-T2-01","name":"Ecopro BM","tier":"Tier 2 - Materials","country":"South Korea","lat":37.40,"lng":126.88,
     "spec":"LFP Cathode","materials":["LFP Cathode"],"supplies_to":["S-T1-01","S-T1-02"],"sourced_from":["S-T3-01","S-T3-04"],
     "geo":30,"fin":30,"qual":25,"conc":40,"esg":20,"lt":30,"rev":3500,"ppm":60,"lt_d":30,"lt_v":5,
     "certs":["ISO 9001"],"esg_s":72,"notes":"Growing LFP cathode producer. Lithium sourcing concentrated."},
    {"id":"S-T2-02","name":"Umicore","tier":"Tier 2 - Materials","country":"Belgium","lat":50.63,"lng":5.58,
     "spec":"NMC Cathode","materials":["NMC Cathode"],"supplies_to":["S-T1-01","S-T1-03","S-T1-04","S-T1-05"],"sourced_from":["S-T3-02","S-T3-05","S-T3-07"],
     "geo":25,"fin":15,"qual":15,"conc":25,"esg":15,"lt":25,"rev":5000,"ppm":35,"lt_d":35,"lt_v":6,
     "certs":["ISO 9001","IATF 16949","ISO 14001","SA8000"],"esg_s":88,"notes":"Best-in-class ESG. Diversified sourcing. Premium pricing."},
    {"id":"S-T2-03","name":"BTR New Material","tier":"Tier 2 - Materials","country":"China","lat":22.55,"lng":114.10,
     "spec":"Anode Material","materials":["Graphite Anode"],"supplies_to":["S-T1-01","S-T1-02"],"sourced_from":["S-T3-10","S-T3-11"],
     "geo":55,"fin":25,"qual":30,"conc":45,"esg":50,"lt":30,"rev":2500,"ppm":70,"lt_d":25,"lt_v":4,
     "certs":["ISO 9001","ISO 14001"],"esg_s":60,"notes":"Dominant anode supplier. China graphite dependency."},
    {"id":"S-T2-04","name":"Showa Denko","tier":"Tier 2 - Materials","country":"Japan","lat":35.65,"lng":139.74,
     "spec":"Anode Material","materials":["Graphite Anode","Silicon Anode"],"supplies_to":["S-T1-03","S-T1-04","S-T1-05"],"sourced_from":["S-T3-10","S-T3-11"],
     "geo":20,"fin":20,"qual":15,"conc":40,"esg":15,"lt":20,"rev":1800,"ppm":25,"lt_d":40,"lt_v":7,
     "certs":["ISO 9001","IATF 16949"],"esg_s":82,"notes":"High-purity anode. Expensive but reliable."},
    {"id":"S-T2-05","name":"Capchem","tier":"Tier 2 - Materials","country":"China","lat":22.72,"lng":113.84,
     "spec":"Electrolyte","materials":["Electrolyte"],"supplies_to":["S-T1-01","S-T1-02"],"sourced_from":["S-T3-01"],
     "geo":55,"fin":20,"qual":25,"conc":35,"esg":50,"lt":25,"rev":1200,"ppm":50,"lt_d":20,"lt_v":3,
     "certs":["ISO 9001"],"esg_s":58,"notes":"Electrolyte specialist. Lithium salt dependency."},
    {"id":"S-T2-06","name":"Tinci Materials","tier":"Tier 2 - Materials","country":"China","lat":23.13,"lng":113.26,
     "spec":"Electrolyte","materials":["Electrolyte"],"supplies_to":["S-T1-03","S-T1-04","S-T1-05"],"sourced_from":["S-T3-01"],
     "geo":55,"fin":30,"qual":30,"conc":40,"esg":50,"lt":30,"rev":900,"ppm":65,"lt_d":22,"lt_v":4,
     "certs":["ISO 9001"],"esg_s":55,"notes":"Growing electrolyte supplier. Quality improving."},
    {"id":"S-T3-01","name":"SQM","tier":"Tier 3 - Mining","country":"Chile","lat":-23.85,"lng":-70.43,
     "spec":"Lithium Extraction","materials":["Lithium"],"supplies_to":["S-T2-01","S-T2-05","S-T2-06"],"sourced_from":[],
     "geo":40,"fin":25,"qual":20,"conc":30,"esg":45,"lt":35,"rev":8000,"ppm":80,"lt_d":45,"lt_v":10,
     "certs":["ISO 14001"],"esg_s":55,"notes":"Salar de Atacama lithium. Water usage controversy. Chile nationalization risk."},
    {"id":"S-T3-02","name":"Albemarle","tier":"Tier 3 - Mining","country":"USA","lat":35.23,"lng":-80.84,
     "spec":"Lithium Extraction","materials":["Lithium"],"supplies_to":["S-T2-02"],"sourced_from":[],
     "geo":15,"fin":20,"qual":20,"conc":25,"esg":15,"lt":20,"rev":9500,"ppm":75,"lt_d":50,"lt_v":12,
     "certs":["ISO 9001","ISO 14001","IRMA"],"esg_s":82,"notes":"Diversified (Chile, Australia, US). Best ESG in lithium mining."},
    {"id":"S-T3-03","name":"Pilbara Minerals","tier":"Tier 3 - Mining","country":"Australia","lat":-21.68,"lng":119.15,
     "spec":"Lithium Extraction","materials":["Lithium"],"supplies_to":[],"sourced_from":[],
     "geo":10,"fin":30,"qual":20,"conc":30,"esg":15,"lt":20,"rev":3500,"ppm":70,"lt_d":55,"lt_v":8,
     "certs":["ISO 14001"],"esg_s":80,"notes":"Hard rock lithium. Stable jurisdiction but long shipping to Asia."},
    {"id":"S-T3-04","name":"Ganfeng Lithium","tier":"Tier 3 - Mining","country":"China","lat":27.78,"lng":115.35,
     "spec":"Lithium Extraction","materials":["Lithium"],"supplies_to":["S-T2-01"],"sourced_from":[],
     "geo":55,"fin":35,"qual":30,"conc":40,"esg":50,"lt":35,"rev":6000,"ppm":85,"lt_d":30,"lt_v":5,
     "certs":["ISO 9001"],"esg_s":52,"notes":"Integrated lithium player. China policy risk."},
    {"id":"S-T3-05","name":"Glencore","tier":"Tier 3 - Mining","country":"Switzerland","lat":46.20,"lng":6.14,
     "spec":"Cobalt Mining","materials":["Cobalt"],"supplies_to":["S-T2-02"],"sourced_from":[],
     "geo":70,"fin":20,"qual":30,"conc":20,"esg":75,"lt":40,"rev":220000,"ppm":90,"lt_d":50,"lt_v":15,
     "certs":["ISO 14001","RMI RMAP"],"esg_s":40,"notes":"DRC cobalt via industrial mining. ESG concerns persist despite certifications."},
    {"id":"S-T3-06","name":"CMOC Group","tier":"Tier 3 - Mining","country":"China","lat":34.75,"lng":113.65,
     "spec":"Cobalt & Copper Mining","materials":["Cobalt","Copper"],"supplies_to":[],"sourced_from":[],
     "geo":72,"fin":25,"qual":35,"conc":25,"esg":70,"lt":40,"rev":25000,"ppm":95,"lt_d":45,"lt_v":12,
     "certs":["ISO 9001"],"esg_s":38,"notes":"DRC operations. High ESG risk. Expanding copper-cobalt output."},
    {"id":"S-T3-07","name":"PT Vale Indonesia","tier":"Tier 3 - Mining","country":"Indonesia","lat":-1.12,"lng":103.92,
     "spec":"Nickel Mining","materials":["Nickel"],"supplies_to":["S-T2-02"],"sourced_from":[],
     "geo":60,"fin":35,"qual":30,"conc":25,"esg":50,"lt":40,"rev":4000,"ppm":80,"lt_d":40,"lt_v":10,
     "certs":["ISO 14001"],"esg_s":48,"notes":"Indonesian nickel ore. Export ban policy risk. Downstream processing push."},
    {"id":"S-T3-08","name":"Tsingshan Holding","tier":"Tier 3 - Mining","country":"China","lat":28.00,"lng":120.67,
     "spec":"Nickel & Stainless","materials":["Nickel"],"supplies_to":[],"sourced_from":[],
     "geo":58,"fin":30,"qual":35,"conc":30,"esg":55,"lt":35,"rev":55000,"ppm":85,"lt_d":35,"lt_v":8,
     "certs":["ISO 9001"],"esg_s":45,"notes":"Massive Indonesian nickel operations. Price volatility exposure."},
    {"id":"S-T3-09","name":"Nornickel","tier":"Tier 3 - Mining","country":"Russia","lat":69.35,"lng":88.20,
     "spec":"Nickel & Palladium Mining","materials":["Nickel"],"supplies_to":[],"sourced_from":[],
     "geo":85,"fin":50,"qual":25,"conc":20,"esg":80,"lt":55,"rev":12000,"ppm":70,"lt_d":60,"lt_v":20,
     "certs":["ISO 14001"],"esg_s":22,"notes":"Sanctions risk. Arctic operations. Environmental incidents history."},
    {"id":"S-T3-10","name":"Syrah Resources","tier":"Tier 3 - Mining","country":"Australia","lat":-32.05,"lng":115.88,
     "spec":"Graphite Mining","materials":["Graphite"],"supplies_to":["S-T2-03","S-T2-04"],"sourced_from":[],
     "geo":15,"fin":45,"qual":30,"conc":35,"esg":20,"lt":30,"rev":400,"ppm":75,"lt_d":50,"lt_v":10,
     "certs":["ISO 14001"],"esg_s":75,"notes":"Balama graphite mine. Scaling up. Financial risk from ramp-up."},
    {"id":"S-T3-11","name":"SGL Carbon","tier":"Tier 3 - Mining","country":"Germany","lat":51.01,"lng":7.56,
     "spec":"Graphite Processing","materials":["Graphite"],"supplies_to":["S-T2-03","S-T2-04"],"sourced_from":[],
     "geo":12,"fin":25,"qual":15,"conc":30,"esg":10,"lt":20,"rev":1800,"ppm":40,"lt_d":35,"lt_v":5,
     "certs":["ISO 9001","IATF 16949","ISO 14001"],"esg_s":90,"notes":"Synthetic & natural graphite. Premium quality. EU supply security."},
]

RISK_WEIGHTS = {"geo":0.25, "fin":0.20, "qual":0.20, "conc":0.15, "esg":0.10, "lt":0.10}

def _build_suppliers() -> dict[str, Supplier]:
    suppliers = {}
    for s in RAW_SUPPLIERS:
        overall = sum(s[k] * w for k, w in RISK_WEIGHTS.items())
        rl = RiskLevel.CRITICAL if overall >= 65 else RiskLevel.HIGH if overall >= 45 else RiskLevel.MEDIUM if overall >= 28 else RiskLevel.LOW
        suppliers[s["id"]] = Supplier(
            id=s["id"], name=s["name"], tier=SupplierTier(s["tier"]), country=s["country"],
            lat=s["lat"], lng=s["lng"], specialization=s["spec"], materials=s["materials"],
            supplies_to=s["supplies_to"], sourced_from=s["sourced_from"],
            geopolitical_risk=s["geo"], financial_risk=s["fin"], quality_risk=s["qual"],
            concentration_risk=s["conc"], esg_risk=s["esg"], lead_time_risk=s["lt"],
            overall_risk=round(overall, 1), risk_level=rl, revenue_musd=s["rev"],
            defect_ppm=s["ppm"], lead_time_days=s["lt_d"], lead_time_var_days=s["lt_v"],
            certifications=s["certs"], esg_score=s["esg_s"], notes=s["notes"]
        )
    return suppliers

SUPPLIERS = _build_suppliers()

BATTERY_PACKS = {
    "BP-001": BatteryPack(id="BP-001", chemistry=BatteryChemistry.LFP, capacity_kwh=60,
        manufacturer="CATL", tier1_supplier_id="S-T1-01", cathode_supplier_id="S-T2-01",
        anode_supplier_id="S-T2-03", lithium_source_id="S-T3-01",
        cobalt_source_id=None, nickel_source_id=None, graphite_source_id="S-T3-10"),
    "BP-002": BatteryPack(id="BP-002", chemistry=BatteryChemistry.NMC, capacity_kwh=82,
        manufacturer="LG Energy", tier1_supplier_id="S-T1-03", cathode_supplier_id="S-T2-02",
        anode_supplier_id="S-T2-04", lithium_source_id="S-T3-02",
        cobalt_source_id="S-T3-05", nickel_source_id="S-T3-07", graphite_source_id="S-T3-11"),
    "BP-003": BatteryPack(id="BP-003", chemistry=BatteryChemistry.LFP, capacity_kwh=94,
        manufacturer="CATL", tier1_supplier_id="S-T1-01", cathode_supplier_id="S-T2-01",
        anode_supplier_id="S-T2-03", lithium_source_id="S-T3-01",
        cobalt_source_id=None, nickel_source_id=None, graphite_source_id="S-T3-10"),
    "BP-004": BatteryPack(id="BP-004", chemistry=BatteryChemistry.LFP, capacity_kwh=141,
        manufacturer="BYD", tier1_supplier_id="S-T1-02", cathode_supplier_id="S-T2-01",
        anode_supplier_id="S-T2-03", lithium_source_id="S-T3-04",
        cobalt_source_id=None, nickel_source_id=None, graphite_source_id="S-T3-10"),
    "BP-005": BatteryPack(id="BP-005", chemistry=BatteryChemistry.NMC, capacity_kwh=350,
        manufacturer="SK On", tier1_supplier_id="S-T1-05", cathode_supplier_id="S-T2-02",
        anode_supplier_id="S-T2-04", lithium_source_id="S-T3-02",
        cobalt_source_id="S-T3-05", nickel_source_id="S-T3-07", graphite_source_id="S-T3-11"),
    "BP-006": BatteryPack(id="BP-006", chemistry=BatteryChemistry.NMC, capacity_kwh=525,
        manufacturer="Panasonic", tier1_supplier_id="S-T1-04", cathode_supplier_id="S-T2-02",
        anode_supplier_id="S-T2-04", lithium_source_id="S-T3-02",
        cobalt_source_id="S-T3-05", nickel_source_id="S-T3-07", graphite_source_id="S-T3-11"),
}

# ═══════════════════════════════════════════════════════════
# TRACEABILITY ENGINE
# ═══════════════════════════════════════════════════════════

def build_traceability(pack_id: str) -> TraceabilityPath:
    pack = BATTERY_PACKS.get(pack_id)
    if not pack: raise HTTPException(404, f"Battery pack {pack_id} not found")
    t1 = SUPPLIERS.get(pack.tier1_supplier_id)
    if not t1: raise HTTPException(500, f"Tier 1 supplier {pack.tier1_supplier_id} not found")

    t2_ids = {pack.cathode_supplier_id, pack.anode_supplier_id}
    t3_ids = {pack.lithium_source_id, pack.graphite_source_id}
    if pack.cobalt_source_id: t3_ids.add(pack.cobalt_source_id)
    if pack.nickel_source_id: t3_ids.add(pack.nickel_source_id)
    for t2id in list(t2_ids):
        s = SUPPLIERS.get(t2id)
        if s:
            for sid in s.sourced_from:
                if sid in SUPPLIERS: t3_ids.add(sid)

    t2_nodes = []
    mat_map = {pack.cathode_supplier_id: "Cathode", pack.anode_supplier_id: "Anode"}
    for t2id in t2_ids:
        s = SUPPLIERS.get(t2id)
        if s: t2_nodes.append(TraceNode(supplier=s, materials=[mat_map.get(t2id, s.specialization)], risk_contribution=s.overall_risk))
    t3_nodes = []
    for t3id in t3_ids:
        s = SUPPLIERS.get(t3id)
        if s: t3_nodes.append(TraceNode(supplier=s, materials=s.materials, risk_contribution=s.overall_risk))

    all_nodes = [TraceNode(supplier=t1, materials=["Cell/Pack"], risk_contribution=t1.overall_risk)] + t2_nodes + t3_nodes
    if all_nodes:
        weights = [0.15] + [0.20] * len(t2_nodes) + [0.65 / max(1, len(t3_nodes))] * len(t3_nodes)
        tw = sum(weights)
        agg_risk = round(sum(n.risk_contribution * w for n, w in zip(all_nodes, weights)) / tw, 1)
    else:
        agg_risk = 0

    cats = ["geopolitical_risk","financial_risk","quality_risk","concentration_risk","esg_risk","lead_time_risk"]
    risk_by_cat = {}
    for cat in cats:
        vals = [getattr(n.supplier, cat) for n in all_nodes]
        risk_by_cat[cat.replace("_risk","").replace("_"," ").title()] = round(max(vals), 1) if vals else 0

    critical = [t1.id]
    if t2_nodes: critical.append(max(t2_nodes, key=lambda n: n.risk_contribution).supplier.id)
    if t3_nodes: critical.append(max(t3_nodes, key=lambda n: n.risk_contribution).supplier.id)

    return TraceabilityPath(pack_id=pack_id, chemistry=pack.chemistry, tier1=all_nodes[0],
        tier2=t2_nodes, tier3=t3_nodes, aggregated_risk=agg_risk,
        risk_by_category=risk_by_cat, critical_path=critical)

TRACEABILITY = {pid: build_traceability(pid) for pid in BATTERY_PACKS}

# ═══════════════════════════════════════════════════════════
# ALERT GENERATION
# ═══════════════════════════════════════════════════════════

def _generate_alerts() -> list[Alert]:
    alerts = []
    for s in SUPPLIERS.values():
        if s.overall_risk >= 45:
            affected = [pid for pid, p in BATTERY_PACKS.items()
                        if p.tier1_supplier_id == s.id or p.cathode_supplier_id == s.id
                        or p.anode_supplier_id == s.id or p.lithium_source_id == s.id
                        or p.cobalt_source_id == s.id or p.nickel_source_id == s.id
                        or p.graphite_source_id == s.id]
            if s.geopolitical_risk >= 70:
                alerts.append(Alert(id=str(uuid.uuid4())[:8], severity=RiskLevel.CRITICAL,
                    category="Geopolitical", supplier_id=s.id, supplier_name=s.name,
                    message=f"High geopolitical risk ({s.geopolitical_risk}/100) for {s.name} in {s.country}. Regulatory changes or trade restrictions could disrupt supply.",
                    affected_packs=affected,
                    recommendation=f"Qualify alternative suppliers in lower-risk jurisdictions. Build 3-6 month safety stock.", timestamp=datetime.utcnow()))
            if s.financial_risk >= 40:
                alerts.append(Alert(id=str(uuid.uuid4())[:8], severity=RiskLevel.HIGH,
                    category="Financial", supplier_id=s.id, supplier_name=s.name,
                    message=f"Elevated financial risk ({s.financial_risk}/100) for {s.name}. Revenue: ${s.revenue_musd}M.",
                    affected_packs=affected,
                    recommendation="Reduce order concentration. Establish escrow for prepayments.", timestamp=datetime.utcnow()))
            if s.esg_risk >= 60:
                alerts.append(Alert(id=str(uuid.uuid4())[:8], severity=RiskLevel.HIGH,
                    category="ESG", supplier_id=s.id, supplier_name=s.name,
                    message=f"ESG compliance risk ({s.esg_risk}/100) for {s.name}. ESG score: {s.esg_score}/100.",
                    affected_packs=affected,
                    recommendation="Request updated ESG audit. Assess EU Battery Regulation impact.", timestamp=datetime.utcnow()))
            if s.concentration_risk >= 45:
                alerts.append(Alert(id=str(uuid.uuid4())[:8], severity=RiskLevel.HIGH,
                    category="Concentration", supplier_id=s.id, supplier_name=s.name,
                    message=f"High single-source concentration risk ({s.concentration_risk}/100) for {s.name}.",
                    affected_packs=affected,
                    recommendation="Qualify 2+ alternative sources for this material/component.", timestamp=datetime.utcnow()))
    return alerts

ALERTS = _generate_alerts()

# ═══════════════════════════════════════════════════════════
# AGENT ANALYSIS
# ═══════════════════════════════════════════════════════════

def _analyze_supplier(sid: str) -> AnalysisResponse:
    s = SUPPLIERS.get(sid)
    if not s: raise HTTPException(404, f"Supplier {sid} not found")
    findings = []
    risks = {"Geopolitical": s.geopolitical_risk, "Financial": s.financial_risk, "Quality": s.quality_risk,
             "Concentration": s.concentration_risk, "ESG": s.esg_risk, "Lead Time": s.lead_time_risk}
    for name, val in sorted(risks.items(), key=lambda x: -x[1]):
        if val >= 50:
            findings.append({"type":"risk","area":name,"detail":f"{name} risk is elevated at {val}/100. Requires immediate mitigation."})
        elif val >= 30:
            findings.append({"type":"warning","area":name,"detail":f"{name} risk is moderate at {val}/100. Monitor and review quarterly."})
    downstream_packs = [pid for pid, p in BATTERY_PACKS.items()
                        if p.tier1_supplier_id == sid or p.cathode_supplier_id == sid
                        or p.anode_supplier_id == sid or p.lithium_source_id == sid
                        or p.cobalt_source_id == sid or p.nickel_source_id == sid
                        or p.graphite_source_id == sid]
    findings.append({"type":"impact","area":"Downstream","detail":
        f"Disruption to {s.name} affects {len(downstream_packs)} battery pack(s): {', '.join(downstream_packs)}. "
        f"These packs are referenced by Fleet Readiness (Feature 1) EV candidates."})
    upstream = [SUPPLIERS[uid].name for uid in s.sourced_from if uid in SUPPLIERS]
    if upstream:
        findings.append({"type":"info","area":"Upstream","detail":f"Sourced from: {', '.join(upstream)}."})
    rec = (f"{'CRITICAL: Immediate action required' if s.overall_risk >= 60 else 'Monitor closely' if s.overall_risk >= 40 else 'Acceptable risk — maintain current oversight'} "
       f"for {s.name}. ")
    if s.concentration_risk >= 40: rec += "Qualify secondary sources. "
    if s.esg_risk >= 50: rec += "Initiate ESG remediation dialogue. "
    if s.geopolitical_risk >= 60: rec += "Evaluate nearshoring/friendshoring alternatives. "
    return AnalysisResponse(query_type="supplier_risk", subject_id=sid, subject_name=s.name,
        findings=findings, recommendation=rec,
        key_metrics={"overall_risk": s.overall_risk, "defect_ppm": s.defect_ppm,
                     "lead_time_days": s.lead_time_days, "esg_score": s.esg_score,
                     "affected_packs": len(downstream_packs), "tier": s.tier.value})

# ═══════════════════════════════════════════════════════════
# API ROUTES
# ═══════════════════════════════════════════════════════════

@app.get("/api/summary")
def summary():
    crit = sum(1 for s in SUPPLIERS.values() if s.risk_level == RiskLevel.CRITICAL)
    high = sum(1 for s in SUPPLIERS.values() if s.risk_level == RiskLevel.HIGH)
    med = sum(1 for s in SUPPLIERS.values() if s.risk_level == RiskLevel.MEDIUM)
    low = len(SUPPLIERS) - crit - high - med
    avg_risk = sum(s.overall_risk for s in SUPPLIERS.values()) / len(SUPPLIERS)
    avg_esg = sum(s.esg_score for s in SUPPLIERS.values()) / len(SUPPLIERS)
    avg_ppm = sum(s.defect_ppm for s in SUPPLIERS.values()) / len(SUPPLIERS)
    by_tier = {}
    for s in SUPPLIERS.values():
        t = s.tier.value.split(" - ")[0]
        if t not in by_tier: by_tier[t] = {"total":0,"avg_risk":[],"by_level":{"Low":0,"Medium":0,"High":0,"Critical":0}}
        by_tier[t]["total"] += 1
        by_tier[t]["avg_risk"].append(s.overall_risk)
        by_tier[t]["by_level"][s.risk_level.value] += 1
    for t in by_tier: by_tier[t]["avg_risk"] = round(sum(by_tier[t]["avg_risk"])/len(by_tier[t]["avg_risk"]),1)
    avg_pack = sum(t.aggregated_risk for t in TRACEABILITY.values()) / len(TRACEABILITY)
    return {"total_suppliers":len(SUPPLIERS),"by_risk":{"Low":low,"Medium":med,"High":high,"Critical":crit},
            "avg_risk":round(avg_risk,1),"avg_esg":round(avg_esg,1),"avg_defect_ppm":round(avg_ppm),
            "active_alerts":len(ALERTS),"total_packs":len(BATTERY_PACKS),"avg_pack_risk":round(avg_pack,1),
            "by_tier":by_tier}

@app.get("/api/suppliers")
def list_suppliers(tier: str = Query(None)):
    sups = list(SUPPLIERS.values())
    if tier: sups = [s for s in sups if tier in s.tier.value]
    return [s.model_dump() for s in sups]

@app.get("/api/suppliers/{supplier_id}")
def get_supplier(supplier_id: str):
    s = SUPPLIERS.get(supplier_id)
    if not s: raise HTTPException(404, f"Supplier {supplier_id} not found")
    return s.model_dump()

@app.get("/api/battery-packs")
def list_packs():
    return [p.model_dump() for p in BATTERY_PACKS.values()]

@app.get("/api/battery-packs/{pack_id}")
def get_pack(pack_id: str):
    p = BATTERY_PACKS.get(pack_id)
    if not p: raise HTTPException(404, f"Pack {pack_id} not found")
    return p.model_dump()

@app.get("/api/traceability/{pack_id}")
def get_traceability(pack_id: str):
    t = TRACEABILITY.get(pack_id)
    if not t: raise HTTPException(404, f"No traceability for {pack_id}")
    return t.model_dump()

@app.get("/api/alerts")
def list_alerts(severity: str = Query(None), category: str = Query(None)):
    alerts = ALERTS
    if severity: alerts = [a for a in alerts if a.severity.value == severity]
    if category: alerts = [a for a in alerts if a.category == category]
    return [a.model_dump() for a in alerts]

@app.post("/api/analyze/{supplier_id}")
def analyze_supplier(supplier_id: str):
    return _analyze_supplier(supplier_id)