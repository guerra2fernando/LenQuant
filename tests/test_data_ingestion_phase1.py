"""
Tests for Phase 1: Core Async Data Ingestion Infrastructure.

These tests verify the basic functionality of the asynchronous data ingestion system.
"""
from __future__ import annotations

import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock

from data_ingest.tasks import ingest_symbol_interval_task, batch_ingest_task


class TestIngestionTasks:
    """Test Celery tasks for data ingestion."""

    @patch("data_ingest.tasks.fetch_symbol_interval")
    @patch("data_ingest.tasks.generate_for_symbol")
    @patch("data_ingest.tasks.mongo_client")
    def test_ingest_symbol_interval_success(
        self, mock_mongo_client, mock_generate, mock_fetch
    ):
        """Test successful ingestion of a single symbol/interval."""
        # Mock returns
        mock_fetch.return_value = 1000
        mock_generate.return_value = 990
        
        # Mock MongoDB
        mock_db = MagicMock()
        mock_jobs = MagicMock()
        mock_db.__getitem__.return_value = mock_jobs
        mock_client = MagicMock()
        mock_client.__getitem__.return_value = mock_db
        mock_mongo_client.return_value.__enter__.return_value = mock_client
        
        # Create mock task
        mock_task = MagicMock()
        mock_task.request.id = "test-task-id"
        
        # Call task
        result = ingest_symbol_interval_task(
            mock_task,
            job_id="test_job_001",
            symbol="BTC/USD",
            interval="1m",
            lookback_days=1
        )
        
        # Verify results
        assert result["status"] == "completed"
        assert result["records_fetched"] == 1000
        assert result["features_generated"] == 990
        
        # Verify job status updates were called
        assert mock_jobs.update_one.call_count >= 3  # in_progress, generating_features, completed

    @patch("data_ingest.tasks.ingest_symbol_interval_task")
    @patch("data_ingest.tasks.mongo_client")
    def test_batch_ingest_creates_child_jobs(
        self, mock_mongo_client, mock_ingest_task
    ):
        """Test that batch ingestion creates child jobs for all symbol/interval combinations."""
        # Mock MongoDB
        mock_db = MagicMock()
        mock_jobs = MagicMock()
        mock_db.__getitem__.return_value = mock_jobs
        mock_client = MagicMock()
        mock_client.__getitem__.return_value = mock_db
        mock_mongo_client.return_value.__enter__.return_value = mock_client
        
        # Mock task apply_async
        mock_ingest_task.apply_async = MagicMock()
        
        # Create mock task
        mock_task = MagicMock()
        
        # Call batch task
        symbols = ["BTC/USD", "ETH/USDT"]
        intervals = ["1m", "5m"]
        
        result = batch_ingest_task(
            mock_task,
            parent_job_id="batch_test_001",
            symbols=symbols,
            intervals=intervals,
            lookback_days=1
        )
        
        # Verify results
        assert result["total_jobs"] == 4  # 2 symbols × 2 intervals
        assert len(result["child_job_ids"]) == 4
        
        # Verify child jobs were created
        assert mock_jobs.insert_one.call_count == 4
        
        # Verify tasks were enqueued
        assert mock_ingest_task.apply_async.call_count == 4


class TestDataIngestionAPI:
    """Test API endpoints for data ingestion."""

    def test_start_ingestion_requires_symbols(self):
        """Test that start ingestion requires symbols and intervals."""
        from api.routes.data_ingestion import StartIngestionRequest
        from pydantic import ValidationError
        
        # Should fail without symbols
        with pytest.raises(ValidationError):
            StartIngestionRequest(symbols=[], intervals=["1m"])

    def test_job_status_response_model(self):
        """Test JobStatusResponse model."""
        from api.routes.data_ingestion import JobStatusResponse
        
        response = JobStatusResponse(
            job_id="test_001",
            status="completed",
            progress_pct=100.0,
            records_fetched=1000,
            features_generated=990,
            created_at=datetime.utcnow()
        )
        
        assert response.job_id == "test_001"
        assert response.status == "completed"
        assert response.progress_pct == 100.0


def test_database_initialization():
    """Test that database initialization creates indexes."""
    from db.startup import create_indexes
    
    # This is a smoke test - just verify it doesn't crash
    # In a real test environment, you'd verify indexes were created
    with patch("db.startup.mongo_client") as mock_client:
        mock_db = MagicMock()
        mock_mongo = MagicMock()
        mock_mongo.__getitem__.return_value = mock_db
        mock_client.return_value.__enter__.return_value = mock_mongo
        
        # Should not raise exception
        create_indexes()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

