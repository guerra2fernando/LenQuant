/* eslint-disable */
// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
};

type PositionsTableProps = {
  positions: Position[];
  mode: string;
};

export function PositionsTable({ positions, mode }: PositionsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open Positions — {mode.toUpperCase()}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Avg Price</TableHead>
              <TableHead>Unrealized PnL</TableHead>
              <TableHead>Realized PnL</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No open positions.
                </TableCell>
              </TableRow>
            ) : (
              positions.map((position) => (
                <TableRow key={`${position.symbol}-${position.mode ?? mode}`}>
                  <TableCell className="font-medium">{position.symbol}</TableCell>
                  <TableCell>{(position.side ?? "long").toUpperCase()}</TableCell>
                  <TableCell>{formatNumber(position.quantity, 4)}</TableCell>
                  <TableCell>${formatNumber(position.avg_entry_price ?? 0, 2)}</TableCell>
                  <TableCell className={position.unrealized_pnl >= 0 ? "text-emerald-500" : "text-red-500"}>
                    {formatPnL(position.unrealized_pnl)}
                  </TableCell>
                  <TableCell className={position.realized_pnl >= 0 ? "text-emerald-500" : "text-red-500"}>
                    {formatPnL(position.realized_pnl)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {position.updated_at ? new Date(position.updated_at).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
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

