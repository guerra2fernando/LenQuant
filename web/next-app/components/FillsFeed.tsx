/* eslint-disable */
// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

type Fill = {
  fill_id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  pnl?: number;
  executed_at?: string;
};

type FillsFeedProps = {
  fills: Fill[];
};

export function FillsFeed({ fills }: FillsFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Fills</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fills recorded yet.</p>
        ) : (
          fills.map((fill) => {
            const timestamp = fill.executed_at ? new Date(fill.executed_at).toLocaleString() : "—";
            const pnl = fill.pnl ?? 0;
            return (
              <div
                key={fill.fill_id}
                className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/40 p-3"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{fill.symbol}</span>
                  <span className="text-xs text-muted-foreground">{timestamp}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={fill.side === "buy" ? "text-emerald-500" : "text-red-500"}>
                    {fill.side.toUpperCase()} {formatNumber(fill.quantity, 4)} @ ${formatNumber(fill.price, 2)}
                  </span>
                  <span className={pnl >= 0 ? "text-emerald-500" : "text-red-500"}>
                    PnL {pnl >= 0 ? "+" : ""}${formatNumber(pnl, 2)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

