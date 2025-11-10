import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type LeaderboardEntry = {
  strategy_id: string;
  roi?: number;
  sharpe?: number;
  max_drawdown?: number;
  forecast_alignment?: number;
  composite?: number;
  generation?: number;
  status?: string;
  tags?: string[];
};

type Props = {
  entries?: LeaderboardEntry[];
  selectedId?: string | null;
  onSelect?: (strategyId: string) => void;
};

function formatPercent(value?: number) {
  if (value === undefined || value === null) {
    return "—";
  }
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value?: number, digits = 2) {
  if (value === undefined || value === null) {
    return "—";
  }
  return value.toFixed(digits);
}

export function EvolutionLeaderboardTable({ entries, selectedId, onSelect }: Props) {
  const rows = entries ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">Leaderboard</CardTitle>
          <Badge variant="secondary">{rows.length} tracked</Badge>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategy</TableHead>
                <TableHead>Gen</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="text-right">Sharpe</TableHead>
                <TableHead className="text-right">Drawdown</TableHead>
                <TableHead className="text-right">Alignment</TableHead>
                <TableHead className="text-right">Composite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((entry) => {
                const isSelected = entry.strategy_id === selectedId;
                const rowBadge =
                  (entry.status === "champion" && "success") || (entry.status === "archived" && "outline") || "secondary";
                return (
                  <TableRow
                    key={entry.strategy_id}
                    data-state={isSelected ? "selected" : undefined}
                    className={cn("cursor-pointer", isSelected && "bg-primary/10")}
                    onClick={() => onSelect?.(entry.strategy_id)}
                  >
                    <TableCell className="space-y-1">
                      <div className="font-medium text-foreground">{entry.strategy_id}</div>
                      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                        <Badge variant={rowBadge}>{entry.status ?? "candidate"}</Badge>
                        {entry.tags?.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.generation}</TableCell>
                    <TableCell className="text-right text-sm">{formatPercent(entry.roi)}</TableCell>
                    <TableCell className="text-right text-sm">{formatNumber(entry.sharpe)}</TableCell>
                    <TableCell className="text-right text-sm">{formatPercent(entry.max_drawdown)}</TableCell>
                    <TableCell className="text-right text-sm">{formatPercent(entry.forecast_alignment)}</TableCell>
                    <TableCell className="text-right text-sm">{formatNumber(entry.composite, 2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Run experiments to populate the leaderboard.</p>
        )}
      </CardContent>
    </Card>
  );
}


