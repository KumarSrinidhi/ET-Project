import sqlite3
import os
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).resolve().parent / "et_project.db"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create commodity_prices table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS commodity_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            material TEXT NOT NULL,
            price_inr_per_kg REAL NOT NULL,
            timestamp TEXT NOT NULL,
            source TEXT NOT NULL
        )
    ''')
    
    # Create config table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')
    
    # Create vehicle_capex_history table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vehicle_capex_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_type TEXT NOT NULL,
            capex REAL NOT NULL,
            timestamp TEXT NOT NULL,
            reason TEXT
        )
    ''')
    
    # Create drift_explanations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS drift_explanations (
            batch_id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            cpk_value REAL NOT NULL,
            cpk_threshold REAL NOT NULL,
            result_json TEXT NOT NULL
        )
    ''')
    
    # Insert default configs if not present
    cursor.execute("SELECT COUNT(*) FROM config")
    if cursor.fetchone()[0] == 0:
        default_configs = [
            ("lithium_weight_pct", "0.10"),
            ("cobalt_weight_pct", "0.05"),
            ("nickel_weight_pct", "0.33"),
            ("cathode_base_cost", "0.60"),
            ("pack_base_cost_per_kwh", "0.60"),
            ("chassis_and_powertrain_base", "800000.0"),
            ("pack_capacity_kwh", "50.0") # Assuming 50kWh for a 5t truck
        ]
        cursor.executemany("INSERT INTO config (key, value) VALUES (?, ?)", default_configs)
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized.")
