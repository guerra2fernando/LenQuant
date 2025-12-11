/* eslint-disable */
// @ts-nocheck
import useSWR from "swr";

import { AlertStream } from "@/components/AlertStream";
import { ExposureDonutChart } from "@/components/ExposureDonutChart";
import { RiskGaugeCard } from "@/components/RiskGaugeCard";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Settings, Terminal, PieChart, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { fetcher, postJson } from "@/lib/api";
import { formatNumber } from "@/lib/utils";

export default function RiskDashboardPage() {
  const router = useRouter();
  const { data: summary, mutate: refreshSummary } = useSWR("/api/risk/summary", fetcher, { refreshInterval: 20000 });
  const { data: breaches, mutate: refreshBreaches } = useSWR("/api/risk/breaches", fetcher, { refreshInterval: 30000 });

  const openExposure = summary?.open_exposure ?? {};
  const metrics = summary?.settings?.risk ?? {};
  const breachesList = breaches ?? [];

  const alerts = breachesList.map((breach) => ({
    title: breach.code?.replaceAll("_", " ").toUpperCase() ?? "BREACH",
    message: breach.message ?? "",
    severity: "error",
    timestamp: breach.created_at,
  }));

  const exposures = Object.entries(openExposure).map(([mode, value]) => ({
    mode,
    value,
    limit: metrics.max_open_exposure_usd ?? 1,
  }));

  const acknowledgeBreach = async (breachId: string) => {
    await postJson("/api/risk/acknowledge", { breach_id: breachId });
    await Promise.all([refreshBreaches(), refreshSummary()]);
  };

  // Calculate pre-breach warnings
  const totalExposure = Object.values(openExposure).reduce((sum, value) => sum + value, 0);
  const maxExposure = metrics.max_open_exposure_usd ?? 1;
  const exposurePercent = (totalExposure / maxExposure) * 100;
  
  const dailyLoss = Math.abs(summary?.daily_loss_usd ?? 0);
  const maxDailyLoss = metrics.max_daily_loss_usd ?? 1;
  const dailyLossPercent = (dailyLoss / maxDailyLoss) * 100;

  // Warning thresholds
  const showExposureWarning = exposurePercent >= 80 && exposurePercent < 100;
  const showDailyLossWarning = dailyLossPercent >= 80 && dailyLossPercent < 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            Risk Dashboard
            <TooltipExplainer 
              term="Risk Dashboard" 
              explanation="This dashboard monitors all your risk metrics in real-time to protect your capital. It tracks position sizes, daily losses, and breaches of safety limits. The system automatically enforces these limits to prevent excessive losses or overexposure. Think of this as your trading safety control center."
            />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor exposure limits, track breaches, and review risk metrics across all trading modes.
          </p>
        </div>
        {/* Quick link to adjust limits */}
        <div className="flex gap-2">
          <Link href="/settings?tab=trading">
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Adjust Limits
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => router.push('/portfolio')}>
            <PieChart className="mr-2 h-4 w-4" />
            View Portfolio
          </Button>
        </div>
      </div>

      {/* Pre-breach Warnings */}
      {(showExposureWarning || showDailyLossWarning) && (
        <Alert variant="warning" className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-700">Warning: Approaching Risk Limit</AlertTitle>
          <AlertDescription className="text-yellow-700">
            {showExposureWarning && (
              <div className="mb-2">
                • <strong>Exposure:</strong> You're at {exposurePercent.toFixed(0)}% of your maximum exposure limit 
                (${formatNumber(totalExposure, 2)} / ${formatNumber(maxExposure, 2)})
              </div>
            )}
            {showDailyLossWarning && (
              <div>
                • <strong>Daily Loss:</strong> You've reached {dailyLossPercent.toFixed(0)}% of your daily loss limit 
                (${formatNumber(dailyLoss, 2)} / ${formatNumber(maxDailyLoss, 2)})
              </div>
            )}
            <div className="mt-3 text-sm">
              Consider reducing position sizes or closing some positions to stay within safe limits.
            </div>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/portfolio')}>
          <CardContent className="p-0">
            <RiskGaugeCard
              title="Open Exposure"
              current={Object.values(openExposure).reduce((sum, value) => sum + value, 0)}
              limit={metrics.max_open_exposure_usd ?? 1}
              tooltip="Total dollar value of all open positions across all modes. This limit prevents overexposure - having too much capital at risk simultaneously. When you hit this limit, you must close positions before opening new ones."
            />
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/portfolio')}>
          <CardContent className="p-0">
            <RiskGaugeCard
              title="Daily Loss"
              current={Math.abs(summary?.daily_loss_usd ?? 0)}
              limit={metrics.max_daily_loss_usd ?? 1}
              tone={summary?.daily_loss_usd < 0 ? "warning" : "ok"}
              tooltip="How much money has been lost today. This circuit breaker stops trading automatically if you hit the daily loss limit, preventing emotional trading and deeper losses. Resets at midnight."
            />
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/settings?tab=trading')}>
          <CardContent className="p-0">
            <RiskGaugeCard
              title="Auto Mode Cap"
              current={summary?.settings?.auto_mode?.max_trade_usd ?? 0}
              limit={metrics.max_trade_usd ?? 1}
              tooltip="Maximum dollar size for automated trades. This ensures the system can't place orders that are too large for your account. Protects against bugs or miscalculations in automated strategies."
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ExposureDonutChart exposures={exposures} />
        <AlertStream alerts={alerts} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Open Breaches
              <TooltipExplainer 
                term="Open Breaches" 
                explanation="Risk breaches occur when trading activity violates a safety limit - like exceeding your daily loss cap or position size limit. Each breach must be acknowledged to confirm you're aware of it. Breaches may temporarily halt trading until resolved. This accountability system prevents ignoring important risk events."
              />
              {breachesList.length > 0 && (
                <Badge variant="destructive">{breachesList.length}</Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {breachesList.length === 0 ? (
            <div className="py-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-3">
                <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium">All Clear</p>
              <p className="text-xs text-muted-foreground mt-1">No outstanding risk breaches</p>
            </div>
          ) : (
            breachesList.map((breach) => (
              <div 
                key={breach._id} 
                className="flex items-center justify-between rounded-lg border-2 border-red-500/30 bg-red-500/5 p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive" className="text-xs">
                      {breach.code?.replaceAll("_", " ").toUpperCase() || "BREACH"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(breach.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-red-700">{breach.message}</div>
                  {breach.context && Object.keys(breach.context).length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Context: {JSON.stringify(breach.context)}
                    </div>
                  )}
                  {/* Contextual Links */}
                  <div className="flex gap-2 mt-2">
                    {breach.context?.symbol && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/terminal?symbol=${breach.context.symbol}`);
                        }}
                        className="h-6 text-xs gap-1 px-2"
                      >
                        <Terminal className="h-3 w-3" />
                        Terminal
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push('/portfolio');
                      }}
                      className="h-6 text-xs gap-1 px-2"
                    >
                      <PieChart className="h-3 w-3" />
                      Portfolio
                    </Button>
                    {breach.context?.strategy_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/analytics?tab=strategies&id=${breach.context.strategy_id}`);
                        }}
                        className="h-6 text-xs gap-1 px-2"
                      >
                        <TrendingUp className="h-3 w-3" />
                        Strategy
                      </Button>
                    )}
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => acknowledgeBreach(breach._id)}
                  className="ml-3"
                >
                  Acknowledge
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

