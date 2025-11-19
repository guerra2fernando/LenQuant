from __future__ import annotations

from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from api.auth.jwt import decode_access_token
from api.routes import (
    admin,
    assistant,
    auth,
    evolution,
    experiments,
    forecast,
    knowledge,
    leaderboard,
    learning,
    macro,
    models,
    notifications,
    reports,
    runs,
    settings,
    strategies,
    trade,
    risk,
)

app = FastAPI(title="LenQuant Core API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://lenquant.com",  
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth router (PUBLIC - no authentication required)
# Note: Using /api/v1/auth to avoid conflict with NextAuth's /api/auth routes
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])

# Existing routers
app.include_router(runs.router, prefix="/api/run")
app.include_router(reports.router, prefix="/api/reports")
app.include_router(models.router, prefix="/api/models")
app.include_router(leaderboard.router, prefix="/api/leaderboard")
app.include_router(strategies.router, prefix="/api/strategies")
app.include_router(settings.router, prefix="/api/settings")
app.include_router(forecast.router, prefix="/api/forecast")
app.include_router(evolution.router, prefix="/api/evolution")
app.include_router(experiments.router, prefix="/api/experiments")
app.include_router(assistant.router, prefix="/api/assistant")
app.include_router(learning.router, prefix="/api/learning")
app.include_router(knowledge.router, prefix="/api/knowledge")
app.include_router(admin.router, prefix="/api/admin")
app.include_router(trade.router, prefix="/api/trading")
app.include_router(risk.router, prefix="/api/risk")
app.include_router(macro.router, prefix="/api/macro")
app.include_router(notifications.router, prefix="/api", tags=["notifications"])


# WebSocket Notification Connection Manager
class NotificationConnectionManager:
    """Manages WebSocket connections for real-time notification delivery."""
    
    def __init__(self):
        self.active_connections: dict[str, Set[WebSocket]] = {}
    
    async def connect(self, user_id: str, websocket: WebSocket):
        """Connect a WebSocket for a user."""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
    
    async def disconnect(self, user_id: str, websocket: WebSocket):
        """Disconnect a WebSocket for a user."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
    
    async def broadcast_to_user(self, user_id: str, message: dict):
        """Send notification to all of a user's open connections."""
        if user_id in self.active_connections:
            dead_connections = set()
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead_connections.add(connection)
            
            # Clean up dead connections
            for conn in dead_connections:
                await self.disconnect(user_id, conn)


notification_manager = NotificationConnectionManager()


# WebSocket endpoints (mounted at root to match documentation)
@app.websocket("/ws/trading")
async def websocket_trading(websocket: WebSocket):
    """WebSocket endpoint for real-time trading updates."""
    from api.routes.trade import websocket_trading as trading_ws
    await trading_ws(websocket)


@app.websocket("/ws/evolution")
async def websocket_evolution(websocket: WebSocket):
    """WebSocket endpoint for real-time evolution experiment updates."""
    from api.routes.evolution import websocket_evolution as evolution_ws
    await evolution_ws(websocket)


@app.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket):
    """WebSocket endpoint for real-time notification delivery."""
    # Get token from query parameters
    query_params = dict(websocket.query_params)
    token = query_params.get("token")
    
    # Authenticate via token (passed as query param)
    if not token:
        await websocket.close(code=1008, reason="Missing authentication token")
        return
    
    try:
        token_data = decode_access_token(token)
        if not token_data:
            await websocket.close(code=1008, reason="Invalid token")
            return
        user_id = token_data.user_id
    except Exception:
        await websocket.close(code=1008, reason="Invalid token")
        return
    
    await notification_manager.connect(user_id, websocket)
    
    try:
        # Send initial unread count
        from db.repositories.notification_repository import NotificationRepository
        repo = NotificationRepository()
        unread_count = repo.get_unread_count(user_id)
        await websocket.send_json({
            "type": "unread_count",
            "count": unread_count
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            # Handle client requests (e.g., "get_recent", "mark_read", etc.)
            # For now, just keep connection alive
    except WebSocketDisconnect:
        await notification_manager.disconnect(user_id, websocket)
    except Exception as exc:
        await notification_manager.disconnect(user_id, websocket)
        print(f"Notification WebSocket error: {exc}")


@app.get("/api/status")
def status() -> dict[str, str]:
    return {"status": "ok"}

