/* eslint-disable */
// @ts-nocheck
import { useMemo } from "react";
import useSWR from "swr";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SymbolDisplay } from "@/components/CryptoSelector";
import { fetcher } from "@/lib/api";
import { formatNumber } from "@/lib/utils";

type PositionTabsProps = {
  selectedSymbol: string;
  mode: string;
};

export function PositionTabs({ selectedSymbol, mode }: PositionTabsProps) {
  const { data: summary } = useSWR("/api/trading/summary", fetcher, {
    refreshInterval: 5000,
  });

  const positions = useMemo(() => {
    return (summary?.positions ?? []).filter((p: any) => (p.mode ?? mode) === mode);
  }, [summary, mode]);

  const selectedSymbolPosition = useMemo(() => {
    return positions.find((p: any) => p.symbol === selectedSymbol);
  }, [positions, selectedSymbol]);

  const renderPosition = (position: any) => {
    const unrealizedPnL = position.unrealized_pnl ?? 0;
    const isProfit = unrealizedPnL >= 0;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SymbolDisplay symbol={position.symbol} />
          <Badge variant={position.side === "long" ? "default" : "secondary"}>
            {position.side?.toUpperCase() ?? "LONG"}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Quantity</p>
            <p className="text-sm font-medium">{formatNumber(position.quantity, 4)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Entry</p>
            <p className="text-sm font-medium">${formatNumber(position.avg_entry_price ?? 0, 2)}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Unrealized PnL</p>
          <p className={`text-lg font-bold ${isProfit ? "text-green-500" : "text-red-500"}`}>
            {isProfit ? "+" : ""}${formatNumber(unrealizedPnL, 2)}
          </p>
        </div>

        {position.realized_pnl !== undefined && position.realized_pnl !== 0 && (
          <div>
            <p className="text-xs text-muted-foreground">Realized PnL</p>
            <p className="text-sm font-medium">${formatNumber(position.realized_pnl, 2)}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Positions</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="selected">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="selected">Current Symbol</TabsTrigger>
            <TabsTrigger value="all">All ({positions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="selected" className="mt-4">
            {selectedSymbolPosition ? (
              renderPosition(selectedSymbolPosition)
            ) : (
              <p className="text-sm text-muted-foreground">
                No position for {selectedSymbol}
              </p>
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            {positions.length > 0 ? (
              <div className="space-y-4">
                {positions.map((position: any) => (
                  <div key={position.symbol} className="rounded-lg border p-3">
                    {renderPosition(position)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No open positions in {mode} mode</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

