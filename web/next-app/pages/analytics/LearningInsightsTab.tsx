/* eslint-disable */
// @ts-nocheck
import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";

import { ErrorMessage } from "@/components/ErrorMessage";
import { InsightsTabs } from "@/components/InsightsTabs";
import { OpportunitiesRightNow } from "@/components/OpportunitiesRightNow";
import { SuccessState } from "@/components/SuccessState";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LearningImpactChart } from "@/components/LearningImpactChart";
import { Eye, EyeOff } from "lucide-react";
import { useMode } from "@/lib/mode-context";
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

export default function LearningInsightsTab() {
  const { isEasyMode } = useMode();
  const [showTechnicalView, setShowTechnicalView] = useState(!isEasyMode);
  
  const { data: metaData, mutate: mutateMeta, isLoading: isLoadingMeta } = useSWR<MetaModelResponse>(
    "/api/learning/meta-model",
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
    },
  );
  const { data: allocatorData, mutate: mutateAllocator, isLoading: isLoadingAllocator } = useSWR<AllocatorResponse>(
    "/api/learning/allocator",
    fetcher,
    {
      refreshInterval: 120_000,
    },
  );
  const { data: overfitData, mutate: mutateOverfit, isLoading: isLoadingOverfit } = useSWR<OverfitResponse>(
    "/api/learning/overfit?status=open",
    fetcher,
    {
      refreshInterval: 60_000,
    },
  );
  const { data: knowledgeData, mutate: mutateKnowledge, isLoading: isLoadingKnowledge } = useSWR<KnowledgeResponse>(
    "/api/knowledge/latest",
    fetcher,
    {
      refreshInterval: 300_000,
    },
  );

  // Mock learning impact data (would come from API in production)
  const learningImpact = useMemo(() => ({
    before: {
      avg_roi: 0.045,
      sharpe_ratio: 1.2,
      win_rate: 0.58,
      strategy_count: 12,
    },
    after: {
      avg_roi: 0.062,
      sharpe_ratio: 1.45,
      win_rate: 0.64,
      strategy_count: 15,
    },
    improvements: {
      roi_change: 0.017,
      sharpe_change: 0.25,
      win_rate_change: 0.06,
      strategies_added: 5,
      strategies_removed: 2,
    },
    cycle_date: new Date(Date.now() - 86400000 * 2).toISOString(),
  }), []);

  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [cycleStatus, setCycleStatus] = useState<{ running: boolean; error?: string; message?: string }>({
    running: false,
  });

  const handleAck = useCallback(
    async (alertId: string) => {
      setAcknowledgingId(alertId);
      try {
        await postJson("/api/learning/overfit/ack", { alert_id: alertId });
        await mutateOverfit();
        await mutateKnowledge();
      } catch (error) {
        console.error("Failed to acknowledge alert", error);
      } finally {
        setAcknowledgingId(null);
      }
    },
    [mutateKnowledge, mutateOverfit],
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
      await Promise.all([mutateMeta(), mutateAllocator(), mutateOverfit(), mutateKnowledge()]);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run learning cycle.";
      setCycleStatus({ running: false, error: message });
      return null;
    }
  }, [mutateAllocator, mutateKnowledge, mutateMeta, mutateOverfit]);

  const metaInsights = useMemo(() => {
    return metaData?.latest;
  }, [metaData]);

  const allocatorInsights = useMemo(() => {
    const snapshot = allocatorData?.snapshot;
    return snapshot
      ? {
          weights: snapshot.weights,
          expected_portfolio_return: snapshot.expected_portfolio_return,
          expected_portfolio_risk: snapshot.expected_portfolio_risk,
        }
      : undefined;
  }, [allocatorData]);

  const knowledgeInsights = useMemo(() => {
    const entry = knowledgeData?.entry;
    if (!entry) {
      return undefined;
    }
    return {
      summary: entry.summary,
      created_at: entry.created_at,
      overfit_ids: entry.overfit_ids,
      queued_strategies: entry.queued_strategies,
    };
  }, [knowledgeData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Learning Insights
            <TooltipExplainer 
              term="Learning Insights" 
              explanation="This is the meta-learning layer that learns from all your strategies' performance. It trains models to predict which strategies will work best, allocates resources to the most promising approaches, and detects when strategies are overfitting (performing well in tests but poorly in reality). This adaptive system helps the platform continuously improve its decision-making."
            />
          </h2>
          <p className="text-sm text-muted-foreground">
            {showTechnicalView 
              ? "Meta-model diagnostics, allocator decisions, and overfitting alerts from the adaptive intelligence loop."
              : "See what the system learned and how it's improving your trading strategies."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowTechnicalView(!showTechnicalView)}
          >
            {showTechnicalView ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {showTechnicalView ? "Beginner View" : "Technical View"}
          </Button>
          <Button onClick={runCycle} disabled={cycleStatus.running}>
            {cycleStatus.running ? "Running Cycle…" : "Run Learning Cycle"}
            <TooltipExplainer 
              term="Run Learning Cycle" 
              explanation="This executes the complete learning cycle: (1) trains the meta-model on recent strategy performance, (2) generates new candidate strategies based on what's working, (3) rebalances portfolio allocations, and (4) evaluates all strategies for overfitting. This helps the system adapt to changing market conditions and optimize its approach over time."
              size="sm"
            />
          </Button>
        </div>
      </div>

      {cycleStatus.error && (
        <ErrorMessage
          title="Cycle failed"
          message={cycleStatus.error}
          onRetry={() => runCycle()}
        />
      )}

      {cycleStatus.message && !cycleStatus.error && (
        <SuccessState
          title="Learning cycle completed"
          message={cycleStatus.message}
        />
      )}

      <OpportunitiesRightNow />

      {/* Learning Impact Chart */}
      {showTechnicalView && <LearningImpactChart metrics={learningImpact} />}

      {/* Beginner View: Plain English Summary */}
      {!showTechnicalView && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle>What the System Learned</CardTitle>
            <CardDescription>Plain-English summary of recent improvements</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">📈 Performance Improvements</h4>
              <p className="text-sm text-muted-foreground">
                After the latest learning cycle, your trading strategies are performing better. 
                The average return increased by {((learningImpact.improvements.roi_change) * 100).toFixed(1)}%, 
                and the win rate improved by {((learningImpact.improvements.win_rate_change) * 100).toFixed(1)}%.
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">🎯 Strategy Changes</h4>
              <p className="text-sm text-muted-foreground">
                The system added {learningImpact.improvements.strategies_added} new profitable strategies 
                and removed {learningImpact.improvements.strategies_removed} underperforming ones. 
                You now have {learningImpact.after.strategy_count} active strategies working for you.
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">💡 What This Means</h4>
              <p className="text-sm text-muted-foreground">
                {learningImpact.improvements.roi_change > 0.01
                  ? "The learning cycle was successful! The system is adapting well to current market conditions. Continue monitoring performance and run learning cycles regularly."
                  : "The system is continuously learning and adapting. Even small improvements compound over time. Keep your data fresh and run learning cycles after significant market changes."}
              </p>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowTechnicalView(true)}
            >
              <Eye className="mr-2 h-4 w-4" />
              View Technical Details
            </Button>
          </CardContent>
        </Card>
      )}

      <InsightsTabs
        meta={metaInsights}
        allocator={allocatorInsights}
        overfit={overfitData}
        knowledge={knowledgeInsights}
        acknowledgingId={acknowledgingId}
        onAckOverfit={handleAck}
        isLoading={{
          meta: isLoadingMeta,
          allocator: isLoadingAllocator,
          overfit: isLoadingOverfit,
          knowledge: isLoadingKnowledge,
        }}
      />
    </div>
  );
}

