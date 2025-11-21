/* eslint-disable */
// @ts-nocheck
import { useMemo } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { SymbolDisplay } from "@/components/CryptoSelector";
import { TrendingUp, TrendingDown, Sparkles, AlertTriangle } from "lucide-react";
import { fetcher } from "@/lib/api";
import { useRouter } from "next/router";
import { useMode } from "@/lib/mode-context";

type Forecast = {
  symbol: string;
  pred_return?: number;
  confidence?: number;
  horizon: string;
};

type Strategy = {
  strategy_id: string;
  weight: number;
  expected_roi?: number;
};

type Opportunity = {
  type: 'forecast' | 'strategy' | 'alert';
  title: string;
  description: string;
  action: string;
  actionUrl: string;
  icon: any;
  variant: 'default' | 'success' | 'warning';
  data?: any;
};

export function OpportunitiesRightNow() {
  const { isEasyMode } = useMode();
  const router = useRouter();

  const { data: forecastData } = useSWR("/api/forecast/batch?limit=20", fetcher, {
    refreshInterval: 20_000,
  });

  const { data: allocatorData } = useSWR("/api/learning/allocator", fetcher, {
    refreshInterval: 60_000,
  });

  const { data: portfolioData } = useSWR("/api/trading/portfolio/summary/cached", fetcher, {
    refreshInterval: 15_000,
  });

  const opportunities: Opportunity[] = useMemo(() => {
    const opps: Opportunity[] = [];

    // High-confidence forecasts
    const forecasts = (forecastData?.forecasts || []) as Forecast[];
    const highConfForecasts = forecasts.filter(
      (f) => f.confidence && f.confidence > 0.8 && f.pred_return && Math.abs(f.pred_return) > 0.03
    );

    highConfForecasts.slice(0, 2).forEach((forecast) => {
      const direction = forecast.pred_return! >= 0 ? 'up' : 'down';
      const action = forecast.pred_return! >= 0 ? 'buy' : 'sell';
      opps.push({
        type: 'forecast',
        title: `${isEasyMode ? 'Strong Signal' : 'High-Confidence Forecast'}: ${forecast.symbol}`,
        description: `${isEasyMode ? 'Expected to go' : 'Predicted to move'} ${direction} by ${(Math.abs(forecast.pred_return!) * 100).toFixed(2)}% with ${((forecast.confidence || 0) * 100).toFixed(0)}% confidence (${forecast.horizon})`,
        action: isEasyMode ? 'Trade Now' : 'Execute Trade',
        actionUrl: `/terminal?symbol=${encodeURIComponent(forecast.symbol)}&action=${action}`,
        icon: forecast.pred_return! >= 0 ? TrendingUp : TrendingDown,
        variant: 'success',
        data: forecast,
      });
    });

    // Top performing strategies
    const strategies = (allocatorData?.snapshot?.weights || []) as Strategy[];
    const topStrategy = strategies.sort((a, b) => (b.expected_roi || 0) - (a.expected_roi || 0))[0];
    
    if (topStrategy && topStrategy.expected_roi && topStrategy.expected_roi > 0.05) {
      opps.push({
        type: 'strategy',
        title: `${isEasyMode ? 'Top Performing Strategy' : 'High-ROI Strategy Available'}`,
        description: `Strategy ${topStrategy.strategy_id} has ${(topStrategy.expected_roi * 100).toFixed(2)}% expected return with ${(topStrategy.weight * 100).toFixed(1)}% allocation`,
        action: isEasyMode ? 'Activate Strategy' : 'Enable Auto-Trading',
        actionUrl: `/settings?section=auto-trading&strategy=${topStrategy.strategy_id}`,
        icon: Sparkles,
        variant: 'default',
        data: topStrategy,
      });
    }

    // Portfolio profit-taking opportunity
    const portfolio = portfolioData;
    if (portfolio?.paper_trading) {
      const positions = portfolio.paper_trading.positions || [];
      const profitablePositions = positions.filter((p) => p.unrealized_pnl && p.unrealized_pnl > 0);
      const totalPnl = profitablePositions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0);
      const totalValue = portfolio.paper_trading.total_value || 1;
      const pnlPercent = (totalPnl / totalValue) * 100;

      if (pnlPercent > 5) {
        opps.push({
          type: 'alert',
          title: isEasyMode ? 'Consider Taking Profits' : 'Profit-Taking Opportunity',
          description: `Portfolio is up ${pnlPercent.toFixed(2)}%. ${profitablePositions.length} position${profitablePositions.length > 1 ? 's' : ''} showing profit.`,
          action: isEasyMode ? 'Review Portfolio' : 'View Positions',
          actionUrl: '/portfolio',
          icon: AlertTriangle,
          variant: 'warning',
          data: { pnlPercent, count: profitablePositions.length },
        });
      }
    }

    return opps.slice(0, 3); // Show top 3 opportunities
  }, [forecastData, allocatorData, portfolioData, isEasyMode]);

  if (opportunities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {isEasyMode ? 'Opportunities' : 'Opportunities Right Now'}
          </CardTitle>
          <CardDescription>
            {isEasyMode
              ? "We'll show you the best trading opportunities when they appear"
              : "High-confidence forecasts and actionable insights"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            variant="data"
            title={isEasyMode ? "No Opportunities Right Now" : "No High-Confidence Opportunities"}
            description={
              isEasyMode
                ? "Check back soon! The system is constantly analyzing market data to find the best opportunities for you."
                : "No forecasts above 80% confidence or high-ROI strategies at the moment. Markets may be uncertain or consolidating."
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          {isEasyMode ? 'Top Opportunities' : 'Opportunities Right Now'}
        </CardTitle>
        <CardDescription>
          {isEasyMode
            ? "The best opportunities we've found for you right now"
            : "High-confidence forecasts and actionable insights"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {opportunities.map((opp, index) => {
          const Icon = opp.icon;
          return (
            <Card
              key={index}
              className={`border-l-4 ${
                opp.variant === 'success'
                  ? 'border-l-emerald-500 bg-emerald-500/5'
                  : opp.variant === 'warning'
                    ? 'border-l-amber-500 bg-amber-500/5'
                    : 'border-l-blue-500 bg-blue-500/5'
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`rounded-full p-2 ${
                      opp.variant === 'success'
                        ? 'bg-emerald-500/20'
                        : opp.variant === 'warning'
                          ? 'bg-amber-500/20'
                          : 'bg-blue-500/20'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        opp.variant === 'success'
                          ? 'text-emerald-600'
                          : opp.variant === 'warning'
                            ? 'text-amber-600'
                            : 'text-blue-600'
                      }`}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-foreground">{opp.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{opp.description}</p>
                      </div>
                      <Badge
                        variant={
                          opp.variant === 'success'
                            ? 'default'
                            : opp.variant === 'warning'
                              ? 'secondary'
                              : 'outline'
                        }
                        className={
                          opp.variant === 'success'
                            ? 'bg-emerald-500'
                            : opp.variant === 'warning'
                              ? 'bg-amber-500 text-white'
                              : ''
                        }
                      >
                        {opp.type === 'forecast'
                          ? 'Signal'
                          : opp.type === 'strategy'
                            ? 'Strategy'
                            : 'Alert'}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={opp.variant === 'success' ? 'default' : 'outline'}
                        onClick={() => router.push(opp.actionUrl)}
                      >
                        {opp.action}
                      </Button>
                      {opp.type === 'forecast' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            router.push(
                              `/assistant?prompt=${encodeURIComponent(
                                `Why is ${opp.data.symbol} predicted to move ${opp.data.pred_return >= 0 ? 'up' : 'down'}? Explain this forecast.`
                              )}`
                            )
                          }
                        >
                          Ask AI Why
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}

