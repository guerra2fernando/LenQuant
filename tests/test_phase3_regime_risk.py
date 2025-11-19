"""Unit tests for Phase 3: Risk Manager Regime Integration.

Tests regime multiplier logic, position sizing adjustments, and monitoring metrics.
"""
from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from unittest.mock import MagicMock, Mock, patch

import pytest

from exec.risk_manager import MacroSettings, RegimeMultipliers, RiskManager, TradingSettings


class TestRegimeMultipliers(unittest.TestCase):
    """Test RegimeMultipliers model."""
    
    def test_default_multipliers(self):
        """Test default regime multipliers are within bounds."""
        multipliers = RegimeMultipliers()
        
        # Check all multipliers are within [0.3, 2.0] range
        assert 0.3 <= multipliers.TRENDING_UP <= 2.0
        assert 0.3 <= multipliers.TRENDING_DOWN <= 2.0
        assert 0.3 <= multipliers.SIDEWAYS <= 2.0
        assert 0.3 <= multipliers.HIGH_VOLATILITY <= 2.0
        assert 0.3 <= multipliers.LOW_VOLATILITY <= 2.0
        assert 0.3 <= multipliers.NORMAL_VOLATILITY <= 2.0
        assert 0.3 <= multipliers.UNDEFINED <= 2.0
        
        # Check specific defaults match documentation
        assert multipliers.TRENDING_UP == 1.3
        assert multipliers.TRENDING_DOWN == 0.6
        assert multipliers.SIDEWAYS == 0.8
        assert multipliers.HIGH_VOLATILITY == 0.5
        assert multipliers.LOW_VOLATILITY == 1.2
        assert multipliers.NORMAL_VOLATILITY == 1.0
        assert multipliers.UNDEFINED == 1.0
    
    def test_custom_multipliers(self):
        """Test custom regime multipliers."""
        multipliers = RegimeMultipliers(
            TRENDING_UP=1.5,
            HIGH_VOLATILITY=0.4,
        )
        
        assert multipliers.TRENDING_UP == 1.5
        assert multipliers.HIGH_VOLATILITY == 0.4
        # Others should use defaults
        assert multipliers.SIDEWAYS == 0.8
    
    def test_multiplier_bounds_validation(self):
        """Test multiplier bounds are enforced."""
        # Below minimum should fail
        with pytest.raises(Exception):  # Pydantic ValidationError
            RegimeMultipliers(TRENDING_UP=0.2)
        
        # Above maximum should fail
        with pytest.raises(Exception):  # Pydantic ValidationError
            RegimeMultipliers(TRENDING_UP=2.5)


class TestMacroSettings(unittest.TestCase):
    """Test MacroSettings model."""
    
    def test_default_macro_settings(self):
        """Test default macro settings."""
        settings = MacroSettings()
        
        assert settings.regime_risk_enabled is False
        assert isinstance(settings.regime_multipliers, RegimeMultipliers)
        assert settings.regime_cache_ttl_seconds == 3600
        assert settings.alert_on_significant_reduction is True
        assert settings.significant_reduction_threshold == 0.3
    
    def test_custom_macro_settings(self):
        """Test custom macro settings."""
        settings = MacroSettings(
            regime_risk_enabled=True,
            regime_cache_ttl_seconds=1800,
            significant_reduction_threshold=0.25,
        )
        
        assert settings.regime_risk_enabled is True
        assert settings.regime_cache_ttl_seconds == 1800
        assert settings.significant_reduction_threshold == 0.25


class TestGetRegimeMultiplier(unittest.TestCase):
    """Test RiskManager.get_regime_multiplier() method."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.trading_settings = TradingSettings()
        self.macro_settings = MacroSettings(regime_risk_enabled=True)
        self.risk_manager = RiskManager(
            settings=self.trading_settings,
            macro_settings=self.macro_settings,
        )
    
    def test_regime_risk_disabled(self):
        """Test multiplier returns 1.0 when regime risk disabled."""
        self.risk_manager.macro_settings.regime_risk_enabled = False
        
        multiplier, regime_desc = self.risk_manager.get_regime_multiplier("BTC/USDT")
        
        assert multiplier == 1.0
        assert regime_desc is None
    
    @patch("exec.risk_manager.RegimeDetector")
    def test_regime_not_found(self, mock_detector_class):
        """Test multiplier returns 1.0 when no regime data available."""
        mock_detector = Mock()
        mock_detector.get_latest_regime.return_value = None
        mock_detector_class.return_value = mock_detector
        
        multiplier, regime_desc = self.risk_manager.get_regime_multiplier("BTC/USDT")
        
        assert multiplier == 1.0
        assert regime_desc == "UNDEFINED"
        mock_detector.get_latest_regime.assert_called_once_with("BTC/USDT")
    
    @patch("exec.risk_manager.RegimeDetector")
    def test_trending_up_multiplier(self, mock_detector_class):
        """Test multiplier for TRENDING_UP regime."""
        from macro.regime import MarketRegime, RegimeFeatures, TrendRegime, VolatilityRegime
        
        # Create mock regime
        mock_regime = MarketRegime(
            symbol="BTC/USDT",
            timestamp=datetime.utcnow(),
            trend_regime=TrendRegime.TRENDING_UP,
            volatility_regime=VolatilityRegime.NORMAL_VOLATILITY,
            confidence=0.85,
            features=RegimeFeatures(
                atr=100.0,
                atr_pct=0.02,
                adx=35.0,
                bb_width=0.05,
                ma_slope_short=0.003,
                ma_slope_long=0.002,
                volatility_std=0.015,
            ),
        )
        
        mock_detector = Mock()
        mock_detector.get_latest_regime.return_value = mock_regime
        mock_detector_class.return_value = mock_detector
        
        multiplier, regime_desc = self.risk_manager.get_regime_multiplier("BTC/USDT")
        
        # Should use minimum of trend (1.3) and volatility (1.0) = 1.0
        assert multiplier == 1.0
        assert regime_desc == "TRENDING_UP/NORMAL_VOLATILITY"
    
    @patch("exec.risk_manager.RegimeDetector")
    def test_high_volatility_multiplier(self, mock_detector_class):
        """Test multiplier for HIGH_VOLATILITY regime reduces size."""
        from macro.regime import MarketRegime, RegimeFeatures, TrendRegime, VolatilityRegime
        
        mock_regime = MarketRegime(
            symbol="ETH/USDT",
            timestamp=datetime.utcnow(),
            trend_regime=TrendRegime.TRENDING_UP,
            volatility_regime=VolatilityRegime.HIGH_VOLATILITY,
            confidence=0.75,
            features=RegimeFeatures(
                atr=200.0,
                atr_pct=0.08,
                adx=45.0,
                bb_width=0.12,
                ma_slope_short=0.002,
                ma_slope_long=0.001,
                volatility_std=0.06,
            ),
        )
        
        mock_detector = Mock()
        mock_detector.get_latest_regime.return_value = mock_regime
        mock_detector_class.return_value = mock_detector
        
        multiplier, regime_desc = self.risk_manager.get_regime_multiplier("ETH/USDT")
        
        # Should use minimum of trend (1.3) and volatility (0.5) = 0.5
        assert multiplier == 0.5
        assert regime_desc == "TRENDING_UP/HIGH_VOLATILITY"
    
    @patch("exec.risk_manager.RegimeDetector")
    def test_sideways_low_volatility_multiplier(self, mock_detector_class):
        """Test multiplier for SIDEWAYS + LOW_VOLATILITY."""
        from macro.regime import MarketRegime, RegimeFeatures, TrendRegime, VolatilityRegime
        
        mock_regime = MarketRegime(
            symbol="ADA/USDT",
            timestamp=datetime.utcnow(),
            trend_regime=TrendRegime.SIDEWAYS,
            volatility_regime=VolatilityRegime.LOW_VOLATILITY,
            confidence=0.90,
            features=RegimeFeatures(
                atr=0.002,
                atr_pct=0.005,
                adx=15.0,
                bb_width=0.02,
                ma_slope_short=0.0001,
                ma_slope_long=-0.0001,
                volatility_std=0.004,
            ),
        )
        
        mock_detector = Mock()
        mock_detector.get_latest_regime.return_value = mock_regime
        mock_detector_class.return_value = mock_detector
        
        multiplier, regime_desc = self.risk_manager.get_regime_multiplier("ADA/USDT")
        
        # Should use minimum of trend (0.8) and volatility (1.2) = 0.8
        assert multiplier == 0.8
        assert regime_desc == "SIDEWAYS/LOW_VOLATILITY"
    
    @patch("exec.risk_manager.RegimeDetector")
    def test_cache_functionality(self, mock_detector_class):
        """Test regime multiplier caching."""
        from macro.regime import MarketRegime, RegimeFeatures, TrendRegime, VolatilityRegime
        
        mock_regime = MarketRegime(
            symbol="BTC/USDT",
            timestamp=datetime.utcnow(),
            trend_regime=TrendRegime.TRENDING_UP,
            volatility_regime=VolatilityRegime.NORMAL_VOLATILITY,
            confidence=0.85,
            features=RegimeFeatures(
                atr=100.0, atr_pct=0.02, adx=35.0, bb_width=0.05,
                ma_slope_short=0.003, ma_slope_long=0.002, volatility_std=0.015,
            ),
        )
        
        mock_detector = Mock()
        mock_detector.get_latest_regime.return_value = mock_regime
        mock_detector_class.return_value = mock_detector
        
        # First call should fetch regime
        multiplier1, _ = self.risk_manager.get_regime_multiplier("BTC/USDT")
        assert mock_detector.get_latest_regime.call_count == 1
        
        # Second call within TTL should use cache
        multiplier2, _ = self.risk_manager.get_regime_multiplier("BTC/USDT")
        assert mock_detector.get_latest_regime.call_count == 1  # Not called again
        assert multiplier1 == multiplier2
        
        # Check cache has entry
        assert "BTC/USDT" in self.risk_manager._regime_cache
    
    @patch("exec.risk_manager.RegimeDetector")
    def test_cache_expiration(self, mock_detector_class):
        """Test regime cache expires after TTL."""
        from macro.regime import MarketRegime, RegimeFeatures, TrendRegime, VolatilityRegime
        
        mock_regime = MarketRegime(
            symbol="BTC/USDT",
            timestamp=datetime.utcnow(),
            trend_regime=TrendRegime.TRENDING_UP,
            volatility_regime=VolatilityRegime.NORMAL_VOLATILITY,
            confidence=0.85,
            features=RegimeFeatures(
                atr=100.0, atr_pct=0.02, adx=35.0, bb_width=0.05,
                ma_slope_short=0.003, ma_slope_long=0.002, volatility_std=0.015,
            ),
        )
        
        mock_detector = Mock()
        mock_detector.get_latest_regime.return_value = mock_regime
        mock_detector_class.return_value = mock_detector
        
        # Set short TTL
        self.risk_manager.macro_settings.regime_cache_ttl_seconds = 1
        
        # First call
        self.risk_manager.get_regime_multiplier("BTC/USDT")
        assert mock_detector.get_latest_regime.call_count == 1
        
        # Manually expire cache
        cached_multiplier, cached_at = self.risk_manager._regime_cache["BTC/USDT"]
        expired_time = cached_at - timedelta(seconds=10)
        self.risk_manager._regime_cache["BTC/USDT"] = (cached_multiplier, expired_time)
        
        # Second call should refetch
        self.risk_manager.get_regime_multiplier("BTC/USDT")
        assert mock_detector.get_latest_regime.call_count == 2
    
    @patch("exec.risk_manager.RegimeDetector")
    def test_significant_reduction_alert(self, mock_detector_class):
        """Test significant reduction triggers alert."""
        from macro.regime import MarketRegime, RegimeFeatures, TrendRegime, VolatilityRegime
        
        # Create regime with low multiplier (significant reduction)
        mock_regime = MarketRegime(
            symbol="BTC/USDT",
            timestamp=datetime.utcnow(),
            trend_regime=TrendRegime.TRENDING_DOWN,
            volatility_regime=VolatilityRegime.HIGH_VOLATILITY,
            confidence=0.80,
            features=RegimeFeatures(
                atr=150.0, atr_pct=0.05, adx=38.0, bb_width=0.08,
                ma_slope_short=-0.004, ma_slope_long=-0.003, volatility_std=0.04,
            ),
        )
        
        mock_detector = Mock()
        mock_detector.get_latest_regime.return_value = mock_regime
        mock_detector_class.return_value = mock_detector
        
        # Enable significant reduction alerts
        self.risk_manager.macro_settings.alert_on_significant_reduction = True
        self.risk_manager.macro_settings.significant_reduction_threshold = 0.3
        
        with patch.object(self.risk_manager, "log_breach") as mock_log_breach:
            multiplier, _ = self.risk_manager.get_regime_multiplier("BTC/USDT")
            
            # min(0.6, 0.5) = 0.5 which is < 0.7, so should trigger
            assert multiplier == 0.5
            mock_log_breach.assert_called_once()
            
            # Check breach details
            call_args = mock_log_breach.call_args
            assert call_args[1]["code"] == "regime_risk_reduction"
            assert call_args[1]["severity"] == "info"
            assert "context" in call_args[1]
    
    @patch("exec.risk_manager.RegimeDetector")
    def test_error_handling(self, mock_detector_class):
        """Test error handling returns neutral multiplier."""
        mock_detector = Mock()
        mock_detector.get_latest_regime.side_effect = Exception("Database error")
        mock_detector_class.return_value = mock_detector
        
        multiplier, regime_desc = self.risk_manager.get_regime_multiplier("BTC/USDT")
        
        # Should return neutral multiplier on error
        assert multiplier == 1.0
        assert regime_desc == "error"


class TestCalculatePositionSize(unittest.TestCase):
    """Test RiskManager.calculate_position_size() method."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.trading_settings = TradingSettings()
        self.macro_settings = MacroSettings(regime_risk_enabled=True)
        self.risk_manager = RiskManager(
            settings=self.trading_settings,
            macro_settings=self.macro_settings,
        )
    
    def test_position_size_without_regime(self):
        """Test position size calculation without regime adjustment."""
        result = self.risk_manager.calculate_position_size(
            symbol="BTC/USDT",
            base_size_usd=1000.0,
            apply_regime_multiplier=False,
        )
        
        assert result["symbol"] == "BTC/USDT"
        assert result["base_size_usd"] == 1000.0
        assert result["regime_multiplier"] == 1.0
        assert result["regime_description"] is None
        assert result["regime_adjusted"] is False
        assert result["final_size_usd"] == 1000.0
    
    @patch.object(RiskManager, "get_regime_multiplier")
    def test_position_size_with_regime(self, mock_get_multiplier):
        """Test position size calculation with regime adjustment."""
        mock_get_multiplier.return_value = (0.5, "TRENDING_DOWN/HIGH_VOLATILITY")
        
        result = self.risk_manager.calculate_position_size(
            symbol="BTC/USDT",
            base_size_usd=1000.0,
            apply_regime_multiplier=True,
        )
        
        assert result["symbol"] == "BTC/USDT"
        assert result["base_size_usd"] == 1000.0
        assert result["regime_multiplier"] == 0.5
        assert result["regime_description"] == "TRENDING_DOWN/HIGH_VOLATILITY"
        assert result["regime_adjusted"] is True
        assert result["final_size_usd"] == 500.0
    
    @patch.object(RiskManager, "get_regime_multiplier")
    def test_position_size_increase(self, mock_get_multiplier):
        """Test position size can be increased in favorable regime."""
        mock_get_multiplier.return_value = (1.3, "TRENDING_UP/LOW_VOLATILITY")
        
        result = self.risk_manager.calculate_position_size(
            symbol="ETH/USDT",
            base_size_usd=1000.0,
        )
        
        assert result["final_size_usd"] == 1300.0
        assert result["regime_adjusted"] is True
    
    @patch.object(RiskManager, "get_regime_multiplier")
    def test_position_size_neutral_regime(self, mock_get_multiplier):
        """Test position size unchanged in neutral regime."""
        mock_get_multiplier.return_value = (1.0, "SIDEWAYS/NORMAL_VOLATILITY")
        
        result = self.risk_manager.calculate_position_size(
            symbol="ADA/USDT",
            base_size_usd=500.0,
        )
        
        assert result["final_size_usd"] == 500.0
        assert result["regime_adjusted"] is False


class TestRiskManagerMacroIntegration(unittest.TestCase):
    """Test RiskManager integration with macro settings."""
    
    def test_refresh_macro_settings(self):
        """Test refreshing macro settings from database."""
        risk_manager = RiskManager()
        
        with patch("exec.risk_manager.get_macro_settings") as mock_get:
            mock_settings = MacroSettings(regime_risk_enabled=True)
            mock_get.return_value = mock_settings
            
            refreshed = risk_manager.refresh_macro_settings()
            
            assert refreshed.regime_risk_enabled is True
            assert risk_manager.macro_settings.regime_risk_enabled is True
    
    def test_update_macro_settings(self):
        """Test updating macro settings."""
        risk_manager = RiskManager()
        
        with patch("exec.risk_manager.save_macro_settings") as mock_save:
            new_settings = MacroSettings(
                regime_risk_enabled=True,
                regime_cache_ttl_seconds=1800,
            )
            mock_save.return_value = new_settings
            
            updated = risk_manager.update_macro_settings(new_settings)
            
            assert updated.regime_risk_enabled is True
            assert updated.regime_cache_ttl_seconds == 1800
            mock_save.assert_called_once()
    
    def test_get_summary_includes_macro(self):
        """Test get_summary includes macro information."""
        risk_manager = RiskManager()
        risk_manager.macro_settings.regime_risk_enabled = True
        risk_manager._regime_adjustments_count = 5
        risk_manager._regime_cache["BTC/USDT"] = (0.8, datetime.now(timezone.utc))
        
        with patch.object(risk_manager, "_current_open_exposure", return_value=0.0):
            with patch.object(risk_manager, "_positions_count", return_value={}):
                with patch.object(risk_manager, "_daily_realized_loss", return_value=0.0):
                    with patch.object(risk_manager, "get_breaches", return_value=[]):
                        summary = risk_manager.get_summary()
        
        assert "macro" in summary
        assert summary["macro"]["regime_risk_enabled"] is True
        assert summary["macro"]["regime_adjustments_count"] == 5
        assert summary["macro"]["cached_regimes"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

