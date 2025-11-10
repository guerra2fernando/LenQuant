import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  expectedReturn?: number | null;
  expectedRisk?: number | null;
};

export function RiskScoreCard({ expectedReturn, expectedRisk }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocator Outlook</CardTitle>
        <CardDescription>Expected performance based on latest allocation snapshot.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-muted-foreground">Expected ROI</p>
          <p className="text-2xl font-semibold">
            {typeof expectedReturn === "number" ? `${(expectedReturn * 100).toFixed(2)}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Portfolio Risk</p>
          <p className="text-2xl font-semibold">
            {typeof expectedRisk === "number" ? expectedRisk.toFixed(3) : "—"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

