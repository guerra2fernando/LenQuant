import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";

import { InsightsTabs } from "@/components/InsightsTabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetcher, postJson } from "@/lib/api";

type MetaModelResponse = {
  latest?: {
    trained_at?: string;
    sample_count?: number;
    metrics?: Record<string, number>;
    feature_importances?: { feature: string; importance: number }[];
  };
};

type AllocatorResponse = {
  snapshot?: {
    weights?: { strategy_id: string; weight: number; expected_roi?: number }[];
    expected_portfolio_return?: number;
    expected_portfolio_risk?: number;
    history?: Record<string, number[]>;
  };
};

type OverfitResponse = {
  alerts: Array<{
    _id?: string;
    strategy_id: string;
    decay: number;
    baseline_roi?: number;
    recent_roi?: number;
    detected_at?: string;
    latest_run_id?: string;
    sharpe_delta?: number;
  }>;
};

type KnowledgeResponse = {
  entry?: {
    summary?: string;
    created_at?: string;
    overfit_ids?: string[];
    queued_strategies?: string[];
  };
};

export default function InsightsPage() {
  const metaQuery = useSWR<MetaModelResponse>("/api/learning/meta-model", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });
  const allocatorQuery = useSWR<AllocatorResponse>("/api/learning/allocator", fetcher, {
    refreshInterval: 120_000,
  });
  const overfitQuery = useSWR<OverfitResponse>("/api/learning/overfit?status=open", fetcher, {
    refreshInterval: 60_000,
  });
  const knowledgeQuery = useSWR<KnowledgeResponse>("/api/knowledge/latest", fetcher, {
    refreshInterval: 300_000,
  });

  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [cycleStatus, setCycleStatus] = useState<{ running: boolean; error?: string; message?: string }>({
    running: false,
  });

  const handleAck = useCallback(
    async (alertId: string) => {
      setAcknowledgingId(alertId);
      try {
        await postJson("/api/learning/overfit/ack", { alert_id: alertId });
        await overfitQuery.mutate();
        await knowledgeQuery.mutate();
      } catch (error) {
        console.error("Failed to acknowledge alert", error);
      } finally {
        setAcknowledgingId(null);
      }
    },
    [knowledgeQuery, overfitQuery],
  );

  const runCycle = useCallback(async () => {
    setCycleStatus({ running: true });
    try {
      const response = await postJson("/api/learning/cycle/run", {
        train_meta: true,
        generate_candidates: true,
        rebalance: true,
        evaluate_overfit: true,
      });
      setCycleStatus({ running: false, message: "Learning cycle completed." });
      await Promise.all([metaQuery.mutate(), allocatorQuery.mutate(), overfitQuery.mutate(), knowledgeQuery.mutate()]);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run learning cycle.";
      setCycleStatus({ running: false, error: message });
      return null;
    }
  }, [allocatorQuery, knowledgeQuery, metaQuery, overfitQuery]);

  const metaInsights = useMemo(() => {
    return metaQuery.data?.latest;
  }, [metaQuery.data]);

  const allocatorInsights = useMemo(() => {
    const snapshot = allocatorQuery.data?.snapshot;
    return snapshot
      ? {
          weights: snapshot.weights,
          expected_portfolio_return: snapshot.expected_portfolio_return,
          expected_portfolio_risk: snapshot.expected_portfolio_risk,
        }
      : undefined;
  }, [allocatorQuery.data]);

  const knowledgeInsights = useMemo(() => {
    const entry = knowledgeQuery.data?.entry;
    if (!entry) {
      return undefined;
    }
    return {
      summary: entry.summary,
      created_at: entry.created_at,
      overfit_ids: entry.overfit_ids,
      queued_strategies: entry.queued_strategies,
    };
  }, [knowledgeQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Learning Insights</h1>
          <p className="text-sm text-muted-foreground">
            Meta-model diagnostics, allocator decisions, and overfitting alerts from the adaptive intelligence loop.
          </p>
        </div>
        <Button onClick={runCycle} disabled={cycleStatus.running}>
          {cycleStatus.running ? "Running Cycle…" : "Run Learning Cycle"}
        </Button>
      </div>

      {cycleStatus.error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Cycle failed</CardTitle>
            <CardDescription className="text-destructive/80">{cycleStatus.error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {cycleStatus.message && !cycleStatus.error && (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="py-3 text-sm text-emerald-900 dark:text-emerald-100">{cycleStatus.message}</CardContent>
        </Card>
      )}

      <InsightsTabs
        meta={metaInsights}
        allocator={allocatorInsights}
        overfit={overfitQuery.data}
        knowledge={knowledgeInsights}
        acknowledgingId={acknowledgingId}
        onAckOverfit={handleAck}
        isLoading={{
          meta: metaQuery.isLoading,
          allocator: allocatorQuery.isLoading,
          overfit: overfitQuery.isLoading,
          knowledge: knowledgeQuery.isLoading,
        }}
      />
    </div>
  );
}

