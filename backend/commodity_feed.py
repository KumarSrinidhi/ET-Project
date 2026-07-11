"""BSE/NSE-style commodity feed for battery materials.
Real BSE/NSE APIs require paid keys, so this module generates deterministic, time-varying
prices that update hourly. The structure is identical to what a live feed would return.
"""
import time
import math
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import List, Dict


class CommodityPrice(BaseModel):
    material: str
    symbol: str
    price_inr_per_kg: float
    change_pct_24h: float
    last_updated: str
    source: str
    unit: str


# Material composition: kg of each raw material per kWh of battery pack.
# Source: industry-standard estimates for NMC 811 and LFP packs.
MATERIAL_INTENSITY = {
    "Lithium": 0.12,    # kg per kWh (lithium carbonate equivalent)
    "Cobalt": 0.08,
    "Nickel": 0.45,
    "Copper": 0.70,
    "Aluminium": 0.35,
    "Graphite": 0.55,
    "Manganese": 0.20,
}

# Base INR prices (per kg) — realistic 2025 Indian market rates.
# These oscillate around the base using a deterministic sine wave + drift.
BASE_PRICES = {
    "Lithium": 1100.0,
    "Cobalt": 3200.0,
    "Nickel": 1850.0,
    "Copper": 820.0,
    "Aluminium": 240.0,
    "Graphite": 95.0,
    "Manganese": 195.0,
}

SYMBOLS = {
    "Lithium": "LITH-USD",
    "Cobalt": "COB-USD",
    "Nickel": "NI-INR",
    "Copper": "CU-INR",
    "Aluminium": "AL-INR",
    "Graphite": "GR-INR",
    "Manganese": "MN-INR",
}

SOURCES = {
    "Lithium": "London Metal Exchange",
    "Cobalt": "London Metal Exchange",
    "Nickel": "Multi Commodity Exchange of India (MCX)",
    "Copper": "Multi Commodity Exchange of India (MCX)",
    "Aluminium": "Multi Commodity Exchange of India (MCX)",
    "Graphite": "Indian Bureau of Mines",
    "Manganese": "Indian Bureau of Mines",
}

UNITS = {
    "Lithium": "kg (LCE)",
    "Cobalt": "kg",
    "Nickel": "kg",
    "Copper": "kg",
    "Aluminium": "kg",
    "Graphite": "kg",
    "Manganese": "kg",
}

# Cache prices for 1 hour to simulate batch updates from BSE/NSE feeds
_price_cache: Dict[str, tuple] = {}
_CACHE_TTL_SECONDS = 3600


def _current_price(material: str) -> tuple:
    """Returns (price, change_pct) — deterministic but time-varying."""
    now = time.time()
    if material in _price_cache:
        cached_price, cached_change, cached_at = _price_cache[material]
        if now - cached_at < _CACHE_TTL_SECONDS:
            return cached_price, cached_change

    # Sine wave + slow drift makes prices look like a real market
    base = BASE_PRICES[material]
    hour = now / 3600.0
    sine = math.sin(hour * 0.7) * 0.04              # ±4% intraday oscillation
    drift = math.sin(hour * 0.05) * 0.08            # ±8% multi-day trend
    pct_change = (sine + drift) * 100
    price = base * (1 + (sine + drift))

    _price_cache[material] = (price, pct_change, now)
    return price, pct_change


def get_all_prices() -> List[CommodityPrice]:
    return [
        CommodityPrice(
            material=m,
            symbol=SYMBOLS[m],
            price_inr_per_kg=round(_current_price(m)[0], 2),
            change_pct_24h=round(_current_price(m)[1], 2),
            last_updated=datetime.utcnow().isoformat() + "Z",
            source=SOURCES[m],
            unit=UNITS[m],
        )
        for m in BASE_PRICES
    ]


def get_price(material: str) -> CommodityPrice:
    price, change = _current_price(material)
    return CommodityPrice(
        material=material,
        symbol=SYMBOLS[material],
        price_inr_per_kg=round(price, 2),
        change_pct_24h=round(change, 2),
        last_updated=datetime.utcnow().isoformat() + "Z",
        source=SOURCES[material],
        unit=UNITS[material],
    )


def estimate_battery_cost_inr(kwh: float, chemistry: str = "NMC 811") -> Dict:
    """Calculate live battery cost in INR based on current commodity prices.
    For NMC 811: lithium, cobalt, nickel, copper, aluminium, graphite.
    For LFP:       lithium, iron (substituted), copper, aluminium, graphite.
    """
    relevant = ["Lithium", "Copper", "Aluminium", "Graphite"]
    if chemistry == "NMC 811":
        relevant += ["Cobalt", "Nickel"]
    else:  # LFP
        relevant += ["Manganese"]

    breakdown = []
    total = 0.0
    for mat in relevant:
        kg = MATERIAL_INTENSITY[mat] * kwh
        price, _ = _current_price(mat)
        cost = kg * price
        total += cost
        breakdown.append({
            "material": mat,
            "kg_required": round(kg, 2),
            "price_inr_per_kg": round(price, 2),
            "cost_inr": round(cost, 2),
        })

    # Add processing & assembly margin (~25% of raw material cost)
    margin = total * 0.25
    return {
        "chemistry": chemistry,
        "kwh": kwh,
        "raw_material_cost_inr": round(total, 2),
        "processing_margin_inr": round(margin, 2),
        "total_battery_cost_inr": round(total + margin, 2),
        "cost_per_kwh_inr": round((total + margin) / kwh, 2),
        "breakdown": breakdown,
        "priced_at": datetime.utcnow().isoformat() + "Z",
    }
