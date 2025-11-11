export type CohortAlert = {
  type?: string;
  message?: string;
  severity?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
};

export type CohortWindow = {
  start?: string | null;
  end?: string | null;
} | null;

export type CohortAgentMetrics = {
  roi?: number;
  realized_pnl?: number;
  confidence_score?: number;
  max_drawdown_parent?: number;
  trade_count?: number;
  bankroll_utilization_pct?: number;
  hourly_roi?: Array<{ timestamp: string; roi?: number; avg_roi?: number }>;
  leverage_breach?: boolean;
  max_exposure?: number;
  variance?: number;
  ending_equity?: number;
  timestamp_start?: string | null;
  timestamp_end?: string | null;
  avg_slippage_pct?: number;
  slippage_pct?: number;
};

export type CohortAgent = {
  strategy_id?: string;
  run_id?: string;
  allocation?: number;
  metrics: CohortAgentMetrics;
  alerts: CohortAlert[];
};

export type CohortSummaryAgent = {
  strategy_id?: string;
  run_id?: string;
  roi?: number;
  pnl?: number;
};

export type CohortSummary = {
  generated_at?: string;
  total_pnl?: number;
  total_roi?: number;
  bankroll_utilization_pct?: number;
  trade_count?: number;
  confidence_score?: number;
  best_agent?: CohortSummaryAgent | null;
  worst_agent?: CohortSummaryAgent | null;
  hourly_roi?: Array<{ timestamp: string; avg_roi?: number }>;
  alerts?: CohortAlert[];
  leverage_breaches?: Array<Record<string, unknown>>;
  window?: CohortWindow;
};

export type ParentSnapshot = {
  name?: string;
  starting_balance?: number;
  balance?: number;
  equity?: number;
  utilization?: number;
  aggregate_exposure?: number;
  exposure_limit?: number | null;
  leverage_ceiling?: number | null;
  realized_pnl?: number;
  drawdown_pct?: number;
  capital_assigned: Record<string, number>;
  capital_outstanding: Record<string, number>;
  current_exposures: Record<string, number>;
  metadata: Record<string, unknown>;
  ledger_recent: Array<{
    timestamp?: string;
    account?: string;
    entry_type?: string;
    amount?: number;
    parent_balance_after?: number;
    metadata?: Record<string, unknown>;
  }>;
};

export type CohortListItem = {
  cohort_id: string;
  created_at?: string;
  bankroll?: number;
  agent_count?: number;
  allocation_policy?: string;
  summary?: CohortSummary;
  alerts?: CohortAlert[];
  agents?: Array<{
    strategy_id?: string;
    run_id?: string;
    allocation?: number;
    roi?: number;
    realized_pnl?: number;
    confidence_score?: number;
  }>;
  csv_url: string;
};

export type IntradayCohort = CohortListItem & {
  symbol?: string;
  interval?: string;
  horizon?: string;
  runtime_seconds?: number;
  metadata: Record<string, unknown>;
  agents: CohortAgent[];
  alerts: CohortAlert[];
  window?: CohortWindow;
};

export type PromotionGuardRailCheck = {
  id: string;
  label: string;
  status: boolean;
  value?: number;
  threshold?: number;
};

export type PromotionBestCandidate = {
  strategy_id?: string;
  run_id?: string;
  allocation?: number;
  metrics: CohortAgentMetrics;
  summary?: CohortSummaryAgent | null;
};

export type PromotionPreview = {
  ready: boolean;
  checks: PromotionGuardRailCheck[];
  recommended_allocation: number;
  recommended_bankroll_slice_pct: number;
  best_candidate: PromotionBestCandidate;
  leverage_breaches: Array<Record<string, unknown>>;
  high_severity_alerts: CohortAlert[];
  utilization_pct?: number;
  parent_drawdown_pct?: number;
  candidate_drawdown_pct?: number;
  trade_count?: number;
  slippage_pct?: number;
};

export type IntradayCohortDetail = {
  cohort: IntradayCohort;
  summary: CohortSummary;
  parent: ParentSnapshot;
  promotion: PromotionPreview;
};

export type LaunchIntradayResponse = {
  status: string;
  cohort: IntradayCohort & {
    summary: CohortSummary;
    parent_wallet: ParentSnapshot;
  };
};

export type PromotionResponse = {
  status: string;
  result: Record<string, unknown>;
  message?: string;
};

