import time
import math
import numpy as np
from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Dict, Any

from app.api.schemas import (
    UserRegister, UserLogin, TokenSchema, 
    DeliveryCreate, DeliveryResponse, AcoParamsSchema, OptimizationResult
)
from app.auth.auth import (
    hash_password, verify_password, create_access_token, 
    check_role_permissions, get_current_user_claims
)
from app.ml.ant_colony.aco import AntColonyOptimizer
from app.db import (
    db_get_user, db_create_user, db_get_all_deliveries, db_get_delivery,
    db_create_delivery, db_update_delivery_status, db_delete_delivery,
    db_log_optimized_route, db_get_optimized_routes
)

router = APIRouter()

# Central Depot Location (San Francisco Operations)
DEPOT_COORDS = {"lat": 37.7749, "lng": -122.4194}

# Helper to compute Haversine distance
def calculate_haversine(lat1, lon1, lat2, lon2):
    R = 6371.0 # km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# --- AUTHENTICATION ---
@router.post("/auth/register", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
def register_user(user: UserRegister):
    existing_user = db_get_user(user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Account already registered under this email.")
    
    success = db_create_user(
        email=user.email,
        password_hash=hash_password(user.password),
        full_name=user.full_name,
        role=user.role
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to register user. Try again.")
        
    return {"message": "User account created successfully."}

@router.post("/auth/login", response_model=TokenSchema)
def login_user(credentials: UserLogin):
    user = db_get_user(credentials.email)
    
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials. Verify email or password.")
        
    token = create_access_token({"sub": user["email"], "role": user["role"], "name": user["full_name"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "name": user["full_name"]
    }

# --- DELIVERIES MANAGEMENT ---
@router.get("/deliveries", response_model=List[DeliveryResponse])
def get_all_deliveries():
    return db_get_all_deliveries()

@router.post("/deliveries", response_model=DeliveryResponse, status_code=status.HTTP_201_CREATED)
def create_delivery(delivery: DeliveryCreate, claims: Dict[str, Any] = Depends(check_role_permissions(["dispatcher", "admin"]))):
    dlv_id = f"DLV-{int(time.time() * 1000) % 10000:04d}"
    new_dlv = db_create_delivery(
        dlv_id=dlv_id,
        dest=delivery.destination,
        lat=delivery.lat,
        lng=delivery.lng,
        priority=delivery.priority,
        weight=delivery.weight,
        driver=delivery.driver
    )
    return new_dlv

@router.put("/deliveries/{delivery_id}/status", response_model=DeliveryResponse)
def update_delivery_status(delivery_id: str, status_str: str, claims: Dict[str, Any] = Depends(get_current_user_claims)):
    existing = db_get_delivery(delivery_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Delivery dispatch not found.")
    
    updated = db_update_delivery_status(delivery_id, status_str)
    return updated

@router.delete("/deliveries/{delivery_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_delivery(delivery_id: str, claims: Dict[str, Any] = Depends(check_role_permissions(["dispatcher", "admin"]))):
    existing = db_get_delivery(delivery_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Delivery dispatch not found.")
    
    db_delete_delivery(delivery_id)
    return

# --- ANT COLONY ROUTE OPTIMIZATION ENGINE RUNNER ---
@router.post("/optimize", response_model=OptimizationResult)
def execute_aco_optimization(params: AcoParamsSchema, claims: Dict[str, Any] = Depends(get_current_user_claims)):
    # Gather pending/active deliveries
    all_deliveries = db_get_all_deliveries()
    active_dlvs = [d for d in all_deliveries if d["status"] != "Delivered"]
    
    if not active_dlvs:
        raise HTTPException(status_code=400, detail="No active dispatches available to optimize.")
        
    t_start = time.time()
    
    # 0 = Depot, 1..N = Deliveries
    nodes = [{"lat": DEPOT_COORDS["lat"], "lng": DEPOT_COORDS["lng"]}] + active_dlvs
    N = len(nodes)
    
    # Distance matrix calculations
    distances = np.zeros((N, N))
    for i in range(N):
        for j in range(N):
            distances[i][j] = calculate_haversine(
                nodes[i]["lat"], nodes[i]["lng"],
                nodes[j]["lat"], nodes[j]["lng"]
            )
            
    # Demand limits, priorities, and capacity mappings
    demands = [0.0] + [float(d["weight"]) for d in active_dlvs]
    
    priority_weights = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}
    priorities = [0] + [priority_weights[d["priority"]] for d in active_dlvs]
    
    # Multi-vehicle fleet capacities allocation (e.g. 5 trucks capacity)
    capacities = [params.capacity] * 5 
    
    # Instantiate Swarm Optimization solver
    aco = AntColonyOptimizer(
        distances=distances,
        demands=demands,
        capacities=capacities,
        priorities=priorities,
        alpha=params.alpha,
        beta=params.beta,
        rho=params.rho,
        num_ants=params.ants,
        num_iterations=params.iterations
    )
    
    res = aco.optimize()
    t_duration = (time.time() - t_start) * 1000.0 # ms
    
    # Persist the optimized route logs in our database history
    param_dict = {
        "alpha": params.alpha,
        "beta": params.beta,
        "rho": params.rho,
        "ants": params.ants,
        "iterations": params.iterations,
        "capacity": params.capacity
    }
    
    db_log_optimized_route(
        params=param_dict,
        distance=res["distance_km"],
        unserved=res["unserved_deliveries"],
        routes=res["optimal_routes"]
    )
    
    return {
        "optimal_routes": res["optimal_routes"],
        "distance_km": res["distance_km"],
        "unserved_deliveries": res["unserved_deliveries"],
        "computation_ms": t_duration
    }

# --- ANALYTICS DASHBOARD KPI ---
@router.get("/analytics")
def get_logistics_analytics():
    all_deliveries = db_get_all_deliveries()
    active_count = len([d for d in all_deliveries if d["status"] != "Delivered"])
    
    # Fetch database optimization routes history
    history_logs = db_get_optimized_routes()
    
    # Calculate a dynamic optimization score trend
    # Default visual baseline improvements over time
    opt_trend = [91.2, 92.5, 93.1, 94.8]
    if len(history_logs) > 0:
        # Construct dynamic score representing normalized distances of optimized runs
        # Closer to 0 unserved is higher score
        opt_trend = []
        for run in reversed(history_logs[:4]):
            unserved = run["unserved_deliveries"]
            score = max(50.0, 100.0 - (unserved * 10.0) - (run["distance_km"] * 0.05))
            opt_trend.append(round(score, 1))
        
        # Backfill if history is short
        while len(opt_trend) < 4:
            opt_trend.insert(0, 90.0)
            
    # Calculate weekly fuel savings representation
    fuel_saved = [310, 480, 520, 680]
    if len(history_logs) > 0:
        # Liters saved relative to calculated route distances
        fuel_saved = []
        for run in reversed(history_logs[:5]):
            saved_liters = int(run["distance_km"] * 0.15) # Assume ~0.15L saved per km optimal pathing
            fuel_saved.append(max(50, saved_liters))
            
    # Compile driver-specific statistics based on database assignments
    driver_trips = {}
    for d in all_deliveries:
        driver = d["driver"]
        if driver not in driver_trips:
            driver_trips[driver] = {"trips": 0, "on_time_percentage": 95.0}
        driver_trips[driver]["trips"] += 1
        if d["status"] == "Delivered":
            driver_trips[driver]["on_time_percentage"] = min(100.0, driver_trips[driver]["on_time_percentage"] + 0.5)

    return {
        "active_deliveries": active_count,
        "optimization_score_trend": opt_trend,
        "fuel_saved_liters_weekly": fuel_saved,
        "driver_stats": driver_trips or {
            "Rahul Sharma": {"trips": 12, "on_time_percentage": 97.4},
            "Amit Verma": {"trips": 10, "on_time_percentage": 94.2},
            "Neha Singh": {"trips": 15, "on_time_percentage": 98.9}
        }
    }
