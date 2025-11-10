import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SafetyLimits = Record<string, number | string>;

type SafetyGuardSummaryProps = {
  safetyLimits?: SafetyLimits;
};

export function SafetyGuardSummary({ safetyLimits = {} }: SafetyGuardSummaryProps) {
  const entries = Object.entries(safetyLimits);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Safety Guards</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {entries.length === 0 ? <p>No safety guards configured.</p> : null}
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 p-2">
            <span className="text-xs uppercase text-muted-foreground">{key.replace(/_/g, " ")}</span>
            <span className="text-sm font-medium text-foreground">{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

