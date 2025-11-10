import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Strategy = {
  strategy_id: string;
  family?: string;
  status?: string;
  generation?: number;
  fitness?: {
    roi?: number;
    sharpe?: number;
    max_drawdown?: number;
    forecast_alignment?: number;
    stability?: number;
    composite?: number;
  };
  params?: Record<string, number>;
  tags?: string[];
};

type Run = {
  run_id: string;
  created_at?: string;
  results?: {
    roi?: number;
    sharpe?: number;
    max_drawdown?: number;
    forecast_alignment?: number;
  };
};

type Props = {
  strategy?: Strategy | null;
  runs?: Run[];
};

function formatPercent(value?: number) {
  if (value === undefined || value === null) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value?: number, digits = 2) {
  if (value === undefined || value === null) return "—";
  return value.toFixed(digits);
}

export function GenomeComparisonPanel({ strategy, runs }: Props) {
  if (!strategy) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Genome Details</CardTitle>
          <CardDescription>Select a strategy from the leaderboard to inspect metrics.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const fitness = strategy.fitness ?? {};
  const parameters = Object.entries(strategy.params ?? {});

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{strategy.strategy_id}</CardTitle>
            <CardDescription>
              {strategy.family} • Generation {strategy.generation}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={strategy.status === "champion" ? "success" : "secondary"}>{strategy.status}</Badge>
            {strategy.tags?.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="ROI" value={formatPercent(fitness.roi)} />
          <Metric label="Sharpe" value={formatNumber(fitness.sharpe)} />
          <Metric label="Max Drawdown" value={formatPercent(fitness.max_drawdown)} />
          <Metric label="Alignment" value={formatPercent(fitness.forecast_alignment)} />
          <Metric label="Stability" value={formatNumber(fitness.stability)} />
          <Metric label="Composite" value={formatNumber(fitness.composite)} />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Parameters</h3>
          {parameters.length ? (
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {parameters.map(([key, value]) => (
                <div key={key} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                  <p className="text-xs uppercase text-muted-foreground">{key}</p>
                  <p className="font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No parameters recorded.</p>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Recent Runs</h3>
          {runs && runs.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead className="text-right">Sharpe</TableHead>
                  <TableHead className="text-right">Drawdown</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.run_id}>
                    <TableCell className="font-mono text-[11px]">{run.run_id}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {run.created_at ? new Date(run.created_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatPercent(run.results?.roi)}</TableCell>
                    <TableCell className="text-right text-sm">{formatNumber(run.results?.sharpe)}</TableCell>
                    <TableCell className="text-right text-sm">{formatPercent(run.results?.max_drawdown)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No run history yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/10 p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}


