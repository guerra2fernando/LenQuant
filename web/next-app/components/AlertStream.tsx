/* eslint-disable */
// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Alert = {
  title: string;
  message: string;
  severity?: "info" | "success" | "warning" | "error";
  timestamp?: string;
};

type AlertStreamProps = {
  alerts: Alert[];
};

const BADGE_COLORS: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-500",
  warning: "bg-amber-500/15 text-amber-600",
  error: "bg-red-500/15 text-red-500",
  info: "bg-sky-500/15 text-sky-500",
};

export function AlertStream({ alerts }: AlertStreamProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Alert Stream</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Execution alerts will appear here.</p>
        ) : (
          alerts.map((alert, index) => {
            const severity = alert.severity ?? "info";
            return (
              <div
                key={`${alert.title}-${index}`}
                className="rounded-lg border border-border/60 bg-background/80 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{alert.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${BADGE_COLORS[severity] ?? BADGE_COLORS.info}`}>
                    {severity.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                {alert.timestamp ? (
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

