/* eslint-disable */
// @ts-nocheck
import { useMemo } from "react";
import { TrendingUp, TrendingDown, Activity, Gauge, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TooltipExplainer } from "@/components/TooltipExplainer";

type RegimeFeatures = {
  atr: number;
  atr_pct: number;
  adx: number;
  bb_width: number;
  ma_slope_short: number;
  ma_slope_long: number;
  volatility_std: number;
};

type MarketRegimeData = {
  symbol: string;
  timestamp: string;
  trend_regime: string;
  volatility_regime: string;
  confidence: number;
  features: RegimeFeatures;
};

type MacroRegimeCardProps = {
  symbol?: string;
  interval?: string;
  regimeData?: MarketRegimeData;
  isLoading?: boolean;
  compact?: boolean;
};

const TREND_COLORS = {
  TRENDING_UP: "bg-green-500",
  TRENDING_DOWN: "bg-red-500",
  SIDEWAYS: "bg-amber-500",
  UNDEFINED: "bg-gray-500",
};

const TREND_TEXT_COLORS = {
  TRENDING_UP: "text-green-600 dark:text-green-400",
  TRENDING_DOWN: "text-red-600 dark:text-red-400",
  SIDEWAYS: "text-amber-600 dark:text-amber-400",
  UNDEFINED: "text-gray-600 dark:text-gray-400",
};

const VOLATILITY_COLORS = {
  HIGH_VOLATILITY: "bg-red-500",
  LOW_VOLATILITY: "bg-green-500",
  NORMAL_VOLATILITY: "bg-blue-500",
  UNDEFINED: "bg-gray-500",
};

const TREND_LABELS = {
  TRENDING_UP: "Trending Up",
  TRENDING_DOWN: "Trending Down",
  SIDEWAYS: "Sideways",
  UNDEFINED: "Unknown",
};

const VOLATILITY_LABELS = {
  HIGH_VOLATILITY: "High Volatility",
  LOW_VOLATILITY: "Low Volatility",
  NORMAL_VOLATILITY: "Normal Volatility",
  UNDEFINED: "Unknown",
};

function getTrendIcon(trend: string) {
  switch (trend) {
    case "TRENDING_UP":
      return TrendingUp;
    case "TRENDING_DOWN":
      return TrendingDown;
    case "SIDEWAYS":
      return Activity;
    default:
      return AlertCircle;
  }
}

function getTrendExplanation(trend: string, volatility: string): string {
  const trendPart = 
    trend === "TRENDING_UP" ? "prices are rising steadily" :
    trend === "TRENDING_DOWN" ? "prices are falling" :
    trend === "SIDEWAYS" ? "prices are moving within a range" :
    "the trend is unclear";

  const volPart = 
    volatility === "HIGH_VOLATILITY" ? "with large price swings" :
    volatility === "LOW_VOLATILITY" ? "with small price movements" :
    volatility === "NORMAL_VOLATILITY" ? "with moderate price movements" :
    "with unclear volatility";

  return `Currently, ${trendPart} ${volPart}. The system adjusts position sizes based on these conditions to manage risk.`;
}

function getRiskAdjustment(trend: string, volatility: string): string {
  // Based on the multipliers from Phase 3
  if (volatility === "HIGH_VOLATILITY") {
    return "Reduced to 50% (High Risk)";
  }
  if (trend === "TRENDING_UP" && volatility === "LOW_VOLATILITY") {
    return "Increased to 120% (Favorable)";
  }
  if (trend === "TRENDING_DOWN") {
    return "Reduced to 60% (Caution)";
  }
  if (trend === "SIDEWAYS") {
    return "Reduced to 80% (Range-bound)";
  }
  if (volatility === "LOW_VOLATILITY") {
    return "Increased to 120% (Stable)";
  }
  if (trend === "TRENDING_UP") {
    return "Increased to 130% (Bullish)";
  }
  return "Normal (100%)";
}

export function MacroRegimeCard({
  symbol = "BTC/USD",
  interval = "1h",
  regimeData,
  isLoading = false,
  compact = false,
}: MacroRegimeCardProps) {
  const trend = regimeData?.trend_regime ?? "UNDEFINED";
  const volatility = regimeData?.volatility_regime ?? "UNDEFINED";
  const confidence = regimeData?.confidence ?? 0;
  
  const TrendIcon = getTrendIcon(trend);
  const explanation = getTrendExplanation(trend, volatility);
  const riskAdjustment = getRiskAdjustment(trend, volatility);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Market Regime
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading regime data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!regimeData || trend === "UNDEFINED") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Market Regime
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No regime data available for {symbol} at {interval}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    // Compact version for dashboard
    return (
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <TrendIcon className={`h-4 w-4 ${TREND_TEXT_COLORS[trend]}`} />
              <p className="text-xs font-medium text-muted-foreground">Market Regime</p>
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{TREND_LABELS[trend]}</p>
          </div>
          <Badge 
            variant="outline" 
            className={`${TREND_COLORS[trend]} border-0 text-white`}
          >
            {VOLATILITY_LABELS[volatility]}
          </Badge>
        </div>
        <div className="mt-2">
          <Progress value={confidence * 100} className="h-1" />
          <p className="mt-1 text-xs text-muted-foreground">
            Confidence: {(confidence * 100).toFixed(0)}%
          </p>
        </div>
      </div>
    );
  }

  // Full card version
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          <CardTitle>
            Market Regime
            <TooltipExplainer
              term="Market Regime"
              explanation="The market regime tells you what kind of market condition we're in right now. The system uses this to automatically adjust how much it's willing to risk on each trade. For example, in high volatility markets, it reduces position sizes to protect against large swings."
            />
          </CardTitle>
        </div>
        <CardDescription>
          Current market classification for {symbol} ({interval})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trend Regime */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendIcon className={`h-5 w-5 ${TREND_TEXT_COLORS[trend]}`} />
              <span className="text-sm font-medium">Trend</span>
            </div>
            <Badge className={`${TREND_COLORS[trend]} border-0 text-white`}>
              {TREND_LABELS[trend]}
            </Badge>
          </div>
        </div>

        {/* Volatility Regime */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Volatility</span>
            </div>
            <Badge 
              variant="outline" 
              className={`${VOLATILITY_COLORS[volatility]} border-0 text-white`}
            >
              {VOLATILITY_LABELS[volatility]}
            </Badge>
          </div>
        </div>

        {/* Confidence Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Confidence</span>
            <span className="text-sm text-muted-foreground">
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
          <Progress value={confidence * 100} className="h-2" />
        </div>

        {/* Risk Adjustment */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">Position Size Adjustment</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{riskAdjustment}</p>
        </div>

        {/* Explanation */}
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
          <p className="text-xs text-foreground/80">{explanation}</p>
        </div>

        {/* Last Updated */}
        {regimeData.timestamp && (
          <p className="text-xs text-muted-foreground">
            Updated: {new Date(regimeData.timestamp).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

