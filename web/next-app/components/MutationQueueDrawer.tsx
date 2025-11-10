import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type QueueItem = {
  _id: string;
  strategy_id: string;
  priority: number;
  status: string;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  run_id?: string;
  metrics?: {
    roi?: number;
    sharpe?: number;
  };
};

type Props = {
  items?: QueueItem[];
};

const STATUS_VARIANT: Record<string, "success" | "secondary" | "outline" | "warning" | "destructive"> = {
  pending: "secondary",
  running: "warning",
  completed: "success",
  failed: "destructive",
};

function formatTimestamp(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function MutationQueueDrawer({ items }: Props) {
  const queue = items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Mutation Queue</CardTitle>
        <CardDescription>Pending and in-flight strategy variants.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">Queue is empty.</p>
        ) : (
          queue.map((item) => {
            const variant = STATUS_VARIANT[item.status] ?? "outline";
            return (
              <div key={item._id} className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.strategy_id}</p>
                    <p className="text-xs text-muted-foreground">Priority {item.priority}</p>
                  </div>
                  <Badge variant={variant}>{item.status}</Badge>
                </div>
                <dl className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    <dt className="uppercase">Created</dt>
                    <dd>{formatTimestamp(item.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="uppercase">Started</dt>
                    <dd>{formatTimestamp(item.started_at)}</dd>
                  </div>
                  <div>
                    <dt className="uppercase">Finished</dt>
                    <dd>{formatTimestamp(item.finished_at)}</dd>
                  </div>
                  <div>
                    <dt className="uppercase">Sharpe</dt>
                    <dd>{item.metrics?.sharpe?.toFixed(2) ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="uppercase">ROI</dt>
                    <dd>{item.metrics?.roi ? `${(item.metrics.roi * 100).toFixed(2)}%` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="uppercase">Run ID</dt>
                    <dd className="font-mono text-[11px]">{item.run_id ?? "—"}</dd>
                  </div>
                </dl>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}


