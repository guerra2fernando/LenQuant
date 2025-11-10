from __future__ import annotations

from assistant.action_manager import ActionManager
from assistant.llm import generate_assistant_message
from assistant.schemas import AssistantSettings


def test_generate_assistant_message_produces_fallback_without_provider(monkeypatch) -> None:
    monkeypatch.delenv("ASSISTANT_LLM_PROVIDER", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    message, provider = generate_assistant_message(
        "Which strategy led the leaderboard yesterday?",
        [
            {
                "strategy_id": "ema-cross-gen1",
                "family": "ema-cross",
                "generation": 1,
                "fitness": {
                    "roi": 0.12,
                    "sharpe": 1.3,
                    "forecast_alignment": 0.65,
                    "max_drawdown": 0.08,
                },
            }
        ],
    )

    assert message is not None
    assert "Strategy" in message or "Top" in message
    assert provider in {"fallback", "disabled"}


def test_action_manager_generates_recommendation(monkeypatch) -> None:
    captured = {}

    def fake_upsert(recommendation):
        stored = recommendation.serialise_for_db()
        captured["rec"] = stored
        return stored

    monkeypatch.setattr("assistant.action_manager.upsert_recommendation", fake_upsert)

    manager = ActionManager(settings=AssistantSettings(provider="disabled"))
    strategies = [
        {
            "strategy_id": "ema-cross-gen1",
            "symbol": "ETH/USDT",
            "interval": "1h",
            "family": "ema-cross",
            "generation": 2,
            "fitness": {
                "roi": 0.018,
                "sharpe": 1.5,
                "forecast_alignment": 0.72,
                "max_drawdown": 0.05,
            },
            "last_run_id": "run-123",
        }
    ]

    generated = manager.auto_generate_recommendations(strategies=strategies)
    assert generated
    recommendation = generated[0]
    assert recommendation["symbol"] == "ETH/USDT"
    assert recommendation["status"] == "pending"
    assert "strategies/ema-cross-gen1" in recommendation["evidence_refs"]
    assert captured["rec"]["rec_id"] == recommendation["rec_id"]
