"""
Tests for Strategy Evolution Regime Scoring

Tests regime-aware strategy evaluation, promotion, and leaderboard functionality.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict
from unittest.mock import MagicMock, Mock, patch

import pandas as pd
import pytest

from evolution.evaluator import (
    _determine_preferred_regime,
    _find_regime_at_timestamp,
    _score_by_regime,
)
from evolution.promoter import (
    _calculate_regime_bonus,
    _get_current_regime,
    _get_regime_performance_for_regime,
    _get_strategy_regime_preference,
    decide_promotion,
)
from evolution.schemas import PromotionPolicy
from reports.leaderboard import (
    _get_regime_performance_summary,
    _prepare_entry,
    generate_regime_leaderboard,
    get_regime_specialists,
)


# --- Test Data Fixtures ---


@pytest.fixture
def mock_trades() -> list[Dict[str, Any]]:
    """Generate mock trade data for testing."""
    base_time = datetime(2024, 1, 1, 0, 0, 0)
    trades = []
    
    # Trades in TRENDING_UP regime (profitable)
    for i in range(25):
        trades.append({
            "entry_time": base_time + timedelta(hours=i),
            "pnl": 100.0 + (i % 5) * 10.0,  # Positive PnL
            "profit": 100.0 + (i % 5) * 10.0,
            "position_size_usd": 1000.0,
        })
    
    # Trades in TRENDING_DOWN regime (losing)
    for i in range(25, 50):
        trades.append({
            "entry_time": base_time + timedelta(hours=i),
            "pnl": -50.0 - (i % 3) * 5.0,  # Negative PnL
            "profit": -50.0 - (i % 3) * 5.0,
            "position_size_usd": 1000.0,
        })
    
    # Trades in SIDEWAYS regime (mixed)
    for i in range(50, 75):
        trades.append({
            "entry_time": base_time + timedelta(hours=i),
            "pnl": 20.0 if i % 2 == 0 else -15.0,  # Mixed PnL
            "profit": 20.0 if i % 2 == 0 else -15.0,
            "position_size_usd": 1000.0,
        })
    
    return trades


@pytest.fixture
def mock_regime_transitions() -> list[Dict[str, Any]]:
    """Generate mock regime transition data."""
    base_time = datetime(2024, 1, 1, 0, 0, 0)
    
    return [
        {
            "timestamp": base_time,
            "trend": "TRENDING_UP",
            "volatility": "NORMAL_VOLATILITY",
            "confidence": 0.8,
        },
        {
            "timestamp": base_time + timedelta(hours=25),
            "trend": "TRENDING_DOWN",
            "volatility": "HIGH_VOLATILITY",
            "confidence": 0.75,
        },
        {
            "timestamp": base_time + timedelta(hours=50),
            "trend": "SIDEWAYS",
            "volatility": "LOW_VOLATILITY",
            "confidence": 0.85,
        },
    ]


@pytest.fixture
def mock_run_doc(mock_trades, mock_regime_transitions) -> Dict[str, Any]:
    """Generate mock simulation run document."""
    return {
        "run_id": "test_run_123",
        "trades": mock_trades,
        "context": {
            "regime_transitions": mock_regime_transitions,
        },
        "results": {
            "roi": 0.15,
            "sharpe": 1.5,
            "max_drawdown": 0.08,
            "composite": 1.2,
        },
    }


@pytest.fixture
def mock_strategy_doc() -> Dict[str, Any]:
    """Generate mock strategy document with regime performance."""
    return {
        "strategy_id": "test_strategy_456",
        "fitness": {
            "roi": 0.15,
            "sharpe": 1.5,
            "max_drawdown": 0.08,
            "composite": 1.2,
        },
        "regime_performance": {
            "TRENDING_UP": {
                "sharpe": 2.5,
                "roi": 0.25,
                "win_rate": 0.72,
                "avg_pnl": 110.0,
                "total_pnl": 2750.0,
                "max_drawdown": 0.05,
                "trades": 25,
                "wins": 18,
                "losses": 7,
            },
            "TRENDING_DOWN": {
                "sharpe": -0.5,
                "roi": -0.08,
                "win_rate": 0.32,
                "avg_pnl": -55.0,
                "total_pnl": -1375.0,
                "max_drawdown": 0.15,
                "trades": 25,
                "wins": 8,
                "losses": 17,
            },
            "SIDEWAYS": {
                "sharpe": 0.8,
                "roi": 0.05,
                "win_rate": 0.52,
                "avg_pnl": 2.5,
                "total_pnl": 62.5,
                "max_drawdown": 0.07,
                "trades": 25,
                "wins": 13,
                "losses": 12,
            },
        },
        "preferred_regime": "TRENDING_UP",
        "regime_analysis_updated_at": datetime.utcnow(),
    }


# --- Tests for evolution/evaluator.py ---


class TestFindRegimeAtTimestamp:
    """Tests for _find_regime_at_timestamp function."""
    
    def test_direct_lookup(self, mock_regime_transitions):
        """Test direct timestamp lookup in regime map."""
        regime_map = {
            datetime(2024, 1, 1, 0, 0, 0): {
                "trend": "TRENDING_UP",
                "volatility": "NORMAL_VOLATILITY",
            }
        }
        
        timestamp = datetime(2024, 1, 1, 0, 0, 0)
        result = _find_regime_at_timestamp(timestamp, regime_map, mock_regime_transitions)
        
        assert result["trend"] == "TRENDING_UP"
        assert result["volatility"] == "NORMAL_VOLATILITY"
    
    def test_recent_regime_lookup(self, mock_regime_transitions):
        """Test finding most recent regime before timestamp."""
        regime_map = {}
        timestamp = datetime(2024, 1, 1, 30, 0, 0)
        
        result = _find_regime_at_timestamp(timestamp, regime_map, mock_regime_transitions)
        
        # Should find TRENDING_DOWN regime at hour 25
        assert result["trend"] == "TRENDING_DOWN"
        assert result["volatility"] == "HIGH_VOLATILITY"
    
    def test_no_regime_found(self):
        """Test behavior when no regime data available."""
        regime_map = {}
        regime_transitions = []
        timestamp = datetime(2024, 1, 1, 0, 0, 0)
        
        result = _find_regime_at_timestamp(timestamp, regime_map, regime_transitions)
        
        assert result["trend"] == "UNDEFINED"
        assert result["volatility"] == "UNDEFINED"


class TestScoreByRegime:
    """Tests for _score_by_regime function."""
    
    @patch("evolution.evaluator.mongo_client")
    def test_successful_scoring(self, mock_mongo, mock_run_doc):
        """Test successful regime scoring with sufficient data."""
        # Mock MongoDB client
        mock_collection = MagicMock()
        mock_collection.find_one.return_value = mock_run_doc
        
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)
        
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=None)
        mock_client.__getitem__ = MagicMock(return_value=mock_db)
        
        mock_mongo.return_value = mock_client
        
        # Execute
        result = _score_by_regime("test_run_123", min_trades=20)
        
        # Verify
        assert "TRENDING_UP" in result
        assert "TRENDING_DOWN" in result
        assert "SIDEWAYS" in result
        
        # Check TRENDING_UP metrics (should be profitable)
        trending_up = result["TRENDING_UP"]
        assert trending_up["trades"] == 25
        assert trending_up["sharpe"] > 0
        assert trending_up["total_pnl"] > 0
        
        # Check TRENDING_DOWN metrics (should be losing)
        trending_down = result["TRENDING_DOWN"]
        assert trending_down["trades"] == 25
        assert trending_down["total_pnl"] < 0
    
    @patch("evolution.evaluator.mongo_client")
    def test_insufficient_trades_per_regime(self, mock_mongo, mock_run_doc):
        """Test that regimes with insufficient trades are skipped."""
        # Modify run doc to have fewer trades
        mock_run_doc["trades"] = mock_run_doc["trades"][:30]
        
        mock_collection = MagicMock()
        mock_collection.find_one.return_value = mock_run_doc
        
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)
        
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=None)
        mock_client.__getitem__ = MagicMock(return_value=mock_db)
        
        mock_mongo.return_value = mock_client
        
        # Execute with high min_trades requirement
        result = _score_by_regime("test_run_123", min_trades=40)
        
        # Verify that no regimes pass the threshold
        assert len(result) == 0
    
    @patch("evolution.evaluator.mongo_client")
    def test_run_not_found(self, mock_mongo):
        """Test behavior when run document not found."""
        mock_collection = MagicMock()
        mock_collection.find_one.return_value = None
        
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)
        
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=None)
        mock_client.__getitem__ = MagicMock(return_value=mock_db)
        
        mock_mongo.return_value = mock_client
        
        result = _score_by_regime("nonexistent_run")
        
        assert result == {}


class TestDeterminePreferredRegime:
    """Tests for _determine_preferred_regime function."""
    
    def test_clear_preference(self, mock_strategy_doc):
        """Test identification of clear regime preference."""
        regime_perf = mock_strategy_doc["regime_performance"]
        
        result = _determine_preferred_regime(regime_perf)
        
        # Should prefer TRENDING_UP due to highest metrics
        assert result == "TRENDING_UP"
    
    def test_no_significant_preference(self):
        """Test when no regime significantly outperforms others."""
        regime_perf = {
            "TRENDING_UP": {
                "sharpe": 1.0,
                "roi": 0.10,
                "win_rate": 0.55,
                "max_drawdown": 0.08,
            },
            "TRENDING_DOWN": {
                "sharpe": 0.95,
                "roi": 0.09,
                "win_rate": 0.53,
                "max_drawdown": 0.09,
            },
            "SIDEWAYS": {
                "sharpe": 1.05,
                "roi": 0.11,
                "win_rate": 0.56,
                "max_drawdown": 0.07,
            },
        }
        
        result = _determine_preferred_regime(regime_perf)
        
        # Scores too similar, should return None
        assert result is None
    
    def test_empty_performance_data(self):
        """Test with empty regime performance data."""
        result = _determine_preferred_regime({})
        
        assert result is None


# --- Tests for evolution/promoter.py ---


class TestGetCurrentRegime:
    """Tests for _get_current_regime function."""
    
    @patch("evolution.promoter.RegimeDetector")
    def test_successful_regime_retrieval(self, mock_detector_class):
        """Test successful retrieval of current regime."""
        mock_regime = Mock()
        mock_regime.trend_regime.value = "TRENDING_UP"
        
        mock_detector = Mock()
        mock_detector.get_latest_regime.return_value = mock_regime
        
        mock_detector_class.return_value = mock_detector
        
        result = _get_current_regime("BTC/USD", "1h")
        
        assert result == "TRENDING_UP"
        mock_detector.get_latest_regime.assert_called_once_with("BTC/USD", "1h")
    
    @patch("evolution.promoter.RegimeDetector")
    def test_no_regime_available(self, mock_detector_class):
        """Test when no regime data is available."""
        mock_detector = Mock()
        mock_detector.get_latest_regime.return_value = None
        
        mock_detector_class.return_value = mock_detector
        
        result = _get_current_regime("BTC/USD", "1h")
        
        assert result is None
    
    @patch("evolution.promoter.RegimeDetector")
    def test_detector_exception(self, mock_detector_class):
        """Test graceful handling of detector exceptions."""
        mock_detector_class.side_effect = Exception("Database error")
        
        result = _get_current_regime("BTC/USD", "1h")
        
        assert result is None


class TestCalculateRegimeBonus:
    """Tests for _calculate_regime_bonus function."""
    
    @patch("evolution.promoter._get_strategy_regime_preference")
    def test_matching_regime_stable(self, mock_get_pref):
        """Test bonus when strategy prefers current stable regime."""
        mock_get_pref.return_value = "TRENDING_UP"
        
        bonus = _calculate_regime_bonus("test_strat", "TRENDING_UP", regime_stable=True)
        
        assert bonus == 1.2  # 20% bonus
    
    @patch("evolution.promoter._get_strategy_regime_preference")
    def test_matching_regime_unstable(self, mock_get_pref):
        """Test smaller bonus when regime is unstable."""
        mock_get_pref.return_value = "TRENDING_UP"
        
        bonus = _calculate_regime_bonus("test_strat", "TRENDING_UP", regime_stable=False)
        
        assert bonus == 1.1  # 10% bonus
    
    @patch("evolution.promoter._get_strategy_regime_preference")
    def test_non_matching_regime(self, mock_get_pref):
        """Test penalty when strategy doesn't prefer current regime."""
        mock_get_pref.return_value = "TRENDING_DOWN"
        
        bonus = _calculate_regime_bonus("test_strat", "TRENDING_UP", regime_stable=True)
        
        assert bonus == 0.95  # 5% penalty
    
    @patch("evolution.promoter._get_strategy_regime_preference")
    def test_no_preference(self, mock_get_pref):
        """Test neutral multiplier when no preference exists."""
        mock_get_pref.return_value = None
        
        bonus = _calculate_regime_bonus("test_strat", "TRENDING_UP", regime_stable=True)
        
        assert bonus == 1.0  # Neutral
    
    def test_undefined_regime(self):
        """Test neutral multiplier for undefined regime."""
        bonus = _calculate_regime_bonus("test_strat", "UNDEFINED", regime_stable=True)
        
        assert bonus == 1.0  # Neutral


class TestDecidePromotionRegimeAware:
    """Tests for regime-aware decide_promotion function."""
    
    @patch("evolution.promoter.load_experiment")
    @patch("evolution.promoter._get_current_regime")
    @patch("evolution.promoter._get_strategy_regime_preference")
    @patch("evolution.promoter._calculate_regime_bonus")
    def test_promotion_with_regime_bonus(
        self,
        mock_bonus,
        mock_pref,
        mock_current,
        mock_load_exp,
    ):
        """Test promotion decision with regime bonus applied."""
        # Setup mocks
        mock_load_exp.return_value = {
            "experiment_id": "exp_123",
            "status": "completed",
            "score": 1.0,
            "candidate": {
                "genome": {"strategy_id": "strat_456"},
                "parent_id": None,
            },
            "metrics": {
                "roi": 0.15,
                "sharpe": 1.5,
                "max_drawdown": 0.08,
                "composite": 1.2,
            },
        }
        
        mock_current.return_value = "TRENDING_UP"
        mock_pref.return_value = "TRENDING_UP"
        mock_bonus.return_value = 1.2
        
        policy = PromotionPolicy(min_roi=0.10, min_sharpe=1.0, max_drawdown=0.15)
        
        # Execute
        decision = decide_promotion("exp_123", policy, enable_regime_bonus=True)
        
        # Verify
        assert decision is not None
        assert decision.approved is True
        assert decision.metadata["regime_bonus"] == 1.2
        assert decision.metadata["adjusted_score"] == 1.2  # 1.0 * 1.2
        assert decision.metadata["current_regime"] == "TRENDING_UP"
        assert decision.metadata["preferred_regime"] == "TRENDING_UP"
    
    @patch("evolution.promoter.load_experiment")
    @patch("evolution.promoter._get_current_regime")
    @patch("evolution.promoter._get_strategy_regime_preference")
    @patch("evolution.promoter._get_regime_performance_for_regime")
    def test_regime_specialist_override(
        self,
        mock_regime_perf,
        mock_pref,
        mock_current,
        mock_load_exp,
    ):
        """Test that regime specialists can override general thresholds."""
        # Setup mocks - strategy that fails general thresholds
        mock_load_exp.return_value = {
            "experiment_id": "exp_123",
            "status": "completed",
            "score": 0.5,  # Low general score
            "candidate": {
                "genome": {"strategy_id": "strat_456"},
                "parent_id": None,
            },
            "metrics": {
                "roi": 0.01,  # Below threshold
                "sharpe": 0.8,  # Below threshold
                "max_drawdown": 0.10,
                "composite": 0.5,
            },
        }
        
        mock_current.return_value = "TRENDING_UP"
        mock_pref.return_value = "TRENDING_UP"
        
        # But excellent regime-specific performance
        mock_regime_perf.return_value = {
            "sharpe": 2.0,  # Strong in this regime
            "roi": 0.20,
            "win_rate": 0.75,
            "trades": 50,
        }
        
        policy = PromotionPolicy(min_roi=0.10, min_sharpe=1.0, max_drawdown=0.15)
        
        # Execute
        decision = decide_promotion("exp_123", policy, enable_regime_bonus=True)
        
        # Verify - should be approved via regime specialist override
        assert decision is not None
        assert decision.approved is True
        assert decision.reason == "regime_specialist_override"


# --- Tests for reports/leaderboard.py ---


class TestPrepareEntry:
    """Tests for _prepare_entry function."""
    
    def test_entry_with_regime_data(self, mock_strategy_doc):
        """Test entry preparation with regime performance data."""
        entry = _prepare_entry(mock_strategy_doc, include_regime=True)
        
        assert entry["strategy_id"] == "test_strategy_456"
        assert entry["preferred_regime"] == "TRENDING_UP"
        assert entry["regime_specialist"] is True
        assert entry["regimes_traded"] == 3
        assert entry["regime_performance_available"] is True
    
    def test_entry_without_regime_data(self, mock_strategy_doc):
        """Test entry preparation without regime performance."""
        # Remove regime data
        mock_strategy_doc.pop("regime_performance")
        mock_strategy_doc.pop("preferred_regime")
        
        entry = _prepare_entry(mock_strategy_doc, include_regime=True)
        
        assert entry["preferred_regime"] is None
        assert entry["regime_specialist"] is False
        assert entry["regimes_traded"] == 0
    
    def test_entry_regime_disabled(self, mock_strategy_doc):
        """Test entry preparation with regime data disabled."""
        entry = _prepare_entry(mock_strategy_doc, include_regime=False)
        
        assert "preferred_regime" not in entry
        assert "regime_specialist" not in entry
        assert "regimes_traded" not in entry


class TestGetRegimePerformanceSummary:
    """Tests for _get_regime_performance_summary function."""
    
    def test_full_summary(self, mock_strategy_doc):
        """Test full regime performance summary."""
        summary = _get_regime_performance_summary(mock_strategy_doc)
        
        assert summary is not None
        assert summary["count"] == 3
        assert "TRENDING_UP" in summary["regimes_analyzed"]
        assert "TRENDING_DOWN" in summary["regimes_analyzed"]
        assert "SIDEWAYS" in summary["regimes_analyzed"]
        assert summary["preferred_regime"] == "TRENDING_UP"
    
    def test_specific_regime_summary(self, mock_strategy_doc):
        """Test summary for specific regime."""
        summary = _get_regime_performance_summary(mock_strategy_doc, regime="TRENDING_UP")
        
        assert summary is not None
        assert summary["sharpe"] == 2.5
        assert summary["roi"] == 0.25
        assert summary["trades"] == 25
    
    def test_no_performance_data(self):
        """Test summary when no performance data available."""
        strategy_doc = {"strategy_id": "test", "fitness": {}}
        
        summary = _get_regime_performance_summary(strategy_doc)
        
        assert summary is None


class TestGenerateRegimeLeaderboard:
    """Tests for generate_regime_leaderboard function."""
    
    @patch("reports.leaderboard.mongo_client")
    @patch("reports.leaderboard._get_current_regime")
    @patch("reports.leaderboard.record_leaderboard")
    def test_current_regime_leaderboard(
        self,
        mock_record,
        mock_current_regime,
        mock_mongo,
        mock_strategy_doc,
    ):
        """Test generation of leaderboard for current regime."""
        mock_current_regime.return_value = "TRENDING_UP"
        
        # Mock MongoDB
        mock_collection = MagicMock()
        mock_collection.find.return_value = [mock_strategy_doc]
        
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)
        
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=None)
        mock_client.__getitem__ = MagicMock(return_value=mock_db)
        
        mock_mongo.return_value = mock_client
        
        # Execute
        result = generate_regime_leaderboard(use_current_regime=True, limit=10)
        
        # Verify
        assert result["regime_filter"] == "TRENDING_UP"
        assert result["is_current_regime"] is True
        assert len(result["top_strategies"]) > 0
        
        # Check regime-specific data is included
        first_strategy = result["top_strategies"][0]
        assert "regime_specific" in first_strategy
        assert first_strategy["regime_specific"]["regime"] == "TRENDING_UP"


class TestGetRegimeSpecialists:
    """Tests for get_regime_specialists function."""
    
    @patch("reports.leaderboard.generate_regime_leaderboard")
    def test_all_regimes_specialists(self, mock_generate):
        """Test retrieval of specialists for all regimes."""
        mock_generate.return_value = {
            "top_strategies": [
                {"strategy_id": "strat_1"},
                {"strategy_id": "strat_2"},
            ]
        }
        
        result = get_regime_specialists(limit=5, include_all_regimes=True)
        
        # Verify specialists returned for each regime type
        assert "TRENDING_UP" in result
        assert "TRENDING_DOWN" in result
        assert "SIDEWAYS" in result
        
        # Verify generation was called for each regime
        assert mock_generate.call_count == 3


# --- Integration Tests ---


class TestPhase4Integration:
    """Integration tests for Phase 4 regime evolution features."""
    
    @patch("evolution.evaluator.mongo_client")
    @patch("evolution.evaluator.update_genome_fitness")
    def test_end_to_end_regime_scoring_and_storage(
        self,
        mock_update_fitness,
        mock_mongo,
        mock_run_doc,
    ):
        """Test end-to-end regime scoring and storage in strategy document."""
        # This would test the full flow from evaluate_experiment
        # through to storing regime performance in strategies collection
        pass  # Placeholder for full integration test


