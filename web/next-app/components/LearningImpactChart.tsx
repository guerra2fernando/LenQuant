/* eslint-disable */
// @ts-nocheck
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, ArrowRight, Target, BarChart3 } from "lucide-react";

type LearningCycleMetrics = {
  before: {
    avg_roi: number;
    sharpe_ratio: number;
    win_rate: number;
    strategy_count: number;
  };
  after: {
    avg_roi: number;
    sharpe_ratio: number;
    win_rate: number;
    strategy_count: number;
  };
  improvements: {
    roi_change: number;
    sharpe_change: number;
    win_rate_change: number;
    strategies_added: number;
    strategies_removed: number;
  };
  cycle_date?: string;
};

type Props = {
  metrics: LearningCycleMetrics;
};

export function LearningImpactChart({ metrics }: Props) {
  const { before, after, improvements } = metrics;

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <span className="h-4 w-4">→</span>;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-gray-600";
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatChange = (value: number) => {
    const sign = value > 0 ? "+" : "";
    return `${sign}${(value * 100).toFixed(1)}%`;
  };

  const overallImprovement =
    (improvements.roi_change + improvements.sharpe_change + improvements.win_rate_change) / 3;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Learning Impact Analysis
            </CardTitle>
            <CardDescription>
              Performance comparison before and after learning cycle
            </CardDescription>
          </div>
          <Badge
            variant={overallImprovement > 0 ? "default" : "secondary"}
            className={
              overallImprovement > 0
                ? "bg-green-500 hover:bg-green-600"
                : overallImprovement < 0
                  ? "bg-red-500 hover:bg-red-600"
                  : ""
            }
          >
            {overallImprovement > 0 ? "Improved" : overallImprovement < 0 ? "Declined" : "Unchanged"}
          </Badge>
        </div>
        {metrics.cycle_date && (
          <p className="text-xs text-muted-foreground mt-1">
            Cycle completed: {new Date(metrics.cycle_date).toLocaleDateString()}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Impact Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Impact</span>
            <span className={`text-sm font-semibold ${getChangeColor(overallImprovement)}`}>
              {formatChange(overallImprovement)}
            </span>
          </div>
          <Progress
            value={Math.min(Math.abs(overallImprovement) * 100, 100)}
            className={`h-2 ${overallImprovement < 0 ? "bg-red-200" : ""}`}
          />
        </div>

        {/* Metrics Comparison */}
        <div className="space-y-4">
          {/* ROI */}
          <div className="grid grid-cols-[1fr,auto,1fr,auto] items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Before</p>
              <p className="text-lg font-semibold">{formatPercent(before.avg_roi)}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">After</p>
              <p className="text-lg font-semibold">{formatPercent(after.avg_roi)}</p>
            </div>
            <div className="flex items-center gap-1">
              {getChangeIcon(improvements.roi_change)}
              <span className={`text-sm font-medium ${getChangeColor(improvements.roi_change)}`}>
                {formatChange(improvements.roi_change)}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">Average ROI</p>

          {/* Sharpe Ratio */}
          <div className="grid grid-cols-[1fr,auto,1fr,auto] items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Before</p>
              <p className="text-lg font-semibold">{before.sharpe_ratio.toFixed(2)}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">After</p>
              <p className="text-lg font-semibold">{after.sharpe_ratio.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-1">
              {getChangeIcon(improvements.sharpe_change)}
              <span className={`text-sm font-medium ${getChangeColor(improvements.sharpe_change)}`}>
                {formatChange(improvements.sharpe_change)}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">Sharpe Ratio</p>

          {/* Win Rate */}
          <div className="grid grid-cols-[1fr,auto,1fr,auto] items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Before</p>
              <p className="text-lg font-semibold">{formatPercent(before.win_rate)}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">After</p>
              <p className="text-lg font-semibold">{formatPercent(after.win_rate)}</p>
            </div>
            <div className="flex items-center gap-1">
              {getChangeIcon(improvements.win_rate_change)}
              <span className={`text-sm font-medium ${getChangeColor(improvements.win_rate_change)}`}>
                {formatChange(improvements.win_rate_change)}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">Win Rate</p>
        </div>

        {/* Strategy Changes */}
        <div className="pt-4 border-t space-y-2">
          <p className="text-sm font-medium">Strategy Portfolio Changes</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-2xl font-bold">{before.strategy_count}</p>
              <p className="text-xs text-muted-foreground">Before</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{after.strategy_count}</p>
              <p className="text-xs text-muted-foreground">After</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-green-600">
                +{improvements.strategies_added}
              </p>
              <p className="text-xs text-muted-foreground">Added</p>
            </div>
          </div>
          {improvements.strategies_removed > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {improvements.strategies_removed} underperforming strategies removed
            </p>
          )}
        </div>

        {/* Summary */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs font-medium text-blue-900">📊 Summary</p>
          <p className="text-xs text-blue-800 mt-1">
            {overallImprovement > 0.05
              ? "Learning cycle resulted in significant improvements across key metrics. Continue with current approach."
              : overallImprovement > 0
                ? "Learning cycle showed modest improvements. Monitor performance and adjust parameters if needed."
                : "Learning cycle did not improve performance. Consider adjusting learning parameters or reviewing data quality."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

