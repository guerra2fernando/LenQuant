"""Unit tests for macro regime detection functionality."""
from __future__ import annotations

import unittest
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from macro.regime import (
    MarketRegime,
    RegimeDetector,
    RegimeFeatures,
    TrendRegime,
    VolatilityRegime,
)


class TestRegimeFeatures(unittest.TestCase):
    """Test RegimeFeatures dataclass."""
    
    def test_regime_features_creation(self):
        """Test creating RegimeFeatures instance."""
        features = RegimeFeatures(
            atr=100.0,
            atr_pct=2.5,
            adx=35.0,
            bb_width=4.0,
            ma_slope_short=0.002,
            ma_slope_long=0.001,
            volatility_std=0.03,
        )
        
        self.assertEqual(features.atr, 100.0)
        self.assertEqual(features.adx, 35.0)
        self.assertAlmostEqual(features.volatility_std, 0.03)


class TestRegimeDetector(unittest.TestCase):
    """Test RegimeDetector class."""
    
    def setUp(self):
        """Set up test detector."""
        self.detector = RegimeDetector()
    
    def test_detector_initialization(self):
        """Test detector initializes with default parameters."""
        self.assertEqual(self.detector.adx_threshold, 25.0)
        self.assertEqual(self.detector.hysteresis_bars, 3)
        self.assertEqual(self.detector.lookback_period, 100)
    
    def test_detector_custom_params(self):
        """Test detector with custom parameters."""
        detector = RegimeDetector(
            adx_threshold=30.0,
            hysteresis_bars=5,
            lookback_period=200,
        )
        
        self.assertEqual(detector.adx_threshold, 30.0)
        self.assertEqual(detector.hysteresis_bars, 5)
        self.assertEqual(detector.lookback_period, 200)
    
    def test_calculate_atr(self):
        """Test ATR calculation."""
        # Create synthetic OHLCV data
        dates = pd.date_range(start="2024-01-01", periods=20, freq="1h")
        df = pd.DataFrame({
            "open": np.random.uniform(40000, 42000, 20),
            "high": np.random.uniform(41000, 43000, 20),
            "low": np.random.uniform(39000, 41000, 20),
            "close": np.random.uniform(40000, 42000, 20),
            "volume": np.random.uniform(100, 1000, 20),
        }, index=dates)
        
        atr = self.detector._calculate_atr(df, period=14)
        
        # ATR should be positive
        self.assertTrue((atr.dropna() > 0).all())
        
        # First values should be NaN due to rolling window
        self.assertTrue(pd.isna(atr.iloc[0]))
    
    def test_calculate_adx(self):
        """Test ADX calculation."""
        dates = pd.date_range(start="2024-01-01", periods=50, freq="1h")
        
        # Create trending data (uptrend)
        close_prices = np.linspace(40000, 45000, 50) + np.random.normal(0, 100, 50)
        df = pd.DataFrame({
            "open": close_prices * 0.999,
            "high": close_prices * 1.002,
            "low": close_prices * 0.998,
            "close": close_prices,
            "volume": np.random.uniform(100, 1000, 50),
        }, index=dates)
        
        adx = self.detector._calculate_adx(df)
        
        # ADX should be between 0 and 100
        valid_adx = adx.dropna()
        self.assertTrue((valid_adx >= 0).all())
        self.assertTrue((valid_adx <= 100).all())
    
    def test_calculate_bb_width(self):
        """Test Bollinger Band width calculation."""
        dates = pd.date_range(start="2024-01-01", periods=30, freq="1h")
        df = pd.DataFrame({
            "open": np.random.uniform(40000, 42000, 30),
            "high": np.random.uniform(41000, 43000, 30),
            "low": np.random.uniform(39000, 41000, 30),
            "close": np.random.uniform(40000, 42000, 30),
            "volume": np.random.uniform(100, 1000, 30),
        }, index=dates)
        
        bb_width = self.detector._calculate_bb_width(df, period=20)
        
        # BB width should be positive percentage
        valid_width = bb_width.dropna()
        self.assertTrue((valid_width > 0).all())
    
    def test_calculate_ma_slope(self):
        """Test MA slope calculation."""
        dates = pd.date_range(start="2024-01-01", periods=30, freq="1h")
        
        # Create uptrending prices
        close_prices = np.linspace(40000, 42000, 30)
        df = pd.DataFrame({
            "close": close_prices,
        }, index=dates)
        
        slope = self.detector._calculate_ma_slope(df, period=10)
        
        # Slope should be mostly positive for uptrend
        valid_slope = slope.dropna()
        self.assertTrue(valid_slope.mean() > 0)
    
    def test_compute_features(self):
        """Test full feature computation."""
        dates = pd.date_range(start="2024-01-01", periods=100, freq="1h")
        df = pd.DataFrame({
            "open": np.random.uniform(40000, 42000, 100),
            "high": np.random.uniform(41000, 43000, 100),
            "low": np.random.uniform(39000, 41000, 100),
            "close": np.random.uniform(40000, 42000, 100),
            "volume": np.random.uniform(100, 1000, 100),
        }, index=dates)
        
        result_df = self.detector.compute_features(df)
        
        # Check all feature columns are added
        expected_cols = ["atr", "atr_pct", "adx", "bb_width", "ma_slope_short", "ma_slope_long", "volatility_std"]
        for col in expected_cols:
            self.assertIn(col, result_df.columns)
        
        # Check no all-NaN columns (should have some valid values)
        for col in expected_cols:
            self.assertTrue(result_df[col].notna().any())


class TestTrendRegimeDetection(unittest.TestCase):
    """Test trend regime detection logic."""
    
    def setUp(self):
        """Set up test detector."""
        self.detector = RegimeDetector()
    
    def test_trending_up_detection(self):
        """Test detection of uptrend regime."""
        features = RegimeFeatures(
            atr=100.0,
            atr_pct=2.5,
            adx=35.0,  # Strong trend
            bb_width=4.0,
            ma_slope_short=0.005,  # Positive slope
            ma_slope_long=0.003,  # Positive slope
            volatility_std=0.03,
        )
        
        regime, confidence = self.detector.detect_trend_regime(features)
        
        self.assertEqual(regime, TrendRegime.TRENDING_UP)
        self.assertGreater(confidence, 0.5)
        self.assertLessEqual(confidence, 1.0)
    
    def test_trending_down_detection(self):
        """Test detection of downtrend regime."""
        features = RegimeFeatures(
            atr=100.0,
            atr_pct=2.5,
            adx=40.0,  # Strong trend
            bb_width=4.0,
            ma_slope_short=-0.005,  # Negative slope
            ma_slope_long=-0.003,  # Negative slope
            volatility_std=0.03,
        )
        
        regime, confidence = self.detector.detect_trend_regime(features)
        
        self.assertEqual(regime, TrendRegime.TRENDING_DOWN)
        self.assertGreater(confidence, 0.5)
    
    def test_sideways_detection(self):
        """Test detection of sideways/ranging regime."""
        features = RegimeFeatures(
            atr=50.0,
            atr_pct=1.5,
            adx=15.0,  # Low ADX = weak trend
            bb_width=2.0,
            ma_slope_short=0.0001,  # Near zero slope
            ma_slope_long=0.0001,
            volatility_std=0.02,
        )
        
        regime, confidence = self.detector.detect_trend_regime(features)
        
        self.assertEqual(regime, TrendRegime.SIDEWAYS)
        self.assertGreater(confidence, 0.3)
    
    def test_undefined_regime_with_nan(self):
        """Test that NaN values result in UNDEFINED regime."""
        features = RegimeFeatures(
            atr=np.nan,
            atr_pct=2.5,
            adx=np.nan,
            bb_width=4.0,
            ma_slope_short=0.002,
            ma_slope_long=0.001,
            volatility_std=0.03,
        )
        
        regime, confidence = self.detector.detect_trend_regime(features)
        
        self.assertEqual(regime, TrendRegime.UNDEFINED)
        self.assertEqual(confidence, 0.0)


class TestVolatilityRegimeDetection(unittest.TestCase):
    """Test volatility regime detection logic."""
    
    def setUp(self):
        """Set up test detector."""
        self.detector = RegimeDetector()
    
    def test_high_volatility_detection_with_zscore(self):
        """Test detection of high volatility using z-score."""
        # Create historical volatility data
        historical_vol = pd.Series([0.02, 0.018, 0.022, 0.019, 0.021] * 10)
        
        # Current volatility is much higher
        features = RegimeFeatures(
            atr=200.0,
            atr_pct=5.0,
            adx=30.0,
            bb_width=6.0,
            ma_slope_short=0.002,
            ma_slope_long=0.001,
            volatility_std=0.06,  # High volatility
        )
        
        regime, confidence = self.detector.detect_volatility_regime(features, historical_vol)
        
        self.assertEqual(regime, VolatilityRegime.HIGH_VOLATILITY)
        self.assertGreater(confidence, 0.0)
    
    def test_low_volatility_detection_with_zscore(self):
        """Test detection of low volatility using z-score."""
        # Create historical volatility data
        historical_vol = pd.Series([0.03, 0.028, 0.032, 0.029, 0.031] * 10)
        
        # Current volatility is much lower
        features = RegimeFeatures(
            atr=50.0,
            atr_pct=0.8,
            adx=20.0,
            bb_width=1.5,
            ma_slope_short=0.0001,
            ma_slope_long=0.0001,
            volatility_std=0.01,  # Low volatility
        )
        
        regime, confidence = self.detector.detect_volatility_regime(features, historical_vol)
        
        self.assertEqual(regime, VolatilityRegime.LOW_VOLATILITY)
        self.assertGreater(confidence, 0.0)
    
    def test_normal_volatility_detection(self):
        """Test detection of normal volatility."""
        # Create historical volatility data
        historical_vol = pd.Series([0.025, 0.024, 0.026, 0.025, 0.025] * 10)
        
        # Current volatility is normal (near mean)
        features = RegimeFeatures(
            atr=100.0,
            atr_pct=2.0,
            adx=25.0,
            bb_width=3.0,
            ma_slope_short=0.001,
            ma_slope_long=0.001,
            volatility_std=0.025,  # Normal volatility
        )
        
        regime, confidence = self.detector.detect_volatility_regime(features, historical_vol)
        
        self.assertEqual(regime, VolatilityRegime.NORMAL_VOLATILITY)
    
    def test_high_volatility_fallback_without_historical(self):
        """Test high volatility detection without historical data (fallback to ATR)."""
        features = RegimeFeatures(
            atr=200.0,
            atr_pct=4.5,  # High ATR percentage
            adx=30.0,
            bb_width=6.0,
            ma_slope_short=0.002,
            ma_slope_long=0.001,
            volatility_std=0.05,
        )
        
        regime, confidence = self.detector.detect_volatility_regime(features, None)
        
        self.assertEqual(regime, VolatilityRegime.HIGH_VOLATILITY)
    
    def test_low_volatility_fallback_without_historical(self):
        """Test low volatility detection without historical data (fallback to ATR)."""
        features = RegimeFeatures(
            atr=30.0,
            atr_pct=0.8,  # Low ATR percentage
            adx=15.0,
            bb_width=1.5,
            ma_slope_short=0.0001,
            ma_slope_long=0.0001,
            volatility_std=0.01,
        )
        
        regime, confidence = self.detector.detect_volatility_regime(features, None)
        
        self.assertEqual(regime, VolatilityRegime.LOW_VOLATILITY)
    
    def test_undefined_regime_with_nan(self):
        """Test that NaN values result in UNDEFINED regime."""
        features = RegimeFeatures(
            atr=np.nan,
            atr_pct=np.nan,
            adx=30.0,
            bb_width=4.0,
            ma_slope_short=0.002,
            ma_slope_long=0.001,
            volatility_std=np.nan,
        )
        
        regime, confidence = self.detector.detect_volatility_regime(features, None)
        
        self.assertEqual(regime, VolatilityRegime.UNDEFINED)
        self.assertEqual(confidence, 0.0)


class TestMarketRegime(unittest.TestCase):
    """Test MarketRegime dataclass."""
    
    def test_market_regime_creation(self):
        """Test creating MarketRegime instance."""
        features = RegimeFeatures(
            atr=100.0,
            atr_pct=2.5,
            adx=35.0,
            bb_width=4.0,
            ma_slope_short=0.002,
            ma_slope_long=0.001,
            volatility_std=0.03,
        )
        
        regime = MarketRegime(
            symbol="BTC/USD",
            timestamp=datetime(2024, 1, 1, 12, 0),
            trend_regime=TrendRegime.TRENDING_UP,
            volatility_regime=VolatilityRegime.NORMAL_VOLATILITY,
            confidence=0.75,
            features=features,
        )
        
        self.assertEqual(regime.symbol, "BTC/USD")
        self.assertEqual(regime.trend_regime, TrendRegime.TRENDING_UP)
        self.assertEqual(regime.volatility_regime, VolatilityRegime.NORMAL_VOLATILITY)
        self.assertAlmostEqual(regime.confidence, 0.75)


class TestRegimeDetectorIntegration(unittest.TestCase):
    """Integration tests for full regime detection workflow."""
    
    def test_classify_market_state_with_synthetic_data(self):
        """Test full classification with synthetic trending data."""
        # This test would require mocking get_ohlcv_df or using test database
        # For now, we test the logic with prepared data
        
        detector = RegimeDetector()
        
        # Create synthetic uptrending OHLCV data
        dates = pd.date_range(start="2024-01-01", periods=150, freq="1h")
        close_prices = np.linspace(40000, 45000, 150) + np.random.normal(0, 200, 150)
        
        df = pd.DataFrame({
            "open": close_prices * 0.999,
            "high": close_prices * 1.002,
            "low": close_prices * 0.998,
            "close": close_prices,
            "volume": np.random.uniform(100, 1000, 150),
        }, index=dates)
        
        # Compute features
        df = detector.compute_features(df)
        
        # Get latest row
        row = df.iloc[-1]
        
        features = RegimeFeatures(
            atr=float(row["atr"]),
            atr_pct=float(row["atr_pct"]),
            adx=float(row["adx"]),
            bb_width=float(row["bb_width"]),
            ma_slope_short=float(row["ma_slope_short"]),
            ma_slope_long=float(row["ma_slope_long"]),
            volatility_std=float(row["volatility_std"]),
        )
        
        # Detect trend
        trend_regime, trend_confidence = detector.detect_trend_regime(features)
        
        # For uptrending data, we expect either TRENDING_UP or SIDEWAYS
        # (depending on how strong the trend indicators are)
        self.assertIn(trend_regime, [TrendRegime.TRENDING_UP, TrendRegime.SIDEWAYS, TrendRegime.UNDEFINED])
        
        # Confidence should be in valid range
        self.assertGreaterEqual(trend_confidence, 0.0)
        self.assertLessEqual(trend_confidence, 1.0)


if __name__ == "__main__":
    unittest.main()

