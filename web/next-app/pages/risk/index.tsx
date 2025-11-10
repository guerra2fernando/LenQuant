/* eslint-disable */
// @ts-nocheck
import useSWR from "swr";

import { AlertStream } from "@/components/AlertStream";
import { ExposureDonutChart } from "@/components/ExposureDonutChart";
import { RiskGaugeCard } from "@/components/RiskGaugeCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetcher, postJson } from "@/lib/api";
import { formatNumber } from "@/lib/utils";

export default function RiskDashboardPage() {
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <RiskGaugeCard
          title="Open Exposure"
          current={Object.values(openExposure).reduce((sum, value) => sum + value, 0)}
          limit={metrics.max_open_exposure_usd ?? 1}
        />
        <RiskGaugeCard
          title="Daily Loss"
          current={Math.abs(summary?.daily_loss_usd ?? 0)}
          limit={metrics.max_daily_loss_usd ?? 1}
          tone={summary?.daily_loss_usd < 0 ? "warning" : "ok"}
        />
        <RiskGaugeCard
          title="Auto Mode Cap"
          current={summary?.settings?.auto_mode?.max_trade_usd ?? 0}
          limit={metrics.max_trade_usd ?? 1}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ExposureDonutChart exposures={exposures} />
        <AlertStream alerts={alerts} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open Breaches</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {breachesList.length === 0 ? (
            <p className="text-sm text-muted-foreground">All clear. No outstanding breaches.</p>
          ) : (
            breachesList.map((breach) => (
              <div key={breach._id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <div className="text-sm font-medium">{breach.message}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(breach.created_at).toLocaleString()} • Context: {JSON.stringify(breach.context ?? {})}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => acknowledgeBreach(breach._id)}>
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

