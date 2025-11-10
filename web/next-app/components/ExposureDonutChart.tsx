/* eslint-disable */
// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/lib/utils";

type ExposureDonutChartProps = {
  exposures: { mode: string; value: number; limit: number }[];
};

const COLORS = ["#22c55e", "#0ea5e9", "#f97316"];

export function ExposureDonutChart({ exposures }: ExposureDonutChartProps) {
  const total = exposures.reduce((sum, entry) => sum + entry.value, 0);
  let offset = 0;
  const segments = exposures.map((entry, index) => {
    const percent = total ? (entry.value / total) * 100 : 0;
    const segment = ` ${COLORS[index % COLORS.length]} 0 ${percent.toFixed(2)}%`;
    const start = offset;
    offset += percent;
    return { ...entry, percent, start, color: COLORS[index % COLORS.length] };
  });
  const gradient =
    segments.length === 0
      ? "conic-gradient(#94a3b8 0deg, #cbd5f5 360deg)"
      : `conic-gradient(${segments
          .map((segment) => `${segment.color} ${segment.start}% ${segment.start + segment.percent}%`)
          .join(", ")})`;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Exposure Mix</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-6">
        <div
          className="relative h-36 w-36 rounded-full"
          style={{ backgroundImage: gradient }}
        >
          <div className="absolute inset-6 rounded-full bg-background shadow-inner" />
          <div className="absolute inset-12 flex flex-col items-center justify-center text-xs text-muted-foreground">
            <span>Total</span>
            <span className="text-sm font-semibold">${formatNumber(total, 0)}</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 text-sm">
          {segments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exposure yet. Positions will appear here.</p>
          ) : (
            segments.map((segment) => (
              <div key={segment.mode} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="font-medium capitalize">{segment.mode}</span>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div>${formatNumber(segment.value, 0)}</div>
                  <div>{formatPercent(segment.percent / 100, 1)} of exposure</div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

