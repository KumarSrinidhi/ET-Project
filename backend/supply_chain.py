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
    """Hits OpenStreetMap Nominatim API for real lat/lon, with hardcoded fallback."""
    # Try live fetch first
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": search_query, "format": "json", "limit": 1}
    headers = {"User-Agent": "EV-Hackathon-Demo/1.0 (contact@hackathon.dev)"}

    try:
        response = requests.get(url, params=params, headers=headers, timeout=3)
        data = response.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        pass

    # Fallback to hardcoded coordinates
    return FALLBACK_COORDS.get(entity_name, (0.0, 0.0))

def get_base_nodes() -> List[SupplyNode]:
    """Gets nodes with real coordinates but baseline risk."""
    nodes = []
    for entity in RAW_ENTITIES:
        lat, lon = fetch_real_coordinates(entity["entity_name"], entity["country"], entity["search_query"])
        time.sleep(0.5)  # Rate limit if hitting OSM

        nodes.append(SupplyNode(
            entity_name=entity["entity_name"],
            tier=entity["tier"],
            material=entity["material"],
            country=entity["country"],
            latitude=lat,
            longitude=lon,
            composite_risk=5.0,  # Baseline
            risk_justification="Awaiting live news analysis...",
            esg_score=entity["esg"],
            lead_time_days=entity["lead_time"],
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
