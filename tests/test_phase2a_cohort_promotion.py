"""
Phase 2A tests: Intraday Cohort Promotion & Day-3 Workflows

Tests cover:
- Cohort launch API
- Promotion guard rail checks
- Day-3 promotion approval flows
- Assistant endpoints for cohort status and readiness
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mock_mongo_client():
    """Mock MongoDB client for testing."""
    with patch("db.client.mongo_client") as mock:
        client = MagicMock()
        db = MagicMock()
        client.__enter__.return_value = client
        client.__getitem__.return_value = db
        mock.return_value = client
        yield db


@pytest.fixture
def sample_cohort_doc() -> Dict[str, Any]:
    """Sample cohort document for testing."""
    return {
        "cohort_id": "cohort-test-001",
        "created_at": datetime.utcnow(),
        "bankroll": 1000.0,
        "agent_count": 30,
        "allocation_policy": "equal",
        "symbol": "BTC/USDT",
        "interval": "1m",
        "horizon": "5m",
        "parent_wallet": {
            "name": "parent-test",
            "starting_balance": 1000.0,
            "balance": 1050.0,
            "equity": 1050.0,
            "utilization": 0.75,
            "aggregate_exposure": 750.0,
            "exposure_limit": 900.0,
            "leverage_ceiling": 5.0,
            "realized_pnl": 50.0,
            "capital_assigned": {},
            "capital_outstanding": {},
            "current_exposures": {},
            "metadata": {},
            "ledger": [],
        },
        "agents": [
            {
                "strategy_id": "ema-cross-gen5-001",
                "run_id": "run-001",
                "allocation": 33.33,
                "metrics": {
                    "roi": 0.08,
                    "realized_pnl": 2.67,
                    "confidence_score": 0.75,
                    "max_drawdown_parent": 0.02,
                    "trade_count": 12,
                    "avg_slippage_pct": 0.005,
                    "leverage_breach": False,
                },
                "alerts": [],
            },
            {
                "strategy_id": "ema-cross-gen5-002",
                "run_id": "run-002",
                "allocation": 33.33,
                "metrics": {
                    "roi": 0.05,
                    "realized_pnl": 1.67,
                    "confidence_score": 0.65,
                    "max_drawdown_parent": 0.03,
                    "trade_count": 8,
                    "avg_slippage_pct": 0.008,
                    "leverage_breach": False,
                },
                "alerts": [],
            },
        ],
        "alerts": [],
    }


@pytest.fixture
def sample_summary_doc() -> Dict[str, Any]:
    """Sample cohort summary document for testing."""
    return {
        "cohort_id": "cohort-test-001",
        "generated_at": datetime.utcnow(),
        "total_pnl": 50.0,
        "total_roi": 0.05,
        "bankroll_utilization_pct": 0.75,
        "trade_count": 20,
        "confidence_score": 0.70,
        "best_agent": {
            "strategy_id": "ema-cross-gen5-001",
            "run_id": "run-001",
            "roi": 0.08,
            "pnl": 2.67,
        },
        "worst_agent": {
            "strategy_id": "ema-cross-gen5-002",
            "run_id": "run-002",
            "roi": 0.05,
            "pnl": 1.67,
        },
        "alerts": [],
        "leverage_breaches": [],
    }


def test_launch_intraday_cohort_payload_validation():
    """Test payload validation for cohort launch endpoint."""
    from api.routes.experiments import IntradayLaunchPayload

    # Valid payload
    valid_payload = IntradayLaunchPayload(
        bankroll=1000.0,
        agent_count=30,
        allocation_policy="equal",
        leverage_ceiling=5.0,
        exposure_limit=900.0,
    )
    assert valid_payload.bankroll == 1000.0
    assert valid_payload.agent_count == 30

    # Invalid bankroll (negative)
    with pytest.raises(ValueError):
        IntradayLaunchPayload(
            bankroll=-100.0,
            agent_count=30,
        )

    # Invalid agent count (too high)
    with pytest.raises(ValueError):
        IntradayLaunchPayload(
            bankroll=1000.0,
            agent_count=250,  # exceeds max
        )


def test_promotion_guard_rail_checks(sample_cohort_doc, sample_summary_doc):
    """Test promotion guard rail evaluation logic."""
    from api.routes.experiments import _build_promotion_preview, _serialise_parent_snapshot

    parent_snapshot = _serialise_parent_snapshot(sample_cohort_doc["parent_wallet"])
    promotion_preview = _build_promotion_preview(sample_cohort_doc, sample_summary_doc, parent_snapshot)

    # Check basic structure
    assert "ready" in promotion_preview
    assert "checks" in promotion_preview
    assert len(promotion_preview["checks"]) > 0

    # Verify all checks have required fields
    for check in promotion_preview["checks"]:
        assert "id" in check
        assert "label" in check
        assert "status" in check
        assert "value" in check or check["value"] is None
        assert "threshold" in check

    # Check recommended allocation
    assert promotion_preview["recommended_allocation"] > 0
    assert promotion_preview["recommended_allocation"] <= sample_cohort_doc["bankroll"]


def test_promotion_guard_rails_pass_on_good_cohort(sample_cohort_doc, sample_summary_doc):
    """Test that guard rails pass when cohort meets all criteria."""
    from api.routes.experiments import _build_promotion_preview, _serialise_parent_snapshot

    parent_snapshot = _serialise_parent_snapshot(sample_cohort_doc["parent_wallet"])
    promotion_preview = _build_promotion_preview(sample_cohort_doc, sample_summary_doc, parent_snapshot)

    # All checks should pass for our sample data
    passed_checks = sum(1 for check in promotion_preview["checks"] if check["status"])
    assert passed_checks == len(promotion_preview["checks"])
    assert promotion_preview["ready"] is True


def test_promotion_guard_rails_fail_on_bad_cohort(sample_cohort_doc, sample_summary_doc):
    """Test that guard rails fail when cohort violates criteria."""
    from api.routes.experiments import _build_promotion_preview, _serialise_parent_snapshot

    # Introduce violations
    sample_summary_doc["leverage_breaches"] = [{"agent": "test", "breach": "high"}]
    sample_cohort_doc["parent_wallet"]["realized_pnl"] = -150.0  # High drawdown

    parent_snapshot = _serialise_parent_snapshot(sample_cohort_doc["parent_wallet"])
    promotion_preview = _build_promotion_preview(sample_cohort_doc, sample_summary_doc, parent_snapshot)

    # Some checks should fail
    failed_checks = sum(1 for check in promotion_preview["checks"] if not check["status"])
    assert failed_checks > 0
    assert promotion_preview["ready"] is False


def test_promotion_readiness_endpoint(mock_mongo_client, sample_cohort_doc, sample_summary_doc):
    """Test the assistant promotion readiness endpoint."""
    from api.routes.assistant import get_promotion_readiness

    # Setup mock
    mock_mongo_client["sim_runs_intraday"].find_one.return_value = sample_cohort_doc
    mock_mongo_client["cohort_summaries"].find_one.return_value = sample_summary_doc

    result = get_promotion_readiness("cohort-test-001")

    assert result["cohort_id"] == "cohort-test-001"
    assert "ready" in result
    assert "passed_checks" in result
    assert "total_checks" in result
    assert "recommended_allocation" in result
    assert "best_candidate_id" in result

    # Should match best agent from summary
    assert result["best_candidate_id"] == sample_summary_doc["best_agent"]["strategy_id"]


def test_cohorts_status_endpoint(mock_mongo_client, sample_cohort_doc, sample_summary_doc):
    """Test the assistant cohort status polling endpoint."""
    from api.routes.assistant import get_cohorts_status

    # Setup mock
    mock_mongo_client["sim_runs_intraday"].find.return_value.sort.return_value.limit.return_value = [
        sample_cohort_doc
    ]
    mock_mongo_client["cohort_summaries"].find.return_value = [sample_summary_doc]

    result = get_cohorts_status(limit=3)

    assert "cohorts" in result
    assert "count" in result
    assert result["count"] == 1
    assert len(result["cohorts"]) == 1

    cohort = result["cohorts"][0]
    assert cohort["cohort_id"] == "cohort-test-001"
    assert cohort["bankroll"] == 1000.0
    assert cohort["total_roi"] == sample_summary_doc["total_roi"]


def test_bankroll_summary_endpoint(mock_mongo_client):
    """Test the assistant bankroll summary endpoint."""
    from api.routes.assistant import get_bankroll_summary

    # Setup mock data for 3 cohorts
    cohorts = [
        {
            "cohort_id": f"cohort-{i}",
            "bankroll": 1000.0,
            "created_at": datetime.utcnow() - timedelta(days=i),
            "agent_count": 30,
        }
        for i in range(3)
    ]
    summaries = [
        {
            "cohort_id": f"cohort-{i}",
            "total_pnl": 50.0 * (i + 1),
            "bankroll_utilization_pct": 0.7 + (i * 0.05),
        }
        for i in range(3)
    ]

    mock_mongo_client["sim_runs_intraday"].find.return_value = cohorts
    mock_mongo_client["cohort_summaries"].find.return_value = summaries

    result = get_bankroll_summary()

    assert "cohort_count" in result
    assert "total_bankroll_allocated" in result
    assert "total_pnl" in result
    assert "avg_utilization_pct" in result
    assert "lookback_days" in result

    assert result["cohort_count"] == 3
    assert result["total_bankroll_allocated"] == 3000.0
    assert result["total_pnl"] == 300.0  # 50 + 100 + 150


def test_promotion_request_payload_validation():
    """Test promotion request payload validation."""
    from api.routes.experiments import PromotionRequestPayload

    # Valid payload
    valid_payload = PromotionRequestPayload(
        bankroll_slice_pct=0.05,
        min_allocation_usd=50.0,
        min_trade_count=6,
        max_slippage_pct=0.01,
        max_parent_drawdown=0.12,
        approval_notes="Approved by operator",
        acknowledge_risks=True,
    )
    assert valid_payload.bankroll_slice_pct == 0.05
    assert valid_payload.acknowledge_risks is True

    # Invalid slice (> 1)
    with pytest.raises(ValueError):
        PromotionRequestPayload(
            bankroll_slice_pct=1.5,
            acknowledge_risks=True,
        )

    # Invalid min allocation (negative)
    with pytest.raises(ValueError):
        PromotionRequestPayload(
            min_allocation_usd=-10.0,
            acknowledge_risks=True,
        )


def test_cohort_list_filters():
    """Test cohort list filtering logic."""
    from api.routes.experiments import _cohort_filters

    # Date filter
    filters = _cohort_filters(date="2025-01-15", bankroll=None)
    assert "created_at" in filters
    assert "$gte" in filters["created_at"]
    assert "$lt" in filters["created_at"]

    # Bankroll filter
    filters = _cohort_filters(date=None, bankroll=1000.0)
    assert "bankroll" in filters
    assert filters["bankroll"] == 1000.0

    # Both filters
    filters = _cohort_filters(date="2025-01-15", bankroll=1000.0)
    assert "created_at" in filters
    assert "bankroll" in filters


def test_serialise_cohort_detail():
    """Test cohort detail serialization."""
    from api.routes.experiments import _serialise_cohort_detail_doc

    doc = {
        "cohort_id": "test-001",
        "created_at": datetime(2025, 1, 15, 10, 0, 0),
        "symbol": "BTC/USDT",
        "bankroll": 1000.0,
        "agents": [
            {
                "strategy_id": "test-strategy",
                "run_id": "run-001",
                "allocation": 100.0,
                "metrics": {"roi": 0.05},
                "alerts": [],
            }
        ],
        "alerts": [],
        "window": {"start": datetime(2025, 1, 15, 9, 0, 0), "end": datetime(2025, 1, 15, 10, 0, 0)},
    }

    result = _serialise_cohort_detail_doc(doc)

    assert result["cohort_id"] == "test-001"
    assert result["bankroll"] == 1000.0
    assert len(result["agents"]) == 1
    assert result["agents"][0]["strategy_id"] == "test-strategy"
    # Datetime should be serialized to ISO string
    assert isinstance(result["created_at"], str)
    assert "2025-01-15" in result["created_at"]


def test_append_promotion_note(mock_mongo_client):
    """Test appending promotion approval notes."""
    from api.routes.experiments import _append_promotion_note

    _append_promotion_note("cohort-001", "Manual approval granted by ops team")

    # Verify insert was called
    mock_mongo_client["promotion_audit_events"].insert_one.assert_called_once()
    call_args = mock_mongo_client["promotion_audit_events"].insert_one.call_args[0][0]
    assert call_args["cohort_id"] == "cohort-001"
    assert "Manual approval" in call_args["note"]
    assert call_args["status"] == "operator_note"


def test_cohort_metrics_serialization():
    """Test serialization of cohort metrics with datetime fields."""
    from api.routes.experiments import _serialise_metrics

    metrics = {
        "roi": 0.05,
        "trade_count": 10,
        "timestamp_start": datetime(2025, 1, 15, 9, 0, 0),
        "timestamp_end": datetime(2025, 1, 15, 10, 0, 0),
        "max_drawdown": 0.02,
    }

    result = _serialise_metrics(metrics)

    assert result["roi"] == 0.05
    assert result["trade_count"] == 10
    # Datetimes should be serialized
    assert isinstance(result["timestamp_start"], str)
    assert isinstance(result["timestamp_end"], str)


def test_parent_snapshot_drawdown_calculation():
    """Test parent wallet drawdown percentage calculation."""
    from api.routes.experiments import _serialise_parent_snapshot

    parent = {
        "name": "parent-test",
        "starting_balance": 1000.0,
        "balance": 900.0,
        "equity": 900.0,
        "realized_pnl": -100.0,  # 10% loss
        "utilization": 0.5,
        "aggregate_exposure": 500.0,
        "capital_assigned": {},
        "capital_outstanding": {},
        "current_exposures": {},
        "metadata": {},
        "ledger": [],
    }

    result = _serialise_parent_snapshot(parent)

    assert result["drawdown_pct"] == 0.1  # 10% drawdown
    assert result["realized_pnl"] == -100.0


def test_guard_rail_progress_calculation():
    """Test guard rail progress percentage calculation (client-side logic simulation)."""
    checks = [
        {"id": "check1", "status": True},
        {"id": "check2", "status": True},
        {"id": "check3", "status": False},
        {"id": "check4", "status": True},
        {"id": "check5", "status": False},
    ]

    passed = sum(1 for check in checks if check["status"])
    progress = round((passed / len(checks)) * 100)

    assert progress == 60  # 3 out of 5 passed


def test_cohort_empty_agents_handling(sample_cohort_doc, sample_summary_doc):
    """Test handling of cohorts with no agents."""
    from api.routes.experiments import _build_promotion_preview, _serialise_parent_snapshot

    # Clear agents
    sample_cohort_doc["agents"] = []
    sample_summary_doc["best_agent"] = None

    parent_snapshot = _serialise_parent_snapshot(sample_cohort_doc["parent_wallet"])
    promotion_preview = _build_promotion_preview(sample_cohort_doc, sample_summary_doc, parent_snapshot)

    # Should still return valid structure
    assert "ready" in promotion_preview
    assert "checks" in promotion_preview
    # But ready should be False due to no agents/trades
    assert promotion_preview["ready"] is False

