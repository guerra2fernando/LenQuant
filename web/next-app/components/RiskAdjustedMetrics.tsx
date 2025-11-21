// @ts-nocheck
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, Target } from "lucide-react";
import { TooltipExplainer } from "@/components/TooltipExplainer";

interface RiskMetrics {
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  volatility: number;
  profitFactor?: number;
}

interface RiskAdjustedMetricsProps {
  metrics: Partial<RiskMetrics>;
}

export function RiskAdjustedMetrics({ metrics }: RiskAdjustedMetricsProps) {
  const {
    sharpe = 0,
    sortino = 0,
    calmar = 0,
    maxDrawdown = 0,
    volatility = 0,
    profitFactor = 0,
  } = metrics;

  // Calculate ratings
  const getSharpeRating = (s: number) => {
    if (s > 2) return { label: "Excellent", color: "success", icon: TrendingUp };
    if (s > 1.5) return { label: "Very Good", color: "success", icon: TrendingUp };
    if (s > 1) return { label: "Good", color: "default", icon: Activity };
    if (s > 0.5) return { label: "Fair", color: "secondary", icon: Activity };
    return { label: "Poor", color: "destructive", icon: TrendingDown };
  };

  const getDrawdownRating = (dd: number) => {
    const ddPercent = Math.abs(dd * 100);
    if (ddPercent < 10) return { label: "Excellent", color: "success" };
    if (ddPercent < 20) return { label: "Good", color: "default" };
    if (ddPercent < 30) return { label: "Moderate", color: "secondary" };
    return { label: "High Risk", color: "destructive" };
  };

  const sharpeRating = getSharpeRating(sharpe);
  const drawdownRating = getDrawdownRating(maxDrawdown);
  const SharpeIcon = sharpeRating.icon;

  // Overall risk score (0-100)
  const riskScore = Math.min(
    100,
    Math.max(
      0,
      (sharpe / 3) * 40 + // Sharpe contributes 40%
      (1 - Math.abs(maxDrawdown)) * 30 + // Drawdown contributes 30%
      Math.min(profitFactor / 3, 1) * 30 // Profit factor contributes 30%
    ) * 100
  );

  return (
    <div className="space-y-4">
      {/* Overall Risk Score */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground">Overall Risk Score</h4>
            <p className="mt-1 text-3xl font-bold">{riskScore.toFixed(0)}/100</p>
          </div>
          <div className="relative h-24 w-24">
            <svg className="h-24 w-24 -rotate-90 transform">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-muted"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - riskScore / 100)}`}
                className={
                  riskScore >= 70
                    ? "text-green-500"
                    : riskScore >= 50
                    ? "text-blue-500"
                    : riskScore >= 30
                    ? "text-yellow-500"
                    : "text-red-500"
                }
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Target className="h-8 w-8 text-primary" />
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Based on risk-adjusted returns, drawdown control, and profit consistency
        </p>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                Sharpe Ratio
                <TooltipExplainer
                  term="Sharpe Ratio"
                  explanation="Measures return relative to risk. Higher is better. Above 1.5 is excellent."
                  size="sm"
                />
              </p>
              <p className="mt-1 text-xl font-semibold">{sharpe.toFixed(2)}</p>
              <Badge variant={sharpeRating.color as any} className="mt-1 text-xs">
                <SharpeIcon className="mr-1 h-3 w-3" />
                {sharpeRating.label}
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                Max Drawdown
                <TooltipExplainer
                  term="Max Drawdown"
                  explanation="Largest peak-to-trough decline. Lower is better. Below 20% is good."
                  size="sm"
                />
              </p>
              <p className="mt-1 text-xl font-semibold">{(Math.abs(maxDrawdown) * 100).toFixed(1)}%</p>
              <Badge variant={drawdownRating.color as any} className="mt-1 text-xs">
                {drawdownRating.label}
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                Sortino Ratio
                <TooltipExplainer
                  term="Sortino Ratio"
                  explanation="Like Sharpe but only penalizes downside volatility. Higher is better."
                  size="sm"
                />
              </p>
              <p className="mt-1 text-xl font-semibold">{sortino.toFixed(2)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                Profit Factor
                <TooltipExplainer
                  term="Profit Factor"
                  explanation="Ratio of gross profits to gross losses. Above 1.5 is good."
                  size="sm"
                />
              </p>
              <p className="mt-1 text-xl font-semibold">{profitFactor.toFixed(2)}</p>
              <Badge
                variant={profitFactor > 1.5 ? "success" : profitFactor > 1 ? "default" : "destructive"}
                className="mt-1 text-xs"
              >
                {profitFactor > 1.5 ? "Excellent" : profitFactor > 1 ? "Profitable" : "Unprofitable"}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Volatility Gauge */}
      <Card className="p-4">
        <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
          Volatility
          <TooltipExplainer
            term="Volatility"
            explanation="Measure of price variation. Lower volatility means more stable returns."
            size="sm"
          />
        </h4>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all ${
                  volatility < 0.15
                    ? "bg-green-500"
                    : volatility < 0.25
                    ? "bg-blue-500"
                    : volatility < 0.35
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${Math.min(volatility * 200, 100)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>
          <p className="text-lg font-semibold">{(volatility * 100).toFixed(1)}%</p>
        </div>
      </Card>

      {/* Risk Assessment Summary */}
      <Card className="border-blue-500/50 bg-blue-500/5 p-4">
        <h4 className="mb-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
          Risk Assessment
        </h4>
        <p className="text-xs text-muted-foreground">
          {riskScore >= 70
            ? "This strategy demonstrates excellent risk management with strong risk-adjusted returns and controlled drawdowns. Suitable for consistent performance."
            : riskScore >= 50
            ? "This strategy shows good risk management but has room for improvement. Consider tightening stop-losses or improving signal quality."
            : riskScore >= 30
            ? "This strategy has moderate risk. Drawdowns or volatility may be high. Test thoroughly before deploying with real capital."
            : "This strategy exhibits high risk. Poor risk-adjusted returns and/or large drawdowns detected. Requires significant improvements before use."}
        </p>
      </Card>
    </div>
  );
}

