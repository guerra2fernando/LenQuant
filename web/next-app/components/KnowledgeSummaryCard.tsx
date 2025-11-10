import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  summary?: string;
  createdAt?: string | null;
  overfitIds?: string[];
  queuedStrategies?: string[];
};

export function KnowledgeSummaryCard({ summary, createdAt, overfitIds, queuedStrategies }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Learning Summary</CardTitle>
        <CardDescription>
          {createdAt ? `Recorded ${new Date(createdAt).toLocaleString()}` : "Latest learning insights"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {summary ?? "No knowledge summary available yet."}
        </p>
        <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <div>
            <p className="font-medium text-foreground">Overfit Alerts</p>
            <p>{overfitIds && overfitIds.length > 0 ? overfitIds.join(", ") : "None"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Queued Strategies</p>
            <p>{queuedStrategies && queuedStrategies.length > 0 ? queuedStrategies.join(", ") : "None"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

