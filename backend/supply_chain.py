import requests
import time
from functools import lru_cache
from pydantic import BaseModel
from typing import List

class SupplyNode(BaseModel):
    entity_name: str
    tier: int
    material: str
    country: str
    latitude: float
    longitude: float
    composite_risk: float
    risk_justification: str
    esg_score: float
    lead_time_days: int
    criticality: str  # "critical", "high", "medium", "low"

RAW_ENTITIES = [
    {"entity_name": "Salar de Atacama Mine", "search_query": "Salar de Atacama, Chile",                      "tier": 3, "material": "Lithium",          "country": "Chile",      "esg": 6.5, "lead_time": 45, "criticality": "critical"},
    {"entity_name": "Lubumbashi Cobalt Mine", "search_query": "Lubumbashi, Democratic Republic of the Congo", "tier": 3, "material": "Cobalt",           "country": "DRC",        "esg": 3.2, "lead_time": 60, "criticality": "critical"},
    {"entity_name": "Sulawesi Nickel Mine",   "search_query": "Sulawesi, Indonesia",                         "tier": 3, "material": "Nickel",           "country": "Indonesia",  "esg": 5.0, "lead_time": 35, "criticality": "critical"},
    {"entity_name": "Pilbara Lithium Mine",   "search_query": "Pilbara, Western Australia",                  "tier": 3, "material": "Spodumene",        "country": "Australia",  "esg": 8.5, "lead_time": 30, "criticality": "high"},
    {"entity_name": "Heilongjiang Graphite",  "search_query": "Heilongjiang, China",                        "tier": 3, "material": "Graphite",          "country": "China",      "esg": 4.5, "lead_time": 40, "criticality": "high"},
    {"entity_name": "Shanghai Cathode Corp",  "search_query": "Shanghai, China",                            "tier": 2, "material": "NMC Cathode",      "country": "China",      "esg": 6.0, "lead_time": 25, "criticality": "critical"},
    {"entity_name": "Umicore Refinery",       "search_query": "Brussels, Belgium",                          "tier": 2, "material": "Refined Cobalt",   "country": "Belgium",    "esg": 8.8, "lead_time": 20, "criticality": "high"},
    {"entity_name": "Panasonic EV Pack Plant","search_query": "Denver, Colorado, USA",                      "tier": 1, "material": "Full Battery Pack","country": "USA",        "esg": 9.0, "lead_time": 14, "criticality": "critical"},
    {"entity_name": "CATL Cell Factory",      "search_query": "Ningde, Fujian, China",                      "tier": 1, "material": "LFP Cells",        "country": "China",      "esg": 6.5, "lead_time": 21, "criticality": "critical"},
]

# Hardcoded fallback coordinates (real-world locations) for when network is unavailable
FALLBACK_COORDS = {
    "Salar de Atacama Mine": (-23.5, -68.2),
    "Lubumbashi Cobalt Mine": (-11.66, 27.48),
    "Sulawesi Nickel Mine": (-2.0, 121.5),
    "Pilbara Lithium Mine": (-21.5, 118.5),
    "Heilongjiang Graphite": (47.0, 128.0),
    "Shanghai Cathode Corp": (31.23, 121.47),
    "Umicore Refinery": (50.85, 4.35),
    "Panasonic EV Pack Plant": (39.74, -104.99),
    "CATL Cell Factory": (26.66, 119.52),
}

def fetch_real_coordinates(entity_name: str, country: str, search_query: str) -> tuple[float, float]:
    """Hits OpenStreetMap Nominatim API for real lat/lon, with hardcoded fallback.
    Nominatim blocks requests without a Referer header (volunteer-run servers,
    see osm.wiki/Blocked). We always send one, plus a descriptive User-Agent."""
    # Try live fetch first
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": search_query, "format": "json", "limit": 1}
    headers = {
        # Identifies the application (required by OSM tile usage policy)
        "User-Agent": "EV-Asset-Intelligence-Platform/1.0 (hackathon contact@evplatform.io)",
        # Required by Nominatim — their policy blocks requests with no Referer
        "Referer": "https://evplatform.io/dashboard",
        "Accept": "application/json",
    }

    try:
        response = requests.get(url, params=params, headers=headers, timeout=5)
        response.raise_for_status()
        data = response.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        print(f"OSM lookup failed for {entity_name}: {type(e).__name__}")

    # Fallback to hardcoded coordinates
    return FALLBACK_COORDS.get(entity_name, (0.0, 0.0))

def get_base_nodes() -> List[SupplyNode]:
    """Gets nodes with dynamically calculated realistic risks based on ESG and lead times."""
    nodes = []
    for entity in RAW_ENTITIES:
        lat, lon = fetch_real_coordinates(entity["entity_name"], entity["country"], entity["search_query"])
        time.sleep(0.5)  # Rate limit if hitting OSM

        # Calculate a realistic risk score out of 10
        # Formula: higher lead time increases risk, lower ESG increases risk
        esg = entity["esg"]
        lead_time = entity["lead_time"]
        
        raw_risk = ((10.0 - esg) * 0.6) + ((lead_time / 10.0) * 0.4)
        composite_risk = round(max(1.0, min(10.0, raw_risk)), 1)
        
        # Build a descriptive justification based on factors
        if entity["country"] == "DRC":
            justification = f"High exposure to geopolitical and environmental risk in Katanga. Lead time is {lead_time} days; ESG compliance is low ({esg}/10)."
        elif entity["country"] == "China":
            justification = f"Concentrated processing capacity. Heavy reliance on local regulatory alignment. Lead time: {lead_time} days, ESG: {esg}/10."
        elif entity["country"] == "Chile":
            justification = f"Water scarcity risk affecting lithium extraction. Logistics lead time is elevated at {lead_time} days. ESG: {esg}/10."
        elif entity["country"] == "Indonesia":
            justification = f"Regulatory risk from nickel export quotas and environmental scrutiny on coal-powered smelting. Lead time: {lead_time} days."
        elif entity["country"] == "Australia":
            justification = f"Stable operating environment and strong regulatory framework. Low risk primarily driven by long transit route."
        elif entity["country"] == "Belgium":
            justification = f"Low risk refining operations with excellent ESG standards ({esg}/10) and stable regulatory environment."
        else:
            justification = f"Stable regional footprint with standard logistical lead time of {lead_time} days. High ESG compliance."

        nodes.append(SupplyNode(
            entity_name=entity["entity_name"],
            tier=entity["tier"],
            material=entity["material"],
            country=entity["country"],
            latitude=lat,
            longitude=lon,
            composite_risk=composite_risk,
            risk_justification=justification,
            esg_score=esg,
            lead_time_days=lead_time,
            criticality=entity["criticality"],
        ))
    return nodes

# Lazily initialize and cache coordinates so we don't hammer OSM or block server startup.
# Module import is now instant — OSM calls happen only on first data access.
@lru_cache(maxsize=1)
def get_cached_base_nodes() -> List[SupplyNode]:
    return get_base_nodes()


def get_base_nodes_lazy() -> List[SupplyNode]:
    return get_cached_base_nodes()
