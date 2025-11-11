import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import useSWR from "swr";

import { EvolutionLeaderboardTable } from "@/components/EvolutionLeaderboardTable";
import { EmptyState } from "@/components/EmptyState";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { RiskGaugeCard } from "@/components/RiskGaugeCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetcher } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/utils";
import type {
  CohortListItem,
  IntradayCohort,
  IntradayCohortDetail,
  PromotionGuardRailCheck,
} from "@/types/cohorts";

const PAGE_SIZE = 5;

type CohortListResponse = {
  cohorts: CohortListItem[];
  pagination?: {
    page: number;
    page_size: number;
    total_pages: number;
    total: number;
  };
};

function formatCurrency(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "$0.00";
  }
  return `$${formatNumber(value, digits)}`;
}

function formatNumberOrDash(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return formatNumber(value, digits);
}

function describeGuardRail(check: PromotionGuardRailCheck): { current: string; threshold: string } {
  const { value, threshold } = check;
  if (threshold === undefined || threshold === null) {
    return {
      current: formatNumberOrDash(value, 2),
      threshold: "—",
    };
  }
  if (threshold <= 1.5) {
    return {
      current: value === null || value === undefined ? "—" : formatPercent(value, 2),
      threshold: formatPercent(threshold, 2),
    };
  }
  const digits = Number.isInteger(threshold) ? 0 : 2;
  return {
    current: formatNumberOrDash(value, digits),
    threshold: formatNumber(threshold, digits),
  };
}

function isDetailedAgentList(agentList: unknown): agentList is IntradayCohort["agents"] {
  if (!Array.isArray(agentList)) {
    return false;
  }
  return agentList.every((agent) => {
    if (!agent || typeof agent !== "object") {
      return false;
    }
    return "metrics" in agent && "alerts" in agent;
  });
}

export default function IntradayCohortsPage() {
  const [dateFilter, setDateFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", String(PAGE_SIZE));
    if (dateFilter) {
      params.set("date", dateFilter);
    }
    return `/api/experiments/cohorts?${params.toString()}`;
  }, [page, dateFilter]);

  const {
    data,
    error,
    isValidating,
    mutate,
  } = useSWR<CohortListResponse>(query, fetcher, {
    refreshInterval: 15000,
  });

  const cohorts: CohortListItem[] = data?.cohorts ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.total_pages ?? 1;

  useEffect(() => {
    if (!cohorts.length) {
      setSelectedCohortId(null);
      return;
    }
    if (selectedCohortId && cohorts.some((cohort) => cohort.cohort_id === selectedCohortId)) {
      return;
    }
    setSelectedCohortId(cohorts[0].cohort_id);
    setSelectedStrategyId(null);
  }, [cohorts, selectedCohortId]);

  const selectedCohort = cohorts.find((cohort) => cohort.cohort_id === selectedCohortId) ?? cohorts[0] ?? null;

  const {
    data: detailData,
    error: detailError,
    isValidating: detailValidating,
    mutate: mutateDetail,
  } = useSWR<IntradayCohortDetail>(
    selectedCohortId ? `/api/experiments/cohorts/${selectedCohortId}` : null,
    fetcher,
    { refreshInterval: 30000 },
  );

  const detail = detailData ?? null;
  const summary = detail?.summary ?? selectedCohort?.summary ?? null;
  const promotion = detail?.promotion ?? null;
  const parentSnapshot = detail?.parent ?? null;
  const alerts = detail?.cohort?.alerts ?? selectedCohort?.alerts ?? [];
  const isLoadingDetail = Boolean(selectedCohortId) && !detail && detailValidating;

  useEffect(() => {
    const agents = detail?.cohort?.agents ?? [];
    if (!agents.length) {
      return;
    }
    const hasSelected =
      selectedStrategyId !== null &&
      agents.some((agent) => agent.strategy_id === selectedStrategyId);
    if (hasSelected) {
      return;
    }
    const defaultStrategy =
      promotion?.best_candidate?.strategy_id ??
      agents[0]?.strategy_id ??
      null;
    setSelectedStrategyId(defaultStrategy ?? null);
  }, [detail?.cohort?.agents, promotion?.best_candidate?.strategy_id, selectedStrategyId]);

  const handleDateChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value || undefined;
    setDateFilter(value);
    setPage(1);
  }, []);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      mutate(),
      selectedCohortId ? mutateDetail() : Promise.resolve(),
    ]);
  }, [mutate, mutateDetail, selectedCohortId]);

  const rawAgents =
    detail?.cohort?.agents ?? selectedCohort?.agents ?? [];

  const leaderboardEntries = useMemo(() => {
    if (!Array.isArray(rawAgents) || !rawAgents.length) {
      return [];
    }

    if (isDetailedAgentList(rawAgents)) {
      return rawAgents.map((agent) => {
        const metrics = agent.metrics ?? {};
        const tags = [
          ...(agent.alerts?.length ? ["alert"] : []),
          ...(metrics.leverage_breach ? ["leverage"] : []),
        ];
        const stats = metrics as Record<string, number | undefined>;
        return {
          strategy_id: agent.strategy_id ?? agent.run_id ?? "unknown",
          roi: metrics.roi ?? 0,
          sharpe: stats.sharpe,
          max_drawdown: metrics.max_drawdown_parent,
          forecast_alignment: stats.forecast_alignment,
          composite: metrics.confidence_score,
          generation: stats.generation,
          status: metrics.leverage_breach ? "breached" : "candidate",
          tags,
        };
      });
    }

    const lightAgents = rawAgents as CohortListItem["agents"];
    return (lightAgents ?? []).map((agent) => ({
      strategy_id: agent?.strategy_id ?? agent?.run_id ?? "unknown",
      roi: agent?.roi ?? 0,
      composite: agent?.confidence_score ?? 0,
      status: "candidate",
      tags: [],
    }));
  }, [rawAgents]);

  const selectedAgent = useMemo(() => {
    if (!detail?.cohort?.agents?.length) {
      return null;
    }
    if (!selectedStrategyId) {
      return detail.cohort.agents[0] ?? null;
    }
    return (
      detail.cohort.agents.find((agent) => agent.strategy_id === selectedStrategyId) ??
      detail.cohort.agents[0] ??
      null
    );
  }, [detail?.cohort?.agents, selectedStrategyId]);

  const guardRailProgress = useMemo(() => {
    if (!promotion?.checks?.length) {
      return 0;
    }
    const passed = promotion.checks.filter((check) => check.status).length;
    return Math.round((passed / promotion.checks.length) * 100);
  }, [promotion?.checks]);

  const utilisationPct =
    summary?.bankroll_utilization_pct ??
    parentSnapshot?.utilization ??
    0;
  const bankroll = detail?.cohort?.bankroll ?? selectedCohort?.bankroll ?? 0;
  const utilisationCurrent = bankroll * (utilisationPct ?? 0);

  const leverageBreachesCount =
    promotion?.leverage_breaches?.length ??
    summary?.leverage_breaches?.length ??
    0;

  const isRefreshing = isValidating || detailValidating;
  const promotionStatusVariant: "success" | "warning" = promotion?.ready ? "success" : "warning";
  const promotionStatusLabel = promotion?.ready ? "Ready for Day-3 Promotion" : "Manual Review Required";
  const promotionAllocation = promotion ? formatCurrency(promotion.recommended_allocation) : "—";
  const cohortAlerts = (alerts ?? []).slice(0, 6);
  const showEmptyState = !selectedCohort && !isValidating;

  const handlePrev = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  const handleRowSelect = useCallback((cohortId: string) => {
    setSelectedCohortId(cohortId);
    setSelectedStrategyId(null);
  }, []);

  const handleStrategySelect = useCallback((strategyId: string) => {
    setSelectedStrategyId(strategyId);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Intraday Cohorts</h1>
          <p className="text-sm text-muted-foreground">
            Track multi-agent intraday experiments, bankroll utilisation, and Day-3 promotion readiness.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter ?? ""}
            onChange={handleDateChange}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm"
          />
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing" : "Refresh"}
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            Failed to load cohorts: {error instanceof Error ? error.message : "Unknown error"}
          </CardContent>
        </Card>
      ) : null}

      {showEmptyState ? (
        <EmptyState
          variant="data"
          title="No intraday cohorts yet"
          description="Launch the intraday cohort script or assistant command to generate a new run."
        />
      ) : null}

      {selectedCohort ? (
        <div className="grid gap-4 md:grid-cols-3">
          <RiskGaugeCard
            title="Bankroll Utilisation"
            current={utilisationCurrent}
            limit={selectedCohort.bankroll ?? 1}
            description={`Using ${formatPercent(utilisationPct ?? 0)} of $${formatNumber(bankroll ?? 0, 2)} bankroll.`}
            tone={(utilisationPct ?? 0) > 0.9 ? "warning" : "ok"}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cohort PnL</CardTitle>
              <CardDescription>Total ROI across agents in the selected cohort.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-semibold">{formatCurrency(summary?.total_pnl ?? 0, 2)}</div>
              <p className="text-sm text-muted-foreground">ROI {formatPercent(summary?.total_roi ?? 0)}</p>
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <span>
                  Best: {summary?.best_agent?.strategy_id ?? "—"} ({formatPercent(summary?.best_agent?.roi ?? 0)})
                </span>
                <span>
                  Worst: {summary?.worst_agent?.strategy_id ?? "—"} ({formatPercent(summary?.worst_agent?.roi ?? 0)})
                </span>
              </div>
            </CardContent>
          </Card>
          <ProgressIndicator
            message="Guard Rail Progress"
            variant="progress"
            progress={guardRailProgress}
            subMessage={
              promotion
                ? promotion.ready
                  ? "All guard rails satisfied. Safe to proceed."
                  : "Pending guard rails require operator review."
                : "Awaiting cohort analytics."
            }
          />
        </div>
      ) : null}

      {selectedCohort ? (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <EvolutionLeaderboardTable
              entries={leaderboardEntries}
              selectedId={selectedStrategyId}
              onSelect={handleStrategySelect}
            />
            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Promotion Guard Rails</CardTitle>
                  <CardDescription>
                    Recommended allocation {promotionAllocation} · {leverageBreachesCount} leverage alerts
                  </CardDescription>
                </div>
                <Badge variant={promotionStatusVariant}>{promotionStatusLabel}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {promotion?.checks?.length ? (
                  promotion.checks.map((check) => {
                    const { current, threshold } = describeGuardRail(check);
                    return (
                      <div
                        key={check.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 p-3"
                      >
                        <div>
                          <div className="text-sm font-medium text-foreground">{check.label}</div>
                          <div className="text-xs text-muted-foreground">
                            Observed: <span className="font-semibold text-foreground">{current}</span> · Threshold:{" "}
                            <span className="font-semibold text-foreground">{threshold}</span>
                          </div>
                        </div>
                        <Badge variant={check.status ? "success" : "destructive"}>
                          {check.status ? "Pass" : "Action Required"}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Guard rail readiness will populate once the cohort analytics are complete.
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border/50 bg-background/50 p-3 text-xs text-muted-foreground">
                  <div>Need to promote? Open the Day-3 modal from Trading once the cohort is ready.</div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={selectedCohortId ? `/trading?promo=${selectedCohortId}` : "/trading"}>
                      Open Day-3 Modal
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Parent Wallet Snapshot</CardTitle>
                <CardDescription>Drawdown and utilisation versus shared bankroll.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Bankroll</span>
                  <span className="font-medium text-foreground">{formatCurrency(bankroll, 2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Utilisation</span>
                  <span className="font-medium text-foreground">{formatPercent(utilisationPct ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Aggregate Exposure</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(parentSnapshot?.aggregate_exposure ?? 0, 2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Parent Drawdown</span>
                  <span className="font-medium text-foreground">
                    {formatPercent(promotion?.parent_drawdown_pct ?? parentSnapshot?.drawdown_pct ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Realised PnL</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(parentSnapshot?.realized_pnl ?? 0, 2)}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{selectedAgent?.strategy_id ?? "Strategy Snapshot"}</CardTitle>
                <CardDescription>
                  Allocation {formatCurrency(selectedAgent?.allocation ?? 0, 2)} · Trades{" "}
                  {selectedAgent?.metrics?.trade_count ?? 0}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">ROI</div>
                  <div className="font-semibold text-foreground">
                    {formatPercent(selectedAgent?.metrics?.roi ?? 0)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">PnL</div>
                  <div className="font-semibold text-foreground">
                    {formatCurrency(selectedAgent?.metrics?.realized_pnl ?? 0, 2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Slippage</div>
                  <div className="font-semibold text-foreground">
                    {formatPercent(
                      selectedAgent?.metrics?.avg_slippage_pct ??
                        selectedAgent?.metrics?.slippage_pct ??
                        0,
                      2,
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Drawdown</div>
                  <div className="font-semibold text-foreground">
                    {formatPercent(selectedAgent?.metrics?.max_drawdown_parent ?? 0, 2)}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Alert Feed</CardTitle>
                <CardDescription>Latest risk notifications for this cohort.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {cohortAlerts.length ? (
                  cohortAlerts.map((alert, idx) => (
                    <div key={`${alert.type ?? "alert"}-${idx}`} className="rounded-md border border-border p-3">
                      <div className="font-medium text-foreground">{alert.type?.replace(/_/g, " ") ?? "Alert"}</div>
                      <div className="text-xs text-muted-foreground">{alert.message ?? "Review required"}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No alerts recorded for this cohort.</p>
                )}
              </CardContent>
            </Card>
            {detailError ? (
              <Card>
                <CardContent className="py-3 text-sm text-destructive">
                  Failed to load cohort detail: {detailError instanceof Error ? detailError.message : "Unknown error"}
                </CardContent>
              </Card>
            ) : null}
            {isLoadingDetail ? (
              <Card>
                <CardContent className="py-3 text-sm text-muted-foreground">Loading cohort detail…</CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Recent Cohorts</CardTitle>
            <CardDescription>Click a row to view cohort details.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handlePrev} disabled={page <= 1}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages || 1}
            </span>
            <Button variant="ghost" size="sm" onClick={handleNext} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {cohorts.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">PnL</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead className="text-right">Alerts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohorts.map((cohort) => {
                  const isSelected = cohort.cohort_id === selectedCohort?.cohort_id;
                  return (
                    <TableRow
                      key={cohort.cohort_id}
                      className={isSelected ? "bg-primary/10" : "cursor-pointer"}
                      onClick={() => handleRowSelect(cohort.cohort_id)}
                    >
                      <TableCell className="font-medium text-foreground">{cohort.cohort_id}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {cohort.created_at ? new Date(cohort.created_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(cohort.summary?.total_pnl ?? 0, 2)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatPercent(cohort.summary?.total_roi ?? 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatPercent(cohort.summary?.confidence_score ?? 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm">{cohort.alerts?.length ?? 0}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              variant="data"
              title="No cohorts"
              description="Run the intraday cohort script to populate this list."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

