/* eslint-disable */
// @ts-nocheck

import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeatureImportanceHeatmap } from "@/components/FeatureImportanceHeatmap";
import { AllocationDiffList } from "@/components/AllocationDiffList";
import { AllocatorAllocationChart } from "@/components/AllocatorAllocationChart";
import { KnowledgeSummaryCard } from "@/components/KnowledgeSummaryCard";
import { OverfitAlertTable } from "@/components/OverfitAlertTable";
import { RiskScoreCard } from "@/components/RiskScoreCard";
import { SendToAssistantButton } from "@/components/SendToAssistantButton";
import { Button } from "@/components/ui/button";

type MetaModelInsights = {
  trained_at?: string;
  sample_count?: number;
  metrics?: Record<string, number>;
  feature_importances?: { feature: string; importance: number }[];
};

type AllocationInsights = {
  weights?: { strategy_id: string; weight: number; expected_roi?: number }[];
  expected_portfolio_return?: number;
  expected_portfolio_risk?: number;
  previous_weights?: { strategy_id: string; weight: number }[];
};

type OverfitInsights = {
  alerts?: {
    _id?: string;
    strategy_id: string;
    decay: number;
    baseline_roi?: number;
    recent_roi?: number;
    detected_at?: string;
    latest_run_id?: string;
    sharpe_delta?: number;
  }[];
};

type KnowledgeInsights = {
  summary?: string;
  created_at?: string;
  overfit_ids?: string[];
  queued_strategies?: string[];
};

type Props = {
  meta?: MetaModelInsights;
  allocator?: AllocationInsights;
  overfit?: OverfitInsights;
  knowledge?: KnowledgeInsights;
  onAckOverfit?: (alertId: string) => void;
  acknowledgingId?: string | null;
  isLoading?: {
    meta?: boolean;
    allocator?: boolean;
    overfit?: boolean;
    knowledge?: boolean;
  };
};

const TABS = [
  { id: "meta", label: "Meta-Model" },
  { id: "allocator", label: "Allocator" },
  { id: "overfit", label: "Overfitting" },
  { id: "knowledge", label: "Knowledge" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function InsightsTabs({ meta, allocator, overfit, knowledge, onAckOverfit, acknowledgingId, isLoading }: Props) {
  const [tab, setTab] = useState<TabId>("meta");

  const metaMetrics = useMemo(() => {
    if (!meta?.metrics) {
      return [];
    }
    return Object.entries(meta.metrics).map(([key, value]) => ({
      key,
      value,
    }));
  }, [meta]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? "default" : "outline"}
            onClick={() => setTab(item.id)}
            size="sm"
          >
            {item.label}
          </Button>
        ))}
      </div>

      {tab === "meta" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Training Snapshot</CardTitle>
              <CardDescription>
                {meta?.trained_at ? `Trained ${new Date(meta.trained_at).toLocaleString()}` : "Awaiting first training run"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Samples used: {meta?.sample_count ?? "—"}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {metaMetrics.map((metric) => (
                  <div key={metric.key} className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.key.replace(/_/g, " ")}</p>
                    <p className="text-lg font-semibold">{metric.value.toFixed(4)}</p>
                  </div>
                ))}
                {metaMetrics.length === 0 && (
                  <p className="text-sm text-muted-foreground">No evaluation metrics captured yet.</p>
                )}
              </div>
              <SendToAssistantButton prompt="Summarise the latest meta-model feature drivers">
                Ask Assistant about drivers
              </SendToAssistantButton>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Feature Importances</CardTitle>
              <CardDescription>Signals guiding the learning engine's fitness predictions.</CardDescription>
            </CardHeader>
            <CardContent>
              <FeatureImportanceHeatmap
                data={meta?.feature_importances}
                isLoading={isLoading?.meta}
                caption="Higher scores indicate greater influence on predicted ROI."
              />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "allocator" && (
        <div className="space-y-6">
          <RiskScoreCard
            expectedReturn={allocator?.expected_portfolio_return}
            expectedRisk={allocator?.expected_portfolio_risk}
          />
          <Card>
            <CardHeader>
              <CardTitle>Current Allocation</CardTitle>
              <CardDescription>Weights determined by the learning allocator.</CardDescription>
            </CardHeader>
            <CardContent>
              <AllocatorAllocationChart allocations={allocator?.weights} isLoading={isLoading?.allocator} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Allocation Changes</CardTitle>
              <CardDescription>Comparison with previous snapshot.</CardDescription>
            </CardHeader>
            <CardContent>
              <AllocationDiffList current={allocator?.weights} previous={allocator?.previous_weights} />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "overfit" && (
        <Card>
          <CardHeader>
            <CardTitle>Overfitting Watchlist</CardTitle>
            <CardDescription>Strategies flagged for degradation after promotion.</CardDescription>
          </CardHeader>
          <CardContent>
            <OverfitAlertTable
              alerts={overfit?.alerts}
              isLoading={isLoading?.overfit}
              onAcknowledge={onAckOverfit}
              acknowledgingId={acknowledgingId}
            />
          </CardContent>
        </Card>
      )}

      {tab === "knowledge" && (
        <KnowledgeSummaryCard
          summary={knowledge?.summary}
          createdAt={knowledge?.created_at ?? null}
          overfitIds={knowledge?.overfit_ids}
          queuedStrategies={knowledge?.queued_strategies}
        />
      )}
    </div>
  );
}

