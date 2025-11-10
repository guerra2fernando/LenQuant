/* eslint-disable */
// @ts-nocheck
import { useEffect, useState } from "react";
import useSWR from "swr";

import { EvolutionLeaderboardTable } from "@/components/EvolutionLeaderboardTable";
import { ExperimentStatusBadge } from "@/components/ExperimentStatusBadge";
import { FitnessScatterChart } from "@/components/FitnessScatterChart";
import { GenomeComparisonPanel } from "@/components/GenomeComparisonPanel";
import { LineageGraph } from "@/components/LineageGraph";
import { MutationQueueDrawer } from "@/components/MutationQueueDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetcher, postJson } from "@/lib/api";

export default function EvolutionPage() {
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [interval, setInterval] = useState("1m");
  const [accounts, setAccounts] = useState(12);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);

  const { data: leaderboardData, mutate: refreshLeaderboard } = useSWR("/api/leaderboard/today?limit=15", fetcher, {
    refreshInterval: 60000,
  });
  const { data: queueData, mutate: refreshQueue } = useSWR("/api/experiments/queue", fetcher, { refreshInterval: 15000 });
  const { data: lineageData } = useSWR("/api/strategies/lineage?limit=150", fetcher, { refreshInterval: 60000 });
  const { data: selectedStrategyData } = useSWR(
    selectedStrategyId ? `/api/strategies/${selectedStrategyId}` : null,
    fetcher,
    { refreshInterval: 30000 },
  );
  const { data: allocatorSnapshot } = useSWR("/api/learning/allocator", fetcher, { refreshInterval: 60000 });
  const { data: overfitAlerts } = useSWR("/api/learning/overfit?status=open", fetcher, { refreshInterval: 60000 });

  const leaderboardEntries = leaderboardData?.leaderboard?.top_strategies ?? [];
  const scatterPoints = leaderboardData?.leaderboard?.scatter ?? [];
  const queueItems = queueData?.queue ?? [];
  const lineageNodes = lineageData?.nodes ?? [];
  const lineageLinks = lineageData?.links ?? [];

  const selectedStrategy = selectedStrategyData?.strategy ?? (leaderboardEntries?.[0] ?? null);
  const selectedRuns = selectedStrategyData?.runs ?? [];

  const champions = leaderboardEntries.filter((entry) => entry.status === "champion");
  const allocationWeights = allocatorSnapshot?.snapshot?.weights ?? [];
  const topAllocation = allocationWeights[0];
  const openAlerts = overfitAlerts?.alerts ?? [];

  async function handleRunExperiments() {
    try {
      setIsRunning(true);
      setRunMessage(null);
      const response = await postJson("/api/experiments/run", {
        symbol,
        interval,
        accounts,
        horizon: interval,
        mutations_per_parent: 4,
        champion_limit: 5,
      });
      if (response?.mode === "queue_only") {
        const summary = response?.summary ?? {};
        const queued = summary?.queued ?? 0;
        const completed = summary?.completed?.length ?? 0;
        setRunMessage(
          summary?.message === "queue_at_capacity"
            ? "Queue already at capacity — no new runs scheduled."
            : `Queued ${queued} variants • Completed immediately: ${completed}.`,
        );
        await Promise.all([refreshQueue(), refreshLeaderboard()]);
        return;
      }

      if (response?.task_id) {
        setActiveTaskId(response.task_id);
        const initialStatus = response?.status ?? "pending";
        setTaskStatus(initialStatus);
        setRunMessage("Experiment cycle queued. Tracking progress…");
        await refreshQueue();
        return;
      }

      const summary = response?.summary ?? {};
      const queued = summary?.queued ?? 0;
      const completed = summary?.completed?.length ?? 0;
      setRunMessage(`Queued ${queued} variants • Completed immediately: ${completed}.`);
      await Promise.all([refreshQueue(), refreshLeaderboard()]);
    } catch (error) {
      console.error(error);
      alert("Failed to schedule experiments. Check console for details.");
    } finally {
      setIsRunning(false);
    }
  }

  useEffect(() => {
    if (!activeTaskId) {
      setTaskStatus(null);
      return undefined;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const pollTask = async () => {
      try {
        const data = await fetcher(`/api/experiments/tasks/${activeTaskId}`);
        if (cancelled) {
          return;
        }
        const status = data?.status ?? "pending";
        setTaskStatus(status);
        if (status === "success") {
          const summary = data?.result ?? {};
          const queued = summary?.queued ?? 0;
          const completedRuns = Array.isArray(summary?.completed) ? summary.completed.length : Number(summary?.completed ?? 0);
          const message =
            summary?.message === "queue_at_capacity"
              ? "Queue already at capacity — no new runs scheduled."
              : `Experiment cycle completed. Queued ${queued} variants • Completed ${completedRuns} runs.`;
          setRunMessage(message);
          await Promise.all([refreshQueue(), refreshLeaderboard()]);
          setActiveTaskId(null);
          return;
        }
        if (status === "failure") {
          const errorMessage = data?.error || "Experiment task failed.";
          setRunMessage(errorMessage);
          setActiveTaskId(null);
          return;
        }
        if (status === "pending" || status === "started") {
          setRunMessage(`Experiment task ${status === "started" ? "running" : "pending"}…`);
        }
        timeout = setTimeout(pollTask, 5000);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setRunMessage("Failed to fetch experiment task status. Retrying…");
          timeout = setTimeout(pollTask, 8000);
        }
      }
    };

    pollTask();

    return () => {
      cancelled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [activeTaskId, refreshLeaderboard, refreshQueue]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Evolution Lab</CardTitle>
            <CardDescription>Spawn strategy mutations, monitor fitness, and promote champions.</CardDescription>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline">
                <a href="/evolution/autonomy">Open Autonomous Evolution Dashboard</a>
              </Button>
            </div>
            {runMessage ? <p className="text-xs text-muted-foreground">{runMessage}</p> : null}
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <fieldset className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground" htmlFor="symbol">
                Symbol
              </label>
              <Input id="symbol" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
            </fieldset>
            <fieldset className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground" htmlFor="interval">
                Interval
              </label>
              <Input id="interval" value={interval} onChange={(event) => setInterval(event.target.value)} />
            </fieldset>
            <fieldset className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground" htmlFor="accounts">
                Accounts
              </label>
              <Input
                id="accounts"
                type="number"
                min={1}
                max={40}
                value={accounts}
                onChange={(event) => {
                  const next = parseInt(event.target.value, 10);
                  setAccounts(Number.isNaN(next) ? 1 : next);
                }}
              />
            </fieldset>
            <div className="flex items-end">
              <Button className="w-full" disabled={isRunning} onClick={handleRunExperiments}>
                {isRunning ? "Scheduling…" : "Run Experiments"}
              </Button>
            </div>
            {activeTaskId ? (
              <div className="md:col-span-2 lg:col-span-4 text-xs text-muted-foreground">
                Tracking task {activeTaskId.slice(0, 8)}… Status: {taskStatus ?? "pending"}
              </div>
            ) : null}
          </CardContent>
        </Card>
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Champions</CardTitle>
              <CardDescription>Highest scoring genomes right now.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {champions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No champions yet.</p>
              ) : (
                champions.map((entry) => (
                  <div key={entry.strategy_id} className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-sm font-semibold text-foreground">{entry.strategy_id}</p>
                    <p className="text-xs text-muted-foreground">Composite {entry.composite?.toFixed(2)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Learning Insights</CardTitle>
              <CardDescription>Allocator focus & open overfit alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <p className="text-xs uppercase text-muted-foreground">Top allocation</p>
                <p className="text-sm font-semibold text-foreground">
                  {topAllocation
                    ? `${topAllocation.strategy_id} • ${(topAllocation.weight * 100).toFixed(1)}%`
                    : "No allocator snapshot yet"}
                </p>
                {topAllocation ? (
                  <p className="text-xs text-muted-foreground">
                    Expected ROI {typeof topAllocation.expected_roi === "number" ? (topAllocation.expected_roi * 100).toFixed(2) : "—"}%
                  </p>
                ) : null}
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <p className="text-xs uppercase text-muted-foreground">Overfit alerts</p>
                {openAlerts.length ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {openAlerts.slice(0, 3).map((alert) => (
                      <li key={alert._id ?? alert.strategy_id}>
                        {alert.strategy_id} · {(alert.decay * 100).toFixed(0)}% decay
                      </li>
                    ))}
                    {openAlerts.length > 3 ? <li className="text-xs">+{openAlerts.length - 3} more</li> : null}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">None detected 🎉</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <EvolutionLeaderboardTable
            entries={leaderboardEntries}
            selectedId={selectedStrategyId ?? leaderboardEntries[0]?.strategy_id}
            onSelect={setSelectedStrategyId}
          />
          <FitnessScatterChart points={scatterPoints} />
        </div>
        <MutationQueueDrawer items={queueItems} />
      </div>

      <GenomeComparisonPanel strategy={selectedStrategy} runs={selectedRuns} />

      <LineageGraph nodes={lineageNodes} links={lineageLinks} />

      <Card>
        <CardHeader>
          <CardTitle>Queue Status</CardTitle>
          <CardDescription>Breakdown of queued experiments.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          {["pending", "running", "completed", "failed"].map((status) => {
            const count = queueItems.filter((item) => item.status === status).length;
            return (
              <div key={status} className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
                <ExperimentStatusBadge status={status} />
                <span>{count}</span>
              </div>
            );
          })}
          <Badge variant="outline">Total {queueItems.length}</Badge>
        </CardContent>
      </Card>
    </div>
  );
}


