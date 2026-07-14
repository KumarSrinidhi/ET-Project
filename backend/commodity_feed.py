import time
import math
import logging
import requests
import re
import os
from datetime import datetime
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List, Dict

load_dotenv()

try:
    from .database import get_db_connection
except ImportError:
    from database import get_db_connection

logger = logging.getLogger(__name__)

# Constants
USD_TO_INR = 83.50  # Mock RBI reference rate

class CommodityPrice(BaseModel):
    material: str
    symbol: str
    price_inr_per_kg: float
    change_pct_24h: float
    last_updated: str
    source: str
    unit: str
    history: List[float] = []

# Base realistic LME/global prices in USD per ton (approx 2024/2025 rates)
MOCK_LME_USD_PER_TON = {
    "Lithium": 13500.0,
    "Cobalt": 28000.0,
    "Nickel": 16500.0,
}

SYMBOLS = {
    "Lithium": "LME-LITH",
    "Cobalt": "LME-COB",
    "Nickel": "LME-NICK",
    "Copper": "CU-INR",
    "Aluminium": "AL-INR",
    "Graphite": "GR-INR",
    "Manganese": "MN-INR",
}

MATERIAL_INTENSITY = {
    "Lithium": 0.12,    # kg per kWh (lithium carbonate equivalent)
    "Cobalt": 0.08,
    "Nickel": 0.45,
    "Copper": 0.70,
    "Aluminium": 0.35,
    "Graphite": 0.55,
    "Manganese": 0.20,
}

BASE_PRICES = {
    "Lithium": 1100.0,
    "Cobalt": 3200.0,
    "Nickel": 1850.0,
    "Copper": 820.0,
    "Aluminium": 240.0,
    "Graphite": 95.0,
    "Manganese": 195.0,
}

SOURCES = {
    "Lithium": "metals.dev",
    "Cobalt": "metals.dev",
    "Nickel": "metals.dev",
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

def _scrape_tradingeconomics_price(material: str) -> float:
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    }
    URLS = {
        "Lithium": ("https://tradingeconomics.com/commodity/lithium", "CNY", 1000.0),
        "Cobalt": ("https://tradingeconomics.com/commodity/cobalt", "USD", 1000.0),
        "Nickel": ("https://tradingeconomics.com/commodity/nickel", "USD", 1000.0),
    }
    CNY_TO_INR = 11.50
    USD_TO_INR = 83.50
    
    if material not in URLS:
        return None
        
    url, currency, unit_divider = URLS[material]
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        match = re.search(r'TEChartsMeta = \[.*?"value"\s*:\s*([\d.]+)', response.text)
        if not match:
            return None
        raw_price = float(match.group(1))
        if currency == "CNY":
            return (raw_price * CNY_TO_INR) / unit_divider
        elif currency == "USD":
            return (raw_price * USD_TO_INR) / unit_divider
    except Exception as e:
        logger.error(f"TradingEconomics scrape error for {material}: {e}")
    return None


def fetch_live_prices():
    """
    Fetches live hourly prices by querying the metals.dev API.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    api_key = os.environ.get("METALS_DEV_API_KEY")
    if not api_key:
        logger.error("METALS_DEV_API_KEY not set in environment")
        return
        
    try:
        # Strip in case there are spaces from copy pasting
        api_key = api_key.strip()
        url = f"https://api.metals.dev/v1/latest?api_key={api_key}&currency=INR&unit=kg"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        metals_data = data.get("metals", {})
        
        # Mapping our materials to possible metals.dev keys
        material_keys = {
            "Lithium": ["lithium", "lco"],
            "Cobalt": ["cobalt", "lco"],
            "Nickel": ["nickel", "xni", "ni"]
        }
        
        for material in MOCK_LME_USD_PER_TON.keys():
            price_inr_per_kg = None
            for key in material_keys.get(material, []):
                if key in metals_data:
                    price_inr_per_kg = float(metals_data[key])
                    break
            
            if price_inr_per_kg is not None:
                cursor.execute(
                    "INSERT INTO commodity_prices (material, price_inr_per_kg, timestamp, source) VALUES (?, ?, ?, ?)",
                    (material, price_inr_per_kg, timestamp, "metals.dev")
                )
            else:
                # Fallback to scraping TradingEconomics
                te_price = _scrape_tradingeconomics_price(material)
                if te_price is not None:
                    cursor.execute(
                        "INSERT INTO commodity_prices (material, price_inr_per_kg, timestamp, source) VALUES (?, ?, ?, ?)",
                        (material, te_price, timestamp, "TradingEconomics (scraped)")
                    )
                else:
                    logger.error(f"Could not find price for {material} in metals.dev or TradingEconomics")
                
    except Exception as e:
        logger.error(f"Error fetching from metals.dev: {e}")
        
    conn.commit()
    conn.close()
    
    # Recalculate CapEx for all models in pipeline
    calculate_capex()


def get_latest_prices() -> Dict[str, dict]:
    """Retrieves latest prices and 24h change from DB."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    latest_prices = {}
    
    for material in MOCK_LME_USD_PER_TON.keys():
        # Get current
        cursor.execute(
            "SELECT price_inr_per_kg, timestamp, source FROM commodity_prices WHERE material=? ORDER BY id DESC LIMIT 1",
            (material,)
        )
        row = cursor.fetchone()
        if not row:
            continue
            
        current_price = row['price_inr_per_kg']
        
        # Get price 24h ago
        cursor.execute(
            "SELECT price_inr_per_kg FROM commodity_prices WHERE material=? AND timestamp <= datetime(?, '-1 day') ORDER BY id DESC LIMIT 1",
            (material, row['timestamp'])
        )
        old_row = cursor.fetchone()
        
        change_pct_24h = 0.0
        if old_row and old_row['price_inr_per_kg'] > 0:
            change_pct_24h = ((current_price - old_row['price_inr_per_kg']) / old_row['price_inr_per_kg']) * 100
        elif row:
            # If no 24h old data, check oldest data available
            cursor.execute(
                "SELECT price_inr_per_kg FROM commodity_prices WHERE material=? ORDER BY id ASC LIMIT 1",
                (material,)
            )
            oldest_row = cursor.fetchone()
            if oldest_row and oldest_row['price_inr_per_kg'] > 0:
                change_pct_24h = ((current_price - oldest_row['price_inr_per_kg']) / oldest_row['price_inr_per_kg']) * 100
            
        # Get historical prices for graph
        cursor.execute(
            "SELECT price_inr_per_kg FROM commodity_prices WHERE material=? ORDER BY id DESC LIMIT 10",
            (material,)
        )
        history_rows = cursor.fetchall()
        history = [row['price_inr_per_kg'] for row in reversed(history_rows)]
            
        latest_prices[material] = {
            "price": round(current_price, 2),
            "unit": "INR/kg",
            "change_24h": round(change_pct_24h, 2),
            "last_updated": row['timestamp'],
            "source": row['source'],
            "history": history
        }
    
    conn.close()
    return latest_prices


def get_all_prices() -> List[CommodityPrice]:
    prices = get_latest_prices()
    if not prices:
        fetch_live_prices()
        prices = get_latest_prices()
        
    result = []
    for material, data in prices.items():
        result.append(CommodityPrice(
            material=material,
            symbol=SYMBOLS[material],
            price_inr_per_kg=data['price'],
            change_pct_24h=data['change_24h'],
            last_updated=data['last_updated'],
            source=data['source'],
            unit=data['unit'],
            history=data['history']
        ))
    return result


def get_price(material: str) -> CommodityPrice:
    # If Lithium, Cobalt, or Nickel, get from DB
    if material in ["Lithium", "Cobalt", "Nickel"]:
        latest = get_latest_prices()
        if latest and material in latest:
            data = latest[material]
            return CommodityPrice(
                material=material,
                symbol=SYMBOLS[material],
                price_inr_per_kg=data['price'],
                change_pct_24h=data['change_24h'],
                last_updated=data['last_updated'],
                source=data['source'],
                unit=UNITS.get(material, "kg"),
                history=data['history']
            )
            
    # Fallback/Other materials: time-varying sine wave
    now = time.time()
    base = BASE_PRICES.get(material, 100.0)
    hour = now / 3600.0
    sine = math.sin(hour * 0.7) * 0.04
    drift = math.sin(hour * 0.05) * 0.08
    pct_change = (sine + drift) * 100
    price = base * (1 + (sine + drift))
    
    return CommodityPrice(
        material=material,
        symbol=SYMBOLS.get(material, "UNKNOWN"),
        price_inr_per_kg=round(price, 2),
        change_pct_24h=round(pct_change, 2),
        last_updated=datetime.utcnow().isoformat() + "Z",
        source=SOURCES.get(material, "Internal Feed"),
        unit=UNITS.get(material, "kg"),
        history=[]
    )


def estimate_battery_cost_inr(kwh: float, chemistry: str = "NMC 811") -> Dict:
    relevant = ["Lithium", "Copper", "Aluminium", "Graphite"]
    if chemistry == "NMC 811":
        relevant += ["Cobalt", "Nickel"]
    else:  # LFP
        relevant += ["Manganese"]

    breakdown = []
    total = 0.0
    for mat in relevant:
        kg = MATERIAL_INTENSITY.get(mat, 0.1) * kwh
        price_obj = get_price(mat)
        cost = kg * price_obj.price_inr_per_kg
        total += cost
        breakdown.append({
            "material": mat,
            "kg_required": round(kg, 2),
            "price_inr_per_kg": round(price_obj.price_inr_per_kg, 2),
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


def get_config() -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM config")
    rows = cursor.fetchall()
    conn.close()
    return {row['key']: float(row['value']) for row in rows}
    

def calculate_capex(vehicle_type: str = "electric_truck_5t") -> dict:
    prices = get_latest_prices()
    
    # Check if we have prices, if not, fetch them
    if not prices:
        fetch_live_prices()
        prices = get_latest_prices()
        
    config = get_config()
        
    li_price = prices.get("Lithium", {}).get("price", 1100.0)
    co_price = prices.get("Cobalt", {}).get("price", 3200.0)
    ni_price = prices.get("Nickel", {}).get("price", 1850.0)
    
    # Formula components
    lithium_contribution = (config['cathode_base_cost'] * li_price * config['lithium_weight_pct'])
    cobalt_contribution = (config['cathode_base_cost'] * co_price * config['cobalt_weight_pct'])
    nickel_contribution = (config['cathode_base_cost'] * ni_price * config['nickel_weight_pct'])
    
    cathode_cost = lithium_contribution + cobalt_contribution + nickel_contribution + config['cathode_base_cost']
    pack_cost_per_kwh = cathode_cost + config['pack_base_cost_per_kwh']
    pack_capacity_kwh = config['pack_capacity_kwh']
    pack_cost = pack_cost_per_kwh * pack_capacity_kwh
    fixed_costs = config['chassis_and_powertrain_base'] + (config['cathode_base_cost'] + config['pack_base_cost_per_kwh']) * pack_capacity_kwh
    
    current_capex = pack_cost + config['chassis_and_powertrain_base']
    
    # Get previous capex from history
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT capex FROM vehicle_capex_history WHERE vehicle_type=? ORDER BY id DESC LIMIT 1",
        (vehicle_type,)
    )
    prev_row = cursor.fetchone()
    
    previous_capex = prev_row['capex'] if prev_row else current_capex
    
    delta = current_capex - previous_capex
    delta_pct = (delta / previous_capex) * 100 if previous_capex > 0 else 0
    
    # Save to history if changed
    if not prev_row or abs(delta) > 0.01:
        cursor.execute("INSERT INTO vehicle_capex_history (vehicle_type, capex, timestamp, reason) VALUES (?, ?, ?, ?)",
            (vehicle_type, current_capex, datetime.utcnow().isoformat() + "Z", "Price Update"))
        conn.commit()
    conn.close()

    return {
        "current_capex": round(current_capex, 2),
        "previous_capex": round(previous_capex, 2),
        "delta": round(delta, 2),
        "delta_pct": round(delta_pct, 2),
        "breakdown": {
            "lithium_contribution": round(lithium_contribution * pack_capacity_kwh, 2),
            "cobalt_contribution": round(cobalt_contribution * pack_capacity_kwh, 2),
            "nickel_contribution": round(nickel_contribution * pack_capacity_kwh, 2),
            "fixed_costs": round(fixed_costs, 2)
        },
        "last_recalculated": datetime.utcnow().isoformat() + "Z"
    }
