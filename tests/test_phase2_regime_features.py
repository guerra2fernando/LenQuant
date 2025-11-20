"""Tests for Phase 2 - Regime-Aware Feature Engineering."""
from __future__ import annotations

import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd

from features.features import _enrich_with_regime
from features.indicators import add_regime_indicators, clean_feature_frame
from models.train_horizon import regime_based_split


class TestRegimeEnrichment(unittest.TestCase):
    """Test regime enrichment functionality."""

    def setUp(self):
        """Set up test fixtures."""
        # Create sample feature dataframe
        timestamps = pd.date_range(start="2024-01-01", periods=100, freq="1h")
        self.df = pd.DataFrame({
            "close": np.random.uniform(40000, 45000, 100),
            "return_1": np.random.uniform(-0.02, 0.02, 100),
        }, index=timestamps)
        
        # Create sample regime documents
        self.regime_docs = []
        for i, ts in enumerate(timestamps[::10]):  # Regime every 10 bars
            regime = "TRENDING_UP" if i % 2 == 0 else "SIDEWAYS"
            self.regime_docs.append({
                "timestamp": ts,
                "trend_regime": regime,
                "volatility_regime": "NORMAL_VOLATILITY",
                "confidence": 0.8,
            })

    @patch("features.features.mongo_client")
    def test_enrich_with_regime_success(self, mock_mongo):
        """Test successful regime enrichment."""
        # Mock database response
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_collection.find.return_value.sort.return_value = self.regime_docs
        mock_db.__getitem__.return_value = mock_collection
        mock_client = MagicMock()
        mock_client.__enter__.return_value = mock_client
        mock_client.__getitem__.return_value = mock_db
        mock_mongo.return_value = mock_client
        
        # Enrich dataframe
        result = _enrich_with_regime(self.df, "BTC/USD", "1h")
        
        # Verify regime columns added
        self.assertIn("regime_trend", result.columns)
        self.assertIn("regime_volatility", result.columns)
        self.assertIn("regime_confidence", result.columns)
        self.assertIn("regime_duration_bars", result.columns)
        
        # Verify no NaN values
        self.assertEqual(result["regime_trend"].isna().sum(), 0)
        self.assertEqual(result["regime_volatility"].isna().sum(), 0)

    @patch("features.features.mongo_client")
    def test_enrich_with_regime_no_data(self, mock_mongo):
        """Test regime enrichment when no regime data exists."""
        # Mock empty database response
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_collection.find.return_value.sort.return_value = []
        mock_db.__getitem__.return_value = mock_collection
        mock_client = MagicMock()
        mock_client.__enter__.return_value = mock_client
        mock_client.__getitem__.return_value = mock_db
        mock_mongo.return_value = mock_client
        
        # Enrich dataframe
        result = _enrich_with_regime(self.df, "BTC/USD", "1h")
        
        # Verify default values
        self.assertTrue((result["regime_trend"] == "UNDEFINED").all())
        self.assertTrue((result["regime_volatility"] == "UNDEFINED").all())
        self.assertTrue((result["regime_confidence"] == 0.0).all())
        self.assertTrue((result["regime_duration_bars"] == 0).all())

    def test_enrich_with_regime_empty_df(self):
        """Test regime enrichment with empty dataframe."""
        empty_df = pd.DataFrame()
        result = _enrich_with_regime(empty_df, "BTC/USD", "1h")
        self.assertTrue(result.empty)

    @patch("features.features.mongo_client")
    def test_enrich_with_regime_duration_calculation(self, mock_mongo):
        """Test that regime_duration_bars is calculated correctly."""
        # Create regime data with transitions
        timestamps = pd.date_range(start="2024-01-01", periods=20, freq="1h")
        regime_docs = [
            {"timestamp": timestamps[0], "trend_regime": "TRENDING_UP", "volatility_regime": "NORMAL_VOLATILITY", "confidence": 0.8},
            {"timestamp": timestamps[10], "trend_regime": "SIDEWAYS", "volatility_regime": "NORMAL_VOLATILITY", "confidence": 0.7},
        ]
        
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_collection.find.return_value.sort.return_value = regime_docs
        mock_db.__getitem__.return_value = mock_collection
        mock_client = MagicMock()
        mock_client.__enter__.return_value = mock_client
        mock_client.__getitem__.return_value = mock_db
        mock_mongo.return_value = mock_client
        
        df = pd.DataFrame({"close": range(20)}, index=timestamps)
        result = _enrich_with_regime(df, "BTC/USD", "1h")
        
        # Verify duration resets at regime change
        self.assertEqual(result.iloc[0]["regime_duration_bars"], 0)
        self.assertGreater(result.iloc[9]["regime_duration_bars"], 0)
        self.assertEqual(result.iloc[10]["regime_duration_bars"], 0)


class TestRegimeIndicators(unittest.TestCase):
    """Test regime-specific indicators."""

    def setUp(self):
        """Set up test fixtures."""
        timestamps = pd.date_range(start="2024-01-01", periods=100, freq="1h")
        self.df = pd.DataFrame({
            "close": np.random.uniform(40000, 45000, 100),
            "regime_trend": ["TRENDING_UP"] * 50 + ["SIDEWAYS"] * 50,
            "regime_volatility": ["NORMAL_VOLATILITY"] * 100,
            "regime_confidence": [0.8] * 100,
            "regime_duration_bars": list(range(50)) + list(range(50)),
        }, index=timestamps)

    def test_add_regime_indicators(self):
        """Test adding regime indicators."""
        result = add_regime_indicators(self.df)
        
        # Verify indicators added
        self.assertIn("regime_stability", result.columns)
        self.assertIn("regime_change_flag", result.columns)

    def test_regime_stability_calculation(self):
        """Test regime stability calculation."""
        result = add_regime_indicators(self.df)
        
        # Stability should increase with duration
        self.assertLess(result.iloc[0]["regime_stability"], result.iloc[10]["regime_stability"])
        self.assertLess(result.iloc[10]["regime_stability"], result.iloc[30]["regime_stability"])
        
        # Stability should be between 0 and 1
        self.assertTrue((result["regime_stability"] >= 0).all())
        self.assertTrue((result["regime_stability"] <= 1).all())

    def test_regime_change_flag(self):
        """Test regime change flag."""
        result = add_regime_indicators(self.df)
        
        # Flag should be 1 for recent regime changes (duration < 5)
        self.assertEqual(result.iloc[0]["regime_change_flag"], 1)
        self.assertEqual(result.iloc[3]["regime_change_flag"], 1)
        self.assertEqual(result.iloc[50]["regime_change_flag"], 1)  # Regime transition
        
        # Flag should be 0 for stable regimes (duration >= 5)
        self.assertEqual(result.iloc[20]["regime_change_flag"], 0)
        self.assertEqual(result.iloc[60]["regime_change_flag"], 0)

    def test_regime_indicators_empty_df(self):
        """Test regime indicators with empty dataframe."""
        empty_df = pd.DataFrame()
        result = add_regime_indicators(empty_df)
        self.assertTrue(result.empty)

    def test_regime_indicators_missing_columns(self):
        """Test regime indicators with missing regime columns."""
        df_no_regime = pd.DataFrame({"close": [1, 2, 3]})
        result = add_regime_indicators(df_no_regime)
        
        # Should return dataframe unchanged
        self.assertNotIn("regime_stability", result.columns)
        self.assertNotIn("regime_change_flag", result.columns)


class TestCleanFeatureFrame(unittest.TestCase):
    """Test clean_feature_frame with regime features."""

    def test_clean_with_regime_features(self):
        """Test that clean_feature_frame includes regime columns."""
        timestamps = pd.date_range(start="2024-01-01", periods=10, freq="1h")
        df = pd.DataFrame({
            "return_1": np.random.uniform(-0.01, 0.01, 10),
            "ema_9": np.random.uniform(40000, 45000, 10),
            "ema_21": np.random.uniform(40000, 45000, 10),
            "rsi_14": np.random.uniform(30, 70, 10),
            "macd": np.random.uniform(-100, 100, 10),
            "macd_signal": np.random.uniform(-100, 100, 10),
            "macd_hist": np.random.uniform(-50, 50, 10),
            "volatility_1h": np.random.uniform(0.001, 0.01, 10),
            "regime_trend": ["TRENDING_UP"] * 10,
            "regime_volatility": ["NORMAL_VOLATILITY"] * 10,
            "regime_confidence": [0.8] * 10,
            "regime_duration_bars": list(range(10)),
            "regime_stability": np.random.uniform(0.5, 1.0, 10),
            "regime_change_flag": [0] * 10,
        }, index=timestamps)
        
        result = clean_feature_frame(df)
        
        # Verify regime columns included
        self.assertIn("regime_trend", result.columns)
        self.assertIn("regime_volatility", result.columns)
        self.assertIn("regime_confidence", result.columns)
        self.assertIn("regime_duration_bars", result.columns)
        self.assertIn("regime_stability", result.columns)
        self.assertIn("regime_change_flag", result.columns)

    def test_clean_without_regime_features(self):
        """Test that clean_feature_frame works without regime columns."""
        timestamps = pd.date_range(start="2024-01-01", periods=10, freq="1h")
        df = pd.DataFrame({
            "return_1": np.random.uniform(-0.01, 0.01, 10),
            "ema_9": np.random.uniform(40000, 45000, 10),
            "ema_21": np.random.uniform(40000, 45000, 10),
            "rsi_14": np.random.uniform(30, 70, 10),
            "macd": np.random.uniform(-100, 100, 10),
            "macd_signal": np.random.uniform(-100, 100, 10),
            "macd_hist": np.random.uniform(-50, 50, 10),
            "volatility_1h": np.random.uniform(0.001, 0.01, 10),
        }, index=timestamps)
        
        result = clean_feature_frame(df)
        
        # Verify only technical features included
        self.assertEqual(len(result.columns), 8)
        self.assertNotIn("regime_trend", result.columns)


class TestRegimeBasedSplit(unittest.TestCase):
    """Test regime-based train/test splitting."""

    def setUp(self):
        """Set up test fixtures."""
        n = 200
        timestamps = pd.date_range(start="2024-01-01", periods=n, freq="1h")
        
        # Create data with regime labels
        self.X = pd.DataFrame({
            "return_1": np.random.uniform(-0.01, 0.01, n),
            "ema_9": np.random.uniform(40000, 45000, n),
            "regime_trend": (["TRENDING_UP"] * 60 + ["TRENDING_DOWN"] * 60 + ["SIDEWAYS"] * 80),
            "regime_confidence": np.random.uniform(0.7, 0.9, n),
        }, index=timestamps)
        
        self.y = pd.Series(np.random.uniform(-0.02, 0.02, n), index=timestamps)

    def test_regime_based_split_default(self):
        """Test regime-based split with default parameters."""
        splits = regime_based_split(self.X, self.y)
        
        # Verify all splits exist
        self.assertIn("X_train", splits)
        self.assertIn("y_train", splits)
        self.assertIn("X_val", splits)
        self.assertIn("y_val", splits)
        self.assertIn("X_test", splits)
        self.assertIn("y_test", splits)
        
        # Verify training data contains only trending regimes
        train_regimes = set(splits["X_train"]["regime_trend"].unique())
        self.assertTrue(train_regimes.issubset({"TRENDING_UP", "TRENDING_DOWN"}))
        
        # Verify test data contains only sideways regime
        test_regimes = set(splits["X_test"]["regime_trend"].unique())
        self.assertEqual(test_regimes, {"SIDEWAYS"})

    def test_regime_based_split_custom_regimes(self):
        """Test regime-based split with custom regime selections."""
        splits = regime_based_split(
            self.X, self.y,
            train_regimes=["TRENDING_UP"],
            test_regimes=["TRENDING_DOWN", "SIDEWAYS"]
        )
        
        # Verify training data contains only TRENDING_UP
        train_regimes = set(splits["X_train"]["regime_trend"].unique())
        self.assertEqual(train_regimes, {"TRENDING_UP"})
        
        # Verify test data contains TRENDING_DOWN and SIDEWAYS
        test_regimes = set(splits["X_test"]["regime_trend"].unique())
        self.assertTrue(test_regimes.issubset({"TRENDING_DOWN", "SIDEWAYS"}))

    def test_regime_based_split_insufficient_data(self):
        """Test regime-based split with insufficient data."""
        # Create small dataset
        small_X = self.X.head(50)
        small_y = self.y.head(50)
        
        # Should raise error if not enough test data
        with self.assertRaises(RuntimeError):
            regime_based_split(small_X, small_y, test_regimes=["NONEXISTENT_REGIME"])

    def test_regime_based_split_missing_regime_column(self):
        """Test regime-based split without regime column."""
        X_no_regime = self.X.drop(columns=["regime_trend"])
        
        with self.assertRaises(RuntimeError):
            regime_based_split(X_no_regime, self.y)

    def test_regime_based_split_val_ratio(self):
        """Test regime-based split respects val_ratio."""
        splits = regime_based_split(self.X, self.y, val_ratio=0.2)
        
        train_size = len(splits["X_train"])
        val_size = len(splits["X_val"])
        
        # Validation should be approximately 20% of training data
        expected_val_size = int((train_size + val_size) * 0.2)
        self.assertAlmostEqual(val_size, expected_val_size, delta=2)


class TestSimulatorRegimeContext(unittest.TestCase):
    """Test simulator regime context functionality."""

    @patch("simulator.runner.mongo_client")
    def test_get_regime_for_timestamp(self, mock_mongo):
        """Test retrieving regime for timestamp."""
        from simulator.runner import _get_regime_for_timestamp
        
        # Mock regime document
        regime_doc = {
            "timestamp": datetime(2024, 1, 1, 12, 0),
            "trend_regime": "TRENDING_UP",
            "volatility_regime": "NORMAL_VOLATILITY",
            "confidence": 0.85,
        }
        
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_collection.find_one.return_value = regime_doc
        mock_db.__getitem__.return_value = mock_collection
        mock_client = MagicMock()
        mock_client.__enter__.return_value = mock_client
        mock_client.__getitem__.return_value = mock_db
        mock_mongo.return_value = mock_client
        
        # Call function
        result = _get_regime_for_timestamp("BTC/USD", "1h", datetime(2024, 1, 1, 13, 0))
        
        # Verify result
        self.assertEqual(result["trend_regime"], "TRENDING_UP")
        self.assertEqual(result["volatility_regime"], "NORMAL_VOLATILITY")
        self.assertEqual(result["confidence"], 0.85)

    @patch("simulator.runner.mongo_client")
    def test_get_regime_for_timestamp_not_found(self, mock_mongo):
        """Test retrieving regime when none exists."""
        from simulator.runner import _get_regime_for_timestamp
        
        # Mock no regime found
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_collection.find_one.return_value = None
        mock_db.__getitem__.return_value = mock_collection
        mock_client = MagicMock()
        mock_client.__enter__.return_value = mock_client
        mock_client.__getitem__.return_value = mock_db
        mock_mongo.return_value = mock_client
        
        # Call function
        result = _get_regime_for_timestamp("BTC/USD", "1h", datetime(2024, 1, 1, 13, 0))
        
        # Verify default values
        self.assertEqual(result["trend_regime"], "UNDEFINED")
        self.assertEqual(result["volatility_regime"], "UNDEFINED")
        self.assertEqual(result["confidence"], 0.0)


if __name__ == "__main__":
    unittest.main()

