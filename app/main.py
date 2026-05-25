import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from app.api.routes import router as api_router
from app.db import init_db

app = FastAPI(
    title="Intelligent Logistics & Route Optimization API",
    description="Production-grade FastAPI backend featuring an Ant Colony Optimization routing engine and WebSocket support.",
    version="1.0.0"
)

@app.on_event("startup")
def startup_db():
    init_db()

# CORS Policy configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Bind modular API routes
app.include_router(api_router, prefix="/api")

# WebSocket Connections manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Connection might have dropped silently
                pass

manager = ConnectionManager()

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Smart Logistics Engine API",
        "engine": "Ant Colony Swarm (ACO) Core v1.0.0"
    }

# WebSockets Endpoint for real-time simulated telemetry tracking
@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Broadcast connection success notice
        await websocket.send_json({
            "event": "connected",
            "message": "Connected to real-time telemetry streaming stream."
        })
        
        while True:
            # Keep connection open and listen for client inputs/heartbeats
            data = await websocket.receive_json()
            # Broadcast received telemetry (e.g. vehicle coordinate shifts)
            await manager.broadcast({
                "event": "telemetry_update",
                "data": data
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
