/* eslint-disable */
// @ts-nocheck
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SymbolDisplay } from "@/components/CryptoSelector";
import { fetcher, postJson } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

type PositionTabsProps = {
  selectedSymbol: string;
  mode: string;
};

export function PositionTabs({ selectedSymbol, mode }: PositionTabsProps) {
  const [actionQuantities, setActionQuantities] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const { data: summary } = useSWR("/api/trading/summary", fetcher, {
    refreshInterval: 5000,
  });

  const positions = useMemo(() => {
    return (summary?.positions ?? []).filter((p: any) => (p.mode ?? mode) === mode);
  }, [summary, mode]);

  // Fetch current prices for each position symbol
  const priceQueries = positions.map(position =>
    useSWR(
      `/api/market/latest-price?symbol=${encodeURIComponent(position.symbol)}`,
      fetcher,
      { refreshInterval: 5000 }
    )
  );

  const getCurrentPrice = (symbol: string) => {
    const query = priceQueries.find((_, index) => positions[index]?.symbol === symbol);
    return query?.data?.price ?? 0;
  };

  const handleOrder = async (symbol: string, side: "buy" | "sell", quantity: number) => {
    const actionKey = `${symbol}-${side}`;
    setSubmitting(actionKey);
    try {
      const payload = {
        symbol,
        side,
        quantity,
        mode,
        type: "market",
      };

      await postJson("/api/trading/orders", payload);
      toast.success("Order submitted", {
        description: `${side.toUpperCase()} ${quantity} ${symbol}`,
      });

      // Clear the quantity input
      setActionQuantities(prev => ({ ...prev, [symbol]: "" }));
    } catch (error: any) {
      toast.error("Order failed", {
        description: error.message || "Failed to submit order",
      });
    } finally {
      setSubmitting(null);
    }
  };

  const renderPositionRow = (position: any) => {
    const currentPrice = getCurrentPrice(position.symbol);
    const entryPrice = position.avg_entry_price ?? 0;
    const quantity = position.quantity ?? 0;
    const unrealizedPnL = position.unrealized_pnl ?? 0;

    const priceChange = currentPrice - entryPrice;
    const priceChangePercent = entryPrice > 0 ? (priceChange / entryPrice) * 100 : 0;
    const isProfit = unrealizedPnL >= 0;
    const isPriceUp = priceChange >= 0;

    const actionQuantity = actionQuantities[position.symbol] || "0.001";

    return (
      <TableRow key={position.symbol}>
        <TableCell>
          <div className="flex items-center gap-2">
            <SymbolDisplay symbol={position.symbol} />
            <Badge variant={position.side === "long" ? "default" : "secondary"} className="text-xs">
              {position.side?.toUpperCase() ?? "LONG"}
            </Badge>
          </div>
        </TableCell>
        <TableCell className="text-right font-mono">
          {formatNumber(quantity, 4)}
        </TableCell>
        <TableCell className="text-right font-mono">
          ${formatNumber(entryPrice, 2)}
        </TableCell>
        <TableCell className="text-right font-mono">
          <div>
            <div>${formatNumber(currentPrice, 2)}</div>
            <div className={`text-xs ${isPriceUp ? "text-green-600" : "text-red-600"}`}>
              {isPriceUp ? "+" : ""}${formatNumber(priceChange, 2)} ({isPriceUp ? "+" : ""}{formatNumber(priceChangePercent, 2)}%)
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div>
            <div className={`font-bold ${isProfit ? "text-green-600" : "text-red-600"}`}>
              {isProfit ? "+" : ""}${formatNumber(unrealizedPnL, 2)}
            </div>
            {position.realized_pnl !== undefined && position.realized_pnl !== 0 && (
              <div className="text-xs text-muted-foreground">
                Realized: ${formatNumber(position.realized_pnl, 2)}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.001"
              value={actionQuantity}
              onChange={(e) => setActionQuantities(prev => ({ ...prev, [position.symbol]: e.target.value }))}
              className="w-20 h-8 text-xs"
              placeholder="Qty"
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 text-xs bg-green-50 hover:bg-green-100 border-green-200"
                onClick={() => handleOrder(position.symbol, "buy", parseFloat(actionQuantity))}
                disabled={submitting === `${position.symbol}-buy` || !actionQuantity || parseFloat(actionQuantity) <= 0}
              >
                +
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 text-xs bg-red-50 hover:bg-red-100 border-red-200"
                onClick={() => handleOrder(position.symbol, "sell", parseFloat(actionQuantity))}
                disabled={submitting === `${position.symbol}-sell` || !actionQuantity || parseFloat(actionQuantity) <= 0}
              >
                -
              </Button>
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Open Positions</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{mode.toUpperCase()}</Badge>
            <Badge variant="secondary">{positions.length} positions</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {positions.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Symbol</TableHead>
                  <TableHead className="text-right min-w-[80px]">Quantity</TableHead>
                  <TableHead className="text-right min-w-[100px]">Entry Price</TableHead>
                  <TableHead className="text-right min-w-[120px]">Current Price</TableHead>
                  <TableHead className="text-right min-w-[100px]">P&L</TableHead>
                  <TableHead className="text-center min-w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map(renderPositionRow)}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No open positions in {mode} mode</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

