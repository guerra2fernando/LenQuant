/**
 * Type definitions for data ingestion system
 */

export interface ProgressDetails {
  current_candle_timestamp?: string;
  expected_start_timestamp?: string;
  expected_end_timestamp?: string;
  candles_per_batch?: number;
  batches_completed?: number;
  batches_total?: number;
  estimated_completion_seconds?: number;
}

export interface JobStep {
  step_name: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  started_at?: string;
  completed_at?: string;
  progress_pct?: number;
}

export type JobStatus = "pending" | "queued" | "in_progress" | "completed" | "failed" | "cancelled";

export interface IngestionJob {
  job_id: string;
  job_type: string;
  symbol: string;
  interval: string;
  lookback_days?: number;
  status: JobStatus;
  progress_pct: number;
  current_step?: string;
  records_fetched: number;
  records_expected?: number;
  features_generated: number;
  error_message?: string;
  error_details?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  progress_details?: ProgressDetails;
  steps?: JobStep[];
  last_updated?: string;
  retry_count?: number;
  parent_job_id?: string;
}

export interface BatchJobStatus {
  parent_job_id: string;
  status: string;
  overall_progress_pct: number;
  total_jobs: number;
  completed: number;
  failed: number;
  in_progress: number;
  pending: number;
  child_jobs: IngestionJob[];
  created_at: string;
}

export interface SymbolIntervalStatus {
  last_updated?: string;
  record_count?: number;
  feature_count?: number;
  oldest_record?: string;
  newest_record?: string;
  data_quality_score?: number;
  has_gaps?: boolean;
  last_ingestion_job_id?: string;
}

export interface SymbolStatus {
  symbol: string;
  base_increment?: number;
  quote_increment?: number;
  intervals_status?: Record<string, SymbolIntervalStatus>;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StartIngestionRequest {
  symbols: string[];
  intervals: string[];
  lookback_days?: number;
  batch_size?: number;
  job_type?: string;
}

export interface StartIngestionResponse {
  job_id: string;
  message: string;
  total_combinations: number;
}

