from pydantic import BaseModel
from typing import List

class SupplyNode(BaseModel):
    entity_name: str
    tier: int
    material: str
    country: str
    latitude: float
    longitude: float
    geopolitical_risk: int  # 1-10
    esg_risk: int           # 1-10
    composite_risk: float   # Calculated

def build_supply_chain() -> List[SupplyNode]:
    # Hardcoded realistic traceability tree for a single NMC battery pack
    raw_data = [
        # Tier 3: Raw Mining (Real Lat/Lon)
        {"entity_name": "Salar de Atacama Mine", "tier": 3, "material": "Lithium", "country": "Chile", "latitude": -23.5, "longitude": -68.0, "geopolitical_risk": 3, "esg_risk": 2},
        {"entity_name": "Lubumbashi Cobalt Mine", "tier": 3, "material": "Cobalt", "country": "DRC", "latitude": -11.6, "longitude": 27.4, "geopolitical_risk": 9, "esg_risk": 9},
        {"entity_name": "Sulawesi Nickel Mine", "tier": 3, "material": "Nickel", "country": "Indonesia", "latitude": -1.5, "longitude": 121.0, "geopolitical_risk": 4, "esg_risk": 6},
        
        # Tier 2: Processing
        {"entity_name": "Shanghai Cathode Corp", "tier": 2, "material": "NMC Cathode", "country": "China", "latitude": 31.2, "longitude": 121.4, "geopolitical_risk": 7, "esg_risk": 5},
        
        # Tier 1: Cell/Pack Manufacturing
        {"entity_name": "Panasonic EV Pack Plant", "tier": 1, "material": "Full Battery Pack", "country": "USA", "latitude": 39.8, "longitude": -104.9, "geopolitical_risk": 1, "esg_risk": 1},
    ]
    
    nodes = []
    for item in raw_data:
        # Weighted composite risk calculation
        composite = (item["geopolitical_risk"] * 0.6) + (item["esg_risk"] * 0.4)
        nodes.append(SupplyNode(**item, composite_risk=round(composite, 2)))
        
    return nodes

def get_traceability_data() -> List[dict]:
    return [node.model_dump() for node in build_supply_chain()]
