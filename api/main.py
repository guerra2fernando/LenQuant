from __future__ import annotations

import logging
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.auth.jwt import decode_access_token

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)
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

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests for debugging."""
    logger.info(f"{request.method} {request.url.path} - Client: {request.client.host if request.client else 'unknown'}")
    try:
        response = await call_next(request)
        logger.info(f"{request.method} {request.url.path} - Status: {response.status_code}")
        return response
    except Exception as exc:
        logger.error(f"Error processing {request.method} {request.url.path}: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://lenquant.com",
        "https://www.lenquant.com",
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
        logger.debug(f"Connected WebSocket for user {user_id}. Total connections: {len(self.active_connections[user_id])}")
    
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
                    logger.debug(f"Broadcasted notification to user {user_id}")
                except Exception as exc:
                    logger.warning(f"Failed to send notification to user {user_id}: {exc}")
                    dead_connections.add(connection)
            
            # Clean up dead connections
            for conn in dead_connections:
                await self.disconnect(user_id, conn)
        else:
            logger.debug(f"No active connections for user {user_id} to broadcast to")


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
    client_host = websocket.client.host if websocket.client else "unknown"
    logger.info(f"WebSocket connection attempt from {client_host}")
    
    # Get token from query parameters
    query_params = dict(websocket.query_params)
    token = query_params.get("token")
    
    # Authenticate via token (passed as query param)
    if not token:
        logger.warning(f"WebSocket connection rejected: Missing authentication token from {client_host}")
        await websocket.close(code=1008, reason="Missing authentication token")
        return
    
    try:
        token_data = decode_access_token(token)
        if not token_data:
            logger.warning(f"WebSocket connection rejected: Invalid token from {client_host}")
            await websocket.close(code=1008, reason="Invalid token")
            return
        user_id = token_data.user_id
        logger.info(f"WebSocket connection authenticated for user {user_id} from {client_host}")
    except Exception as exc:
        logger.error(f"WebSocket authentication error from {client_host}: {exc}", exc_info=True)
        await websocket.close(code=1008, reason="Invalid token")
        return
    
    await notification_manager.connect(user_id, websocket)
    logger.info(f"WebSocket connected for user {user_id}")
    
    try:
        # Send initial unread count
        from db.repositories.notification_repository import NotificationRepository
        repo = NotificationRepository()
        unread_count = repo.get_unread_count(user_id)
        await websocket.send_json({
            "type": "unread_count",
            "count": unread_count
        })
        logger.debug(f"Sent initial unread count ({unread_count}) to user {user_id}")
        
        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            logger.debug(f"Received WebSocket message from user {user_id}: {data[:100]}")
            # Handle client requests (e.g., "get_recent", "mark_read", etc.)
            # For now, just keep connection alive
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user_id}")
        await notification_manager.disconnect(user_id, websocket)
    except Exception as exc:
        logger.error(f"WebSocket error for user {user_id}: {exc}", exc_info=True)
        await notification_manager.disconnect(user_id, websocket)


@app.get("/api/status")
def status() -> dict[str, str]:
    return {"status": "ok"}

