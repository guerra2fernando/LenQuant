/* eslint-disable */
// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

type ExecutionLatencyChartProps = {
  samples: number[];
};

export function ExecutionLatencyChart({ samples }: ExecutionLatencyChartProps) {
  const maxLatency = samples.length ? Math.max(...samples) : 0;
  const avgLatency = samples.length
    ? samples.reduce((sum, value) => sum + value, 0) / samples.length
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Latency</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-3 text-sm text-muted-foreground">
          <span>Average {formatNumber(avgLatency, 0)} ms</span>
          <span>Peak {formatNumber(maxLatency, 0)} ms</span>
        </div>
        <div className="flex h-28 items-end gap-2">
          {samples.length === 0 ? (
            <p className="text-sm text-muted-foreground">Latency metrics will appear after first fills.</p>
          ) : (
            samples.map((sample, index) => {
              const heightPct = maxLatency ? Math.max(6, (sample / maxLatency) * 100) : 0;
              return (
                <div key={`${sample}-${index}`} className="flex w-full flex-col items-center gap-1">
                  <div
                    className="w-full rounded-md bg-primary/70"
                    style={{ height: `${heightPct}%` }}
                    title={`${formatNumber(sample, 0)} ms`}
                  />
                  <span className="text-[10px] text-muted-foreground">{formatNumber(sample, 0)}</span>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

