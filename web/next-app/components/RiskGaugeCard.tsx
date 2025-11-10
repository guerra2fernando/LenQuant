/* eslint-disable */
// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatNumber, formatPercent } from "@/lib/utils";

type RiskGaugeCardProps = {
  title: string;
  current: number;
  limit: number;
  description?: string;
  tone?: "ok" | "warning" | "critical";
};

export function RiskGaugeCard({ title, current, limit, description, tone = "ok" }: RiskGaugeCardProps) {
  const ratio = limit > 0 ? Math.min(1, current / limit) : 0;
  const percent = ratio * 100;
  const color =
    tone === "critical"
      ? "bg-red-500"
      : tone === "warning"
        ? "bg-amber-500"
        : percent > 80
          ? "bg-amber-500"
          : percent > 95
            ? "bg-red-500"
            : "bg-emerald-500";

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{title}</span>
          <span className="text-sm text-muted-foreground">
            ${formatNumber(current, 2)} / ${formatNumber(limit, 2)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={percent} className="h-2">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
        </Progress>
        <div className="text-xs text-muted-foreground">
          {description ?? `Usage ${formatPercent(ratio, 1)} of configured limit.`}
        </div>
      </CardContent>
    </Card>
  );
}

