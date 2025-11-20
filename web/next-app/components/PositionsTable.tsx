/* eslint-disable */
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { SymbolDisplay } from "@/components/CryptoSelector";
import { useMode } from "@/lib/mode-context";
import { formatNumber } from "@/lib/utils";

type Position = {
  symbol: string;
  side?: string;
  quantity: number;
  avg_entry_price?: number;
  mode?: string;
  realized_pnl?: number;
  unrealized_pnl?: number;
  updated_at?: string;
  strategy_id?: string;
  cohort_id?: string;
  genome_id?: string;
};

type PositionsTableProps = {
  positions: Position[];
  mode: string;
};

export function PositionsTable({ positions, mode }: PositionsTableProps) {
  const { isEasyMode } = useMode();

  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Open Positions — {mode.toUpperCase()}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6">
            <EmptyState
              variant="trading"
              title={isEasyMode ? "No Open Positions" : "No Open Positions"}
              description={
                isEasyMode
                  ? `You don't have any open positions in ${mode} mode. Place a buy or sell order to open a position.`
                  : `No open positions in ${mode} mode.`
              }
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Open Positions — {mode.toUpperCase()}
          <TooltipExplainer 
            term="Open Positions" 
            explanation="These are your active cryptocurrency holdings that you've bought but not yet sold (or vice versa for short positions). Each position shows the quantity you own, your average entry price, and your current profit/loss. Unrealized PnL changes as prices move; realized PnL is locked in when you close the position. Positions stay open until you place an offsetting trade."
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Avg Price</TableHead>
              <TableHead>Strategy/Cohort</TableHead>
              <TableHead>Unrealized PnL</TableHead>
              <TableHead>Realized PnL</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => (
              <TableRow key={`${position.symbol}-${position.mode ?? mode}`}>
                <TableCell>
                  <SymbolDisplay symbol={position.symbol} />
                </TableCell>
                <TableCell>{(position.side ?? "long").toUpperCase()}</TableCell>
                <TableCell>{formatNumber(position.quantity, 4)}</TableCell>
                <TableCell>${formatNumber(position.avg_entry_price ?? 0, 2)}</TableCell>
                <TableCell className="text-xs font-mono">
                  {position.strategy_id || position.cohort_id ? (
                    <div>
                      {position.strategy_id && (
                        <div className="text-blue-500" title={position.strategy_id}>
                          S:{position.strategy_id.substring(0, 8)}
                        </div>
                      )}
                      {position.cohort_id && (
                        <div className="text-purple-500" title={position.cohort_id}>
                          C:{position.cohort_id.substring(0, 8)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell
                  className={
                    position.unrealized_pnl !== undefined && position.unrealized_pnl >= 0 ? "text-emerald-500" : "text-red-500"
                  }
                >
                  {formatPnL(position.unrealized_pnl)}
                </TableCell>
                <TableCell
                  className={
                    position.realized_pnl !== undefined && position.realized_pnl >= 0 ? "text-emerald-500" : "text-red-500"
                  }
                >
                  {formatPnL(position.realized_pnl)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {position.updated_at ? new Date(position.updated_at).toLocaleString() : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function formatPnL(value?: number) {
  if (value === undefined || value === null) {
    return "—";
  }
  const formatted = formatNumber(value, 2);
  return `$${formatted}`;
}

