import requests
import time
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
    risk_justification: str  # Will hold the LLM's explanation of the live news

RAW_ENTITIES = [
    {"entity_name": "Salar de Atacama Mine", "search_query": "Salar de Atacama, Chile",                      "tier": 3, "material": "Lithium",          "country": "Chile"},
    {"entity_name": "Lubumbashi Cobalt Mine", "search_query": "Lubumbashi, Democratic Republic of the Congo", "tier": 3, "material": "Cobalt",           "country": "DRC"},
    {"entity_name": "Sulawesi Nickel Mine",   "search_query": "Sulawesi, Indonesia",                         "tier": 3, "material": "Nickel",           "country": "Indonesia"},
    {"entity_name": "Shanghai Cathode Corp",  "search_query": "Shanghai, China",                            "tier": 2, "material": "NMC Cathode",      "country": "China"},
    {"entity_name": "Panasonic EV Pack Plant","search_query": "Denver, Colorado, USA",                      "tier": 1, "material": "Full Battery Pack","country": "USA"},
]

def fetch_real_coordinates(entity_name: str, country: str, search_query: str) -> tuple[float, float]:
    """Hits OpenStreetMap Nominatim API for real lat/lon."""
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": search_query, "format": "json", "limit": 1}
    headers = {"User-Agent": "EV-Hackathon-Demo/1.0 (contact@hackathon.dev)"}

    try:
        response = requests.get(url, params=params, headers=headers, timeout=5)
        data = response.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        pass
    return 0.0, 0.0

def get_base_nodes() -> List[SupplyNode]:
    """Gets nodes with real coordinates but baseline risk."""
    nodes = []
    for entity in RAW_ENTITIES:
        lat, lon = fetch_real_coordinates(entity["entity_name"], entity["country"], entity["search_query"])
        time.sleep(1)  # Respect OSM rate limits

        nodes.append(SupplyNode(
            entity_name=entity["entity_name"],
            tier=entity["tier"],
            material=entity["material"],
            country=entity["country"],
            latitude=lat,
            longitude=lon,
            composite_risk=5.0,  # Baseline
            risk_justification="Awaiting live news analysis..."
        ))
    return nodes

# Cache the coordinates so we don't hammer OSM on every query
BASE_NODES = get_base_nodes()
