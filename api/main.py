from __future__ import annotations

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

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
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

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


@app.get("/api/status")
def status() -> dict[str, str]:
    return {"status": "ok"}

