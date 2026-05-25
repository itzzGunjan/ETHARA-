import os
import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

# Determine DB location from Environment or default relative to this file
DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logistics.db")
DB_PATH = os.getenv("SQLITE_DB_PATH", DEFAULT_DB_PATH)

def get_db_connection() -> sqlite3.Connection:
    """
    Establishes and returns a connection to the SQLite database.
    Enforces foreign keys and row dictionary formatting.
    """
    # Ensure directory exists
    db_dir = os.path.dirname(DB_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    """
    Bootstraps the SQLite tables and seeds default records.
    Called on FastAPI startup event loops.
    """
    with get_db_connection() as conn:
        # 1. Users Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                email TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'dispatcher', 'driver'))
            );
        """)

        # 2. Deliveries Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS deliveries (
                id TEXT PRIMARY KEY,
                destination TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                priority TEXT NOT NULL CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')),
                weight REAL NOT NULL,
                driver TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending',
                eta TEXT NOT NULL DEFAULT 'Calculating...'
            );
        """)

        # 3. Optimized Routes History Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS optimized_routes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                parameters TEXT NOT NULL,          -- JSON string of parameters used
                distance_km REAL NOT NULL,
                unserved_deliveries INTEGER NOT NULL,
                routes_json TEXT NOT NULL          -- JSON string representing coordinate index routes
            );
        """)

        conn.commit()

        # Seed Default dispatcher account if users database is empty
        cursor = conn.execute("SELECT COUNT(*) as count FROM users;")
        if cursor.fetchone()["count"] == 0:
            from app.auth.auth import hash_password
            conn.execute(
                "INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?);",
                ("dispatcher@logistics.ai", hash_password("supersecure123"), "Rahul Sharma", "dispatcher")
            )
            # Add other default accounts for demo convenience
            conn.execute(
                "INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?);",
                ("driver@logistics.ai", hash_password("supersecure123"), "Amit Verma", "driver")
            )
            conn.execute(
                "INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?);",
                ("admin@logistics.ai", hash_password("supersecure123"), "Neha Singh", "admin")
            )
            conn.commit()

        # Seed Initial Deliveries if empty to provide immediate visual content
        cursor = conn.execute("SELECT COUNT(*) as count FROM deliveries;")
        if cursor.fetchone()["count"] == 0:
            initial_deliveries = [
                ("DLV-1001", "SoMa Hub, SF", 37.7785, -122.4056, "High", 120.0, "Rahul Sharma", "In Transit", "18 mins"),
                ("DLV-1002", "Mission District, SF", 37.7599, -122.4148, "Medium", 80.0, "Amit Verma", "Delivered", "Completed"),
                ("DLV-1003", "Castro District, SF", 37.7609, -122.4350, "Critical", 240.0, "Neha Singh", "Pending", "42 mins"),
                ("DLV-1004", "Financial District, SF", 37.7946, -122.3999, "Low", 350.0, "Arjun Patel", "Assigned", "1 hr"),
            ]
            conn.executemany(
                "INSERT INTO deliveries (id, destination, lat, lng, priority, weight, driver, status, eta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);",
                initial_deliveries
            )
            conn.commit()

# --- DATABASE CRUD METHODS ---

# Users CRUD
def db_get_user(email: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?;", (email,)).fetchone()
        return dict(row) if row else None

def db_create_user(email: str, password_hash: str, full_name: str, role: str) -> bool:
    try:
        with get_db_connection() as conn:
            conn.execute(
                "INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?);",
                (email, password_hash, full_name, role)
            )
            conn.commit()
            return True
    except sqlite3.IntegrityError:
        return False

# Deliveries CRUD
def db_get_all_deliveries() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        rows = conn.execute("SELECT * FROM deliveries;").fetchall()
        return [dict(row) for row in rows]

def db_get_delivery(delivery_id: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM deliveries WHERE id = ?;", (delivery_id,)).fetchone()
        return dict(row) if row else None

def db_create_delivery(dlv_id: str, dest: str, lat: float, lng: float, priority: str, weight: float, driver: str) -> Dict[str, Any]:
    with get_db_connection() as conn:
        conn.execute(
            "INSERT INTO deliveries (id, destination, lat, lng, priority, weight, driver, status, eta) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', 'Calculating...');",
            (dlv_id, dest, lat, lng, priority, weight, driver)
        )
        conn.commit()
    return db_get_delivery(dlv_id)

def db_update_delivery_status(dlv_id: str, status_str: str) -> Optional[Dict[str, Any]]:
    eta = "Completed" if status_str == "Delivered" else "Pending..."
    with get_db_connection() as conn:
        conn.execute(
            "UPDATE deliveries SET status = ?, eta = ? WHERE id = ?;",
            (status_str, eta, dlv_id)
        )
        conn.commit()
    return db_get_delivery(dlv_id)

def db_delete_delivery(dlv_id: str) -> bool:
    with get_db_connection() as conn:
        cursor = conn.execute("DELETE FROM deliveries WHERE id = ?;", (dlv_id,))
        conn.commit()
        return cursor.rowcount > 0

# Optimized Routes Logging
def db_log_optimized_route(params: Dict[str, Any], distance: float, unserved: int, routes: List[List[int]]) -> int:
    timestamp = datetime.utcnow().isoformat()
    params_str = json.dumps(params)
    routes_str = json.dumps(routes)
    with get_db_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO optimized_routes (timestamp, parameters, distance_km, unserved_deliveries, routes_json) VALUES (?, ?, ?, ?, ?);",
            (timestamp, params_str, distance, unserved, routes_str)
        )
        conn.commit()
        return cursor.lastrowid

def db_get_optimized_routes() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        rows = conn.execute("SELECT * FROM optimized_routes ORDER BY id DESC LIMIT 10;").fetchall()
        routes = []
        for r in rows:
            rd = dict(r)
            rd["parameters"] = json.loads(rd["parameters"])
            rd["routes_json"] = json.loads(rd["routes_json"])
            routes.append(rd)
        return routes
