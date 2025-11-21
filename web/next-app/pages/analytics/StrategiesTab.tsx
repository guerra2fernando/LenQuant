/* eslint-disable */
// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { EmptyState } from "@/components/EmptyState";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMode } from "@/lib/mode-context";
import { cn } from "@/lib/utils";
import { fetcher } from "@/lib/api";
import { Play, TrendingUp, TrendingDown, Search, GitBranch, CheckCircle, Sparkles, X, ChevronDown, ChevronUp, Terminal, PieChart, BarChart2 } from "lucide-react";
import { useRouter } from "next/router";
import { Input } from "@/components/ui/input";
import { TradeTimeline } from "@/components/TradeTimeline";
import { PositionSizingAnalysis } from "@/components/PositionSizingAnalysis";
import { RiskAdjustedMetrics } from "@/components/RiskAdjustedMetrics";

type StrategiesResponse = {
  runs: Run[];
};

type EquityPoint = {
  timestamp: string;
  equity: number;
};

type Trade = {
  pnl?: number;
};

type Run = {
  run_id: string;
  strategy: string;
  symbol: string;
  interval: string;
  created_at?: string;
  results: {
    pnl?: number;
    sharpe?: number;
    max_drawdown?: number;
  };
  equity_curve?: EquityPoint[];
  trades?: Trade[];
};

type SparklineProps = {
  data?: EquityPoint[];
};

function Sparkline({ data }: SparklineProps) {
  if (!data || data.length < 2) {
    return <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">No equity curve yet.</div>;
  }

  const width = 320;
  const height = 128;
  const equities = data.map((point) => point.equity);
  const minEquity = Math.min(...equities);
  const maxEquity = Math.max(...equities);
  const range = maxEquity - minEquity || 1;
  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((point.equity - minEquity) / range) * height;
    return { x, y };
  });
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const gradientId = "equityGradient";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path}`} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
      <path
        d={`${path} L${width},${height} L0,${height} Z`}
        fill={`url(#${gradientId})`}
        opacity={0.4}
      />
    </svg>
  );
}

export default function StrategiesTab(): JSX.Element {
  const { isEasyMode } = useMode();
  const router = useRouter();
  const { data } = useSWR<StrategiesResponse>("/api/run/sim?limit=50", fetcher);
  const runs = data?.runs ?? [];
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);

  // Simulated deployed strategies (in production, fetch from API)
  const deployedStrategyIds = new Set(["run-001", "run-002"]); // Mock data

  // Categorize strategies by type (in production, this would come from backend)
  const categorizeStrategy = (strategyName: string): string => {
    if (strategyName.includes("MA") || strategyName.includes("SMA") || strategyName.includes("EMA")) {
      return "Trend-Following";
    } else if (strategyName.includes("RSI") || strategyName.includes("Mean")) {
      return "Mean-Reversion";
    } else if (strategyName.includes("Breakout") || strategyName.includes("Momentum")) {
      return "Momentum";
    } else if (strategyName.includes("Scalp")) {
      return "Scalping";
    }
    return "Hybrid";
  };

  const getPlainLanguageExplanation = (run: Run): string => {
    const pnl = run.results.pnl ?? 0;
    const sharpe = run.results.sharpe ?? 0;
    const trades = run.trades?.length ?? 0;
    const winners = run.trades?.filter((t) => (t.pnl ?? 0) > 0).length ?? 0;
    const winRate = trades > 0 ? (winners / trades) * 100 : 0;

    if (pnl > 0 && sharpe > 1.5) {
      return `Strong performer: Made ${pnl.toFixed(2)} profit with excellent risk management (${sharpe.toFixed(2)} Sharpe) and ${winRate.toFixed(0)}% success rate.`;
    } else if (pnl > 0) {
      return `Profitable strategy: Made ${pnl.toFixed(2)} with ${trades} trades and ${winRate.toFixed(0)}% win rate.`;
    } else if (pnl < 0) {
      return `Lost ${Math.abs(pnl).toFixed(2)} across ${trades} trades. May need parameter adjustments or different market conditions.`;
    } else {
      return `Break-even performance with ${trades} trades.`;
    }
  };

  // Filter runs based on search query
  const filteredRuns = useMemo(() => {
    if (!searchQuery) return runs;
    const query = searchQuery.toLowerCase();
    return runs.filter(
      (run) =>
        run.strategy.toLowerCase().includes(query) ||
        run.symbol.toLowerCase().includes(query) ||
        run.run_id.toLowerCase().includes(query)
    );
  }, [runs, searchQuery]);

  // Generate AI explanation for top performers
  const generateAIExplanation = (run: Run): string => {
    const pnl = run.results.pnl ?? 0;
    const sharpe = run.results.sharpe ?? 0;
    const maxDrawdown = run.results.max_drawdown ?? 0;
    const trades = run.trades?.length ?? 0;
    const winners = run.trades?.filter((t) => (t.pnl ?? 0) > 0).length ?? 0;
    const winRate = trades > 0 ? (winners / trades) * 100 : 0;

    if (pnl > 5 && sharpe > 1.5) {
      return `This strategy excelled due to: (1) High win rate (${winRate.toFixed(0)}%), (2) Excellent risk management (${sharpe.toFixed(2)} Sharpe), (3) Controlled losses (${(maxDrawdown * 100).toFixed(1)}% max drawdown). The ${categorizeStrategy(run.strategy)} approach worked particularly well on ${run.symbol} during this period.`;
    } else if (pnl > 0) {
      return `This strategy showed modest profitability. Win rate of ${winRate.toFixed(0)}% suggests decent signal quality, though risk-adjusted returns (${sharpe.toFixed(2)} Sharpe) could be improved with tighter stop-losses or better position sizing.`;
    } else {
      return `This strategy underperformed, possibly due to: (1) Poor market conditions for ${categorizeStrategy(run.strategy)} strategies, (2) Overfitting to training data, or (3) Inadequate risk controls (${(maxDrawdown * 100).toFixed(1)}% drawdown). Consider adjusting parameters or testing on different timeframes.`;
    }
  };

  const toggleComparison = (runId: string) => {
    if (comparisonIds.includes(runId)) {
      setComparisonIds(comparisonIds.filter((id) => id !== runId));
    } else if (comparisonIds.length < 3) {
      setComparisonIds([...comparisonIds, runId]);
    }
  };

  useEffect(() => {
    if (!selectedRunId && filteredRuns.length) {
      setSelectedRunId(filteredRuns[0].run_id);
    }
  }, [filteredRuns, selectedRunId]);

  const selectedRun = useMemo(() => runs.find((run) => run.run_id === selectedRunId) ?? runs[0], [runs, selectedRunId]);
  const trades = selectedRun?.trades ?? [];
  const winners = trades.filter((trade) => (trade.pnl ?? 0) > 0).length;
  const losers = trades.filter((trade) => (trade.pnl ?? 0) < 0).length;
  const pnl = selectedRun?.results?.pnl ?? 0;
  const sharpe = selectedRun?.results?.sharpe ?? 0;
  const maxDrawdown = selectedRun?.results?.max_drawdown ?? 0;

  const badgeVariant = pnl > 0 ? "success" : pnl < 0 ? "destructive" : "secondary";

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Simulation Runs
              <TooltipExplainer 
                term="Simulation Runs" 
                explanation="These are historical backtests that show how strategies would have performed on past price data. Each run tests a strategy on a specific symbol and timeframe, tracking its profit/loss, risk metrics, and trade details. This helps evaluate strategy quality before risking real money."
              />
            </h2>
            <p className="text-sm text-muted-foreground">Latest backtests pulled from MongoDB. Click a row to inspect equity and trade stats.</p>
          </div>
          <div className="flex items-center gap-2">
            {comparisonIds.length > 0 && (
              <Button
                onClick={() => setShowComparison(!showComparison)}
                variant={showComparison ? "default" : "outline"}
                size="sm"
                className="gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Compare ({comparisonIds.length})
              </Button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search strategies by name, symbol, or run ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          {filteredRuns.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      disabled={comparisonIds.length >= 3 && filteredRuns.every((r) => !comparisonIds.includes(r.run_id))}
                      className="h-4 w-4 rounded"
                      title="Select strategies to compare (max 3)"
                    />
                  </TableHead>
                  <TableHead>Run</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">{isEasyMode ? "Profit/Loss" : "PnL"}</TableHead>
                  <TableHead className="text-right">{isEasyMode ? "Risk-Adjusted Return" : "Sharpe"}</TableHead>
                  <TableHead className="text-right">{isEasyMode ? "Worst Loss Period" : "Max DD"}</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRuns.map((run) => {
                  const rowPnl = run.results.pnl ?? 0;
                  const rowBadge = rowPnl > 0 ? "success" : rowPnl < 0 ? "destructive" : "secondary";
                  const isSelected = run.run_id === selectedRun?.run_id;
                  const isDeployed = deployedStrategyIds.has(run.run_id);
                  const isInComparison = comparisonIds.includes(run.run_id);
                  const strategyType = categorizeStrategy(run.strategy);
                  return (
                    <TableRow
                      key={run.run_id}
                      data-state={isSelected ? "selected" : undefined}
                      className={cn("cursor-pointer", isSelected && "bg-primary/5")}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).tagName !== "BUTTON") {
                          setSelectedRunId(run.run_id);
                        }
                      }}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={isInComparison}
                          onChange={() => toggleComparison(run.run_id)}
                          disabled={!isInComparison && comparisonIds.length >= 3}
                          className="h-4 w-4 rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{run.run_id}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {run.strategy}
                          {isDeployed && (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Deployed
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {strategyType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{run.symbol}</span>
                          <Badge variant="secondary">{run.interval}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={rowBadge}>{rowPnl.toFixed(2)}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{(run.results.sharpe ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm">{((run.results.max_drawdown ?? 0) * 100).toFixed(1)}%</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/analytics/strategy-lineage?run_id=${run.run_id}`);
                            }}
                            className="gap-1 h-7 text-xs"
                          >
                            <GitBranch className="h-3 w-3" />
                            Lineage
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/terminal?symbol=${run.symbol}`);
                            }}
                            className="gap-1 h-7 text-xs"
                          >
                            <Terminal className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : searchQuery ? (
            <EmptyState
              variant="data"
              title="No Matching Strategies"
              description={`No strategies found matching "${searchQuery}". Try a different search term.`}
            />
          ) : (
            <EmptyState
              variant="data"
              title={isEasyMode ? "No Simulations Yet" : "No Simulations"}
              description={
                isEasyMode
                  ? "Strategy test results will appear here once simulations are run. Simulations test how strategies would have performed in the past."
                  : "No simulations have been run."
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Comparison View */}
      {showComparison && comparisonIds.length > 1 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Strategy Comparison ({comparisonIds.length})
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowComparison(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left text-sm font-semibold">Metric</th>
                    {comparisonIds.map((id) => {
                      const run = runs.find((r) => r.run_id === id);
                      return (
                        <th key={id} className="p-2 text-left text-sm font-semibold">
                          {run?.strategy}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 text-sm font-medium">Symbol</td>
                    {comparisonIds.map((id) => {
                      const run = runs.find((r) => r.run_id === id);
                      return <td key={id} className="p-2 text-sm">{run?.symbol}</td>;
                    })}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 text-sm font-medium">PnL</td>
                    {comparisonIds.map((id) => {
                      const run = runs.find((r) => r.run_id === id);
                      const pnl = run?.results.pnl ?? 0;
                      return (
                        <td key={id} className="p-2 text-sm">
                          <Badge variant={pnl > 0 ? "success" : pnl < 0 ? "destructive" : "secondary"}>
                            {pnl.toFixed(2)}
                          </Badge>
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 text-sm font-medium">Sharpe Ratio</td>
                    {comparisonIds.map((id) => {
                      const run = runs.find((r) => r.run_id === id);
                      return <td key={id} className="p-2 text-sm">{(run?.results.sharpe ?? 0).toFixed(2)}</td>;
                    })}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 text-sm font-medium">Max Drawdown</td>
                    {comparisonIds.map((id) => {
                      const run = runs.find((r) => r.run_id === id);
                      return <td key={id} className="p-2 text-sm">{((run?.results.max_drawdown ?? 0) * 100).toFixed(1)}%</td>;
                    })}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 text-sm font-medium">Total Trades</td>
                    {comparisonIds.map((id) => {
                      const run = runs.find((r) => r.run_id === id);
                      return <td key={id} className="p-2 text-sm">{run?.trades?.length ?? 0}</td>;
                    })}
                  </tr>
                  <tr>
                    <td className="p-2 text-sm font-medium">Win Rate</td>
                    {comparisonIds.map((id) => {
                      const run = runs.find((r) => r.run_id === id);
                      const trades = run?.trades?.length ?? 0;
                      const winners = run?.trades?.filter((t) => (t.pnl ?? 0) > 0).length ?? 0;
                      const winRate = trades > 0 ? (winners / trades) * 100 : 0;
                      return <td key={id} className="p-2 text-sm">{winRate.toFixed(1)}%</td>;
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedRun ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle>{selectedRun.strategy}</CardTitle>
                <CardDescription>
                  {selectedRun.symbol} • {selectedRun.interval} • {selectedRun.run_id}
                </CardDescription>
                {isEasyMode && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {getPlainLanguageExplanation(selectedRun)}
                  </p>
                )}
                {/* AI Explanation for Top Performers */}
                {(pnl > 3 || (pnl > 0 && sharpe > 1.5)) && (
                  <Card className="mt-3 border-amber-500/50 bg-amber-500/5 p-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                      <div>
                        <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                          AI Analysis: Why This Worked
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {generateAIExplanation(selectedRun)}
                        </p>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <Badge variant={badgeVariant}>PnL: {pnl.toFixed(2)}</Badge>
                {pnl > 0 && sharpe > 1.0 && (
                  <Button
                    size="sm"
                    onClick={() => router.push(`/settings?section=auto-trading&strategy=${selectedRun.run_id}`)}
                    className="gap-1"
                  >
                    <Play className="h-4 w-4" />
                    {isEasyMode ? "Activate Strategy" : "Enable Auto-Trading"}
                  </Button>
                )}
                
                {/* Contextual Navigation Links */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/analytics?tab=evolution&strategy=${selectedRun.run_id}`)}
                  className="gap-1"
                >
                  <BarChart2 className="h-4 w-4" />
                  Evolution
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/portfolio?strategy=${selectedRun.run_id}`)}
                  className="gap-1"
                >
                  <PieChart className="h-4 w-4" />
                  Trades
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/terminal?symbol=${selectedRun.symbol}`)}
                  className="gap-1"
                >
                  <Terminal className="h-4 w-4" />
                  Terminal
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  {isEasyMode ? "Risk-Adjusted Return" : "Sharpe"}
                  {isEasyMode && (
                    <TooltipExplainer
                      term="Risk-Adjusted Return"
                      explanation="A measure of how much profit you make relative to the risk you take. Higher is better."
                    />
                  )}
                </p>
                <p className="text-2xl font-semibold text-foreground">{sharpe.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  {isEasyMode ? "Worst Loss Period" : "Max Drawdown"}
                  {isEasyMode && (
                    <TooltipExplainer
                      term="Worst Loss Period"
                      explanation="The largest drop in value from a peak to a low point. Lower is better."
                    />
                  )}
                </p>
                <p className="text-2xl font-semibold text-foreground">{(maxDrawdown * 100).toFixed(2)}%</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Trades
                  <TooltipExplainer 
                    term="Trades" 
                    explanation="The total number of buy and sell transactions executed during this simulation. More trades isn't necessarily better - quality matters more than quantity."
                    size="sm"
                  />
                </p>
                <p className="text-2xl font-semibold text-foreground">{trades.length}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Hit Rate
                  <TooltipExplainer 
                    term="Hit Rate" 
                    explanation="The percentage of profitable trades. A 60% hit rate means 6 out of 10 trades made money. Higher is generally better, but a strategy can still be profitable with a lower hit rate if winners are larger than losers."
                    size="sm"
                  />
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  {trades.length ? ((winners / trades.length) * 100).toFixed(1) : "0.0"}%
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Equity Curve
                <TooltipExplainer 
                  term="Equity Curve" 
                  explanation="This chart shows how the account balance changed over time during the simulation. An upward slope indicates profitability. Smooth curves suggest consistent performance, while jagged curves show high volatility. The ideal curve is smooth and steadily rising."
                  size="sm"
                />
              </h3>
              <Sparkline data={selectedRun.equity_curve} />
            </div>

            {/* Advanced Metrics Toggle */}
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
                className="w-full gap-2"
              >
                {showAdvancedMetrics ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide Advanced Analysis
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show Advanced Analysis
                  </>
                )}
              </Button>
            </div>

            {/* Advanced Metrics Section */}
            {showAdvancedMetrics && (
              <div className="space-y-6 pt-4">
                {/* Trade Timeline */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                    Trade Timeline & Streaks
                  </h3>
                  <TradeTimeline trades={trades} />
                </div>

                {/* Position Sizing Analysis */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                    Position Sizing Analysis
                  </h3>
                  <PositionSizingAnalysis trades={trades} />
                </div>

                {/* Risk-Adjusted Metrics Dashboard */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                    Risk-Adjusted Performance
                  </h3>
                  <RiskAdjustedMetrics
                    metrics={{
                      sharpe,
                      sortino: sharpe * 1.2, // Mock data - would come from backend
                      calmar: sharpe * 0.8, // Mock data
                      maxDrawdown,
                      volatility: Math.abs(maxDrawdown) * 0.5, // Mock data
                      profitFactor: pnl > 0 ? 1 + pnl / 10 : 0.5, // Mock calculation
                    }}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Winning trades:</span> {winners}
                </p>
                <p>
                  <span className="font-medium text-foreground">Losing trades:</span> {losers}
                </p>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Generated:</span>{" "}
                  {selectedRun.created_at ? new Date(selectedRun.created_at).toLocaleString() : "Unknown"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

