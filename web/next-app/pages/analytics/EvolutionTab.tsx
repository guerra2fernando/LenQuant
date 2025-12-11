/* eslint-disable */
// @ts-nocheck
import { useEffect, useState } from "react";
import useSWR from "swr";
import Link from "next/link";

import { EvolutionLeaderboardTable } from "@/components/EvolutionLeaderboardTable";
import { ExperimentStatusBadge } from "@/components/ExperimentStatusBadge";
import { FitnessScatterChart } from "@/components/FitnessScatterChart";
import { GenomeComparisonPanel } from "@/components/GenomeComparisonPanel";
import { LineageGraph } from "@/components/LineageGraph";
import { MutationQueueDrawer } from "@/components/MutationQueueDrawer";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { EvolutionTimeline } from "@/components/EvolutionTimeline";
import { EvolutionPresets } from "@/components/EvolutionPresets";
import { PostRunSummaryModal } from "@/components/PostRunSummaryModal";
import { GeneticDiversityChart } from "@/components/GeneticDiversityChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetcher, postJson } from "@/lib/api";
import { ChevronDown, ChevronUp, ExternalLink, TrendingUp, FileText } from "lucide-react";
import { useRouter } from "next/router";

export default function EvolutionTab() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("BTC/USD");
  const [interval, setInterval] = useState("1m");
  const [accounts, setAccounts] = useState(12);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  
  // New state for enhanced UX
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showDiversity, setShowDiversity] = useState(false);
  const [showPostRunModal, setShowPostRunModal] = useState(false);
  const [lastRunSummary, setLastRunSummary] = useState(null);

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

  // Mock data for new components (replace with real API calls)
  const mockGenerations = [
    { generation: 1, strategies: 15, champions: 3, avgFitness: 45.2, bestFitness: 67.8, timestamp: new Date(Date.now() - 86400000 * 3).toISOString() },
    { generation: 2, strategies: 18, champions: 4, avgFitness: 52.1, bestFitness: 72.3, timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
    { generation: 3, strategies: 22, champions: 5, avgFitness: 58.7, bestFitness: 78.9, timestamp: new Date(Date.now() - 86400000).toISOString() },
  ];

  const mockDiversity = {
    uniqueGenomes: 18,
    totalStrategies: 22,
    diversityScore: 0.72,
    mutationRate: 0.15,
    convergenceRisk: "low" as const,
  };

  const handlePresetSelect = (preset) => {
    setAccounts(preset.accounts);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Evolution Lab
          <TooltipExplainer 
            term="Evolution Lab" 
            explanation="This is where the system evolves trading strategies using a genetic algorithm. Like biological evolution, successful strategies 'reproduce' by creating variations (mutations). The best performers become champions and can create new generations of strategies. This process continuously searches for better trading approaches."
          />
        </h2>
        <p className="text-sm text-muted-foreground">Spawn strategy mutations, monitor fitness, and promote champions.</p>
      </div>

      {/* Experiment Presets */}
      <EvolutionPresets
        symbol={symbol}
        interval={interval}
        onSelectPreset={handlePresetSelect}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>
              Run Experiments
              <TooltipExplainer 
                term="Run Experiments" 
                explanation="This creates and tests new strategy variations. You specify which market (symbol), timeframe (interval), and how many test accounts to run. The system will create mutations of existing champion strategies and test them in parallel simulations to see which ones perform best."
              />
            </CardTitle>
            <CardDescription>Spawn strategy mutations, monitor fitness, and promote champions.</CardDescription>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline">
                <Link href="/evolution/autonomy">Open Autonomous Evolution Dashboard</Link>
              </Button>
            </div>
            {runMessage ? <p className="text-xs text-muted-foreground">{runMessage}</p> : null}
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <fieldset className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground" htmlFor="symbol">
                Symbol
                <TooltipExplainer 
                  term="Symbol (Evolution)" 
                  explanation="The cryptocurrency trading pair to test strategies on. For example, BTC/USD means testing Bitcoin priced in USDT. Strategies are optimized specifically for each symbol's unique price patterns."
                  size="sm"
                />
              </label>
              <Input id="symbol" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
            </fieldset>
            <fieldset className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground" htmlFor="interval">
                Interval
                <TooltipExplainer 
                  term="Interval (Evolution)" 
                  explanation="The timeframe for price data: 1m = 1 minute bars, 5m = 5 minute bars, etc. Shorter intervals are better for day trading strategies, longer intervals for swing trading. Strategies are tuned for specific intervals."
                  size="sm"
                />
              </label>
              <Input id="interval" value={interval} onChange={(event) => setInterval(event.target.value)} />
            </fieldset>
            <fieldset className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground" htmlFor="accounts">
                Accounts
                <TooltipExplainer 
                  term="Accounts (Evolution)" 
                  explanation="How many virtual trading accounts to run in parallel during the test. More accounts mean more reliable statistics (law of large numbers) but take longer to complete. 12-20 accounts is typically a good balance."
                  size="sm"
                />
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
                <TooltipExplainer 
                  term="Run Experiments Button" 
                  explanation="Click this to start a new evolution cycle. The system will take your current champion strategies, create variations (mutations), test them all in simulations, and identify which ones perform best. This process typically takes a few minutes depending on the number of accounts and strategies."
                  size="sm"
                />
              </Button>
            </div>
            {activeTaskId && (
              <div className="md:col-span-2 lg:col-span-4">
                <ProgressIndicator
                  message={`Running experiments (Task ${activeTaskId.slice(0, 8)}...)`}
                  subMessage={`Status: ${taskStatus ?? "pending"}. ${runMessage || "This may take several minutes."}`}
                  variant="indeterminate"
                />
              </div>
            )}
          </CardContent>
        </Card>
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>
                Champions
                <TooltipExplainer 
                  term="Champions" 
                  explanation="These are the best performing strategies currently in the system. Champions have proven themselves through simulations and are candidates for live trading. They also serve as 'parents' for creating new strategy variations in the evolution process."
                />
              </CardTitle>
              <CardDescription>Highest scoring genomes right now.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {champions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No champions yet.</p>
              ) : (
                champions.map((entry) => (
                  <div key={entry.strategy_id} className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{entry.strategy_id}</p>
                        <p className="text-xs text-muted-foreground">Composite {entry.composite?.toFixed(2)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/analytics?tab=strategies&id=${entry.strategy_id}`)}
                        className="h-7 w-7 p-0"
                      >
                        <TrendingUp className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                Learning Insights
                <TooltipExplainer 
                  term="Learning Insights" 
                  explanation="This shows what the meta-learning system is currently focused on. The allocator decides how much 'weight' to give each strategy when making predictions or trade decisions. Overfit alerts warn when a strategy that performed well in testing is now underperforming in practice, suggesting it was tuned too specifically to past data."
                />
              </CardTitle>
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
                      <li key={alert._id ?? alert.strategy_id} className="flex items-center justify-between">
                        <span>{alert.strategy_id} · {(alert.decay * 100).toFixed(0)}% decay</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/models/registry?search=${alert.strategy_id}`)}
                          className="h-6 w-6 p-0"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Strategy Leaderboard</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/analytics?tab=strategies')}
                  className="gap-1"
                >
                  <FileText className="h-3 w-3" />
                  View All Strategies
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <EvolutionLeaderboardTable
                entries={leaderboardEntries}
                selectedId={selectedStrategyId ?? leaderboardEntries[0]?.strategy_id}
                onSelect={setSelectedStrategyId}
              />
            </CardContent>
          </Card>
          <FitnessScatterChart points={scatterPoints} />
        </div>
        <MutationQueueDrawer items={queueItems} />
      </div>

      {/* Collapsible Advanced Sections */}
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full justify-between"
        >
          <span>Advanced Evolution Analysis</span>
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {showAdvanced && (
          <div className="space-y-6">
            <GenomeComparisonPanel strategy={selectedStrategy} runs={selectedRuns} />
            
            {/* Timeline Toggle */}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTimeline(!showTimeline)}
                className="mb-4"
              >
                {showTimeline ? "Hide" : "Show"} Evolution Timeline
              </Button>
              {showTimeline && <EvolutionTimeline generations={mockGenerations} />}
            </div>

            {/* Diversity Toggle */}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDiversity(!showDiversity)}
                className="mb-4"
              >
                {showDiversity ? "Hide" : "Show"} Genetic Diversity
              </Button>
              {showDiversity && <GeneticDiversityChart metrics={mockDiversity} />}
            </div>

            <LineageGraph nodes={lineageNodes} links={lineageLinks} />
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Queue Status
            <TooltipExplainer 
              term="Queue Status" 
              explanation="The experiment queue shows all the strategy tests waiting to run or currently running. Pending = waiting to start, Running = actively being tested, Completed = finished successfully, Failed = encountered an error during testing. This helps you monitor the system's workload and identify any issues."
            />
          </CardTitle>
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

      {/* Post-Run Summary Modal */}
      <PostRunSummaryModal
        open={showPostRunModal}
        onOpenChange={setShowPostRunModal}
        summary={lastRunSummary}
      />
    </div>
  );
}

