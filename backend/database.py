import sqlite3
import os
from pathlib import Path
from datetime import datetime
import json
import random

DB_PATH = Path(__file__).resolve().parent / "et_project.db"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def seed_depots_and_vehicles(cursor):
    # Check if depots exist
    cursor.execute("SELECT COUNT(*) FROM depots")
    if cursor.fetchone()[0] > 0:
        return

    regions = ["North", "South", "East", "West", "Central"]
    cities = [
        {"city": "Mumbai", "region": "West", "lat": 19.0760, "lng": 72.8777},
        {"city": "Delhi", "region": "North", "lat": 28.7041, "lng": 77.1025},
        {"city": "Bangalore", "region": "South", "lat": 12.9716, "lng": 77.5946},
        {"city": "Chennai", "region": "South", "lat": 13.0827, "lng": 80.2707},
        {"city": "Kolkata", "region": "East", "lat": 22.5726, "lng": 88.3639},
        {"city": "Pune", "region": "West", "lat": 18.5204, "lng": 73.8567},
        {"city": "Hyderabad", "region": "South", "lat": 17.3850, "lng": 78.4867},
        {"city": "Ahmedabad", "region": "West", "lat": 23.0225, "lng": 72.5714},
    ]

    depots_data = []
    vehicles_data = []
    
    # Let's generate 12 depots for our example
    for i in range(1, 13):
        city_info = random.choice(cities)
        depot_id = f"DEP-{city_info['city'][:3].upper()}-{i:02d}"
        name = f"{city_info['city']} {'Central' if i%2==0 else 'East'} Hub {i}"
        code = f"{city_info['city'][:3].upper()}-{i:02d}"
        
        # Jitter lat/lng a bit
        lat = city_info['lat'] + random.uniform(-0.1, 0.1)
        lng = city_info['lng'] + random.uniform(-0.1, 0.1)
        
        vehicle_count = random.randint(10, 50) if i != 12 else 0 # One depot with 0 vehicles
        manager_name = random.choice(["Rajesh K.", "Anita D.", "Vikram S.", "Priya I.", "Karthik R.", "Neha G."])
        
        charging_infra = json.dumps({
            "total_bays": vehicle_count // 2 + 2,
            "fast_chargers": vehicle_count // 4 + 1,
            "slow_chargers": vehicle_count // 4 + 1,
            "avg_uptime_pct": round(random.uniform(85, 99.5), 1)
        })
        
        workshop_capacity = json.dumps({
            "bays": max(2, vehicle_count // 10),
            "current_utilization_pct": random.randint(30, 90)
        })
        
        depots_data.append((depot_id, name, code, city_info['region'], lat, lng, "Asia/Kolkata", vehicle_count, manager_name, charging_infra, workshop_capacity))
        
        # Generate vehicles for this depot
        for v in range(1, vehicle_count + 1):
            vehicle_id = f"{depot_id}-V{v:03d}"
            vehicles_data.append((vehicle_id, depot_id))
            
    cursor.executemany('''
        INSERT INTO depots (id, name, code, region, lat, lng, timezone, vehicle_count, manager_name, charging_infra, workshop_capacity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', depots_data)
    
    cursor.executemany('''
        INSERT INTO vehicles (vehicle_id, depot_id)
        VALUES (?, ?)
    ''', vehicles_data)
    
    # Ensure EV-001 to EV-010 (hardcoded APM ones) are also assigned somewhere so APM views don't break
    apm_vehicles = []
    depot_ids = [d[0] for d in depots_data if d[7] > 0]
    for v in range(1, 11):
        vid = f"EV-{v:03d}"
        apm_vehicles.append((vid, random.choice(depot_ids)))
    
    cursor.executemany('INSERT OR IGNORE INTO vehicles (vehicle_id, depot_id) VALUES (?, ?)', apm_vehicles)

def seed_rbac(cursor):
    cursor.execute("SELECT COUNT(*) FROM roles")
    if cursor.fetchone()[0] > 0:
        return
        
    roles = [
        ("procurement", "Procurement Team"),
        ("maintenance", "Maintenance Team"),
        ("executive", "Executive Management"),
        ("admin", "System Administrator")
    ]
    cursor.executemany('INSERT INTO roles (id, description) VALUES (?, ?)', roles)
    
    permissions = [
        ("fleet.health.view", "fleet"),
        ("fleet.health.detail", "fleet"),
        ("fleet.maintenance.view", "fleet"),
        ("fleet.maintenance.create", "fleet"),
        ("fleet.maintenance.edit", "fleet"),
        ("fleet.maintenance.approve", "fleet"),
        ("fleet.procurement.view", "fleet"),
        ("fleet.procurement.edit", "fleet"),
        ("supply_chain.risk.view", "supply_chain"),
        ("supply_chain.traceability.view", "supply_chain"),
        ("quality.qms.view", "quality"),
        ("carbon.dashboard.view", "carbon"),
        ("carbon.dashboard.export", "carbon"),
        ("admin.users.view", "admin"),
        ("admin.users.edit", "admin"),
        ("admin.audit.view", "admin"),
        ("admin.audit.export", "admin"),
        ("depot.all", "depot"),
        ("depot.assigned", "depot")
    ]
    cursor.executemany('INSERT INTO permissions (id, module) VALUES (?, ?)', permissions)
    
    role_perms = []
    
    procurement_perms = [
        "fleet.health.view", "fleet.procurement.view", "fleet.procurement.edit",
        "supply_chain.risk.view", "supply_chain.traceability.view",
        "quality.qms.view", "carbon.dashboard.view", "depot.assigned"
    ]
    role_perms.extend([("procurement", p) for p in procurement_perms])
    
    maintenance_perms = [
        "fleet.health.view", "fleet.health.detail", "fleet.maintenance.view",
        "fleet.maintenance.create", "fleet.maintenance.edit", "fleet.procurement.view",
        "depot.assigned"
    ]
    role_perms.extend([("maintenance", p) for p in maintenance_perms])
    
    executive_perms = [
        "fleet.health.view", "fleet.maintenance.view", "fleet.procurement.view",
        "supply_chain.risk.view", "carbon.dashboard.view", "carbon.dashboard.export",
        "depot.all"
    ]
    role_perms.extend([("executive", p) for p in executive_perms])
    
    admin_perms = [p[0] for p in permissions]
    role_perms.extend([("admin", p) for p in admin_perms])
    
    cursor.executemany('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', role_perms)
    
    # Get random depots for assignment
    cursor.execute("SELECT id FROM depots")
    all_depots = [row[0] for row in cursor.fetchall()]
    assigned_depots_proc = json.dumps(random.sample(all_depots, min(3, len(all_depots))))
    assigned_depots_maint = json.dumps(random.sample(all_depots, min(2, len(all_depots))))
    
    users = [
        ("proc_user", "Procurement User", "procurement@demo.com", "procurement", assigned_depots_proc, 1),
        ("maint_user", "Maintenance User", "maintenance@demo.com", "maintenance", assigned_depots_maint, 1),
        ("exec_user", "Executive User", "executive@demo.com", "executive", "[]", 1),
        ("admin_user", "System Administrator", "admin@demo.com", "admin", "[]", 1)
    ]
    cursor.executemany('INSERT INTO users (id, name, email, role_id, assigned_depots, active) VALUES (?, ?, ?, ?, ?, ?)', users)

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
    
    # Create news_articles table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS news_articles (
            id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL,
            title TEXT NOT NULL,
            source TEXT NOT NULL,
            url TEXT NOT NULL,
            published_date TEXT NOT NULL,
            sentiment TEXT,
            created_at TEXT NOT NULL
        )
    ''')

    # Create article_risk_mapping table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS article_risk_mapping (
            id TEXT PRIMARY KEY,
            article_id TEXT NOT NULL,
            material TEXT NOT NULL,
            risk_type TEXT NOT NULL,
            relevance_score REAL NOT NULL,
            extracted_claims TEXT NOT NULL,
            FOREIGN KEY(article_id) REFERENCES news_articles(id)
        )
    ''')

    # Create risk_scores table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS risk_scores (
            id TEXT PRIMARY KEY,
            material TEXT NOT NULL,
            overall_risk REAL NOT NULL,
            level TEXT NOT NULL,
            last_updated TEXT NOT NULL
        )
    ''')

    # Create risk_citations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS risk_citations (
            id TEXT PRIMARY KEY,
            risk_score_id TEXT NOT NULL,
            risk_type TEXT NOT NULL,
            article_id TEXT NOT NULL,
            FOREIGN KEY(risk_score_id) REFERENCES risk_scores(id),
            FOREIGN KEY(article_id) REFERENCES news_articles(id)
        )
    ''')
    
    # Create depots table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS depots (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            region TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            timezone TEXT NOT NULL,
            vehicle_count INTEGER NOT NULL,
            manager_name TEXT NOT NULL,
            charging_infra TEXT NOT NULL,
            workshop_capacity TEXT NOT NULL
        )
    ''')

    # Create vehicles table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vehicles (
            vehicle_id TEXT PRIMARY KEY,
            depot_id TEXT NOT NULL,
            FOREIGN KEY(depot_id) REFERENCES depots(id)
        )
    ''')

    # Create depot_aggregates table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS depot_aggregates (
            depot_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            total_vehicles INTEGER NOT NULL,
            active_vehicles INTEGER NOT NULL,
            avg_soh_pct REAL NOT NULL,
            avg_soc_pct REAL NOT NULL,
            vehicles_in_maintenance INTEGER NOT NULL,
            vehicles_charging INTEGER NOT NULL,
            vehicles_idle INTEGER NOT NULL,
            total_distance_km_today REAL NOT NULL,
            total_energy_kwh_today REAL NOT NULL,
            avg_efficiency_km_per_kwh REAL NOT NULL,
            open_maintenance_orders INTEGER NOT NULL,
            overdue_maintenance_orders INTEGER NOT NULL,
            avg_rul_days INTEGER NOT NULL,
            PRIMARY KEY(depot_id, timestamp),
            FOREIGN KEY(depot_id) REFERENCES depots(id)
        )
    ''')
    
    # Create RBAC tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS roles (
            id TEXT PRIMARY KEY,
            description TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS permissions (
            id TEXT PRIMARY KEY,
            module TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS role_permissions (
            role_id TEXT,
            permission_id TEXT,
            PRIMARY KEY(role_id, permission_id),
            FOREIGN KEY(role_id) REFERENCES roles(id),
            FOREIGN KEY(permission_id) REFERENCES permissions(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT UNIQUE,
            role_id TEXT,
            assigned_depots TEXT,
            active INTEGER,
            FOREIGN KEY(role_id) REFERENCES roles(id)
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
        
    seed_depots_and_vehicles(cursor)
    seed_rbac(cursor)
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized.")
