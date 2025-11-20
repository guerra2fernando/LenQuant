/* eslint-disable */
// @ts-nocheck
import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ToastProvider";
import { fetcher, postJson } from "@/lib/api";
import { formatNumber } from "@/lib/utils";

type QuickOrderPanelProps = {
  symbol: string;
  mode: string;
};

export function QuickOrderPanel({ symbol, mode }: QuickOrderPanelProps) {
  const [quantity, setQuantity] = useState<string>("0.001");
  const [submitting, setSubmitting] = useState(false);
  const { pushToast } = useToast();

  // Get latest price
  const { data: priceData } = useSWR(
    `/api/market/latest-price?symbol=${encodeURIComponent(symbol)}`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const currentPrice = priceData?.price ?? 0;
  const estimatedCost = currentPrice * parseFloat(quantity || "0");

  const handleOrder = async (side: "buy" | "sell") => {
    setSubmitting(true);
    try {
      const payload = {
        symbol,
        side,
        quantity: parseFloat(quantity),
        mode,
        type: "market",
      };

      await postJson("/api/trading/orders", payload);
      pushToast({
        title: "Order submitted",
        description: `${side.toUpperCase()} ${quantity} ${symbol}`,
        variant: "success",
      });
    } catch (error: any) {
      pushToast({
        title: "Order failed",
        description: error.message || "Failed to submit order",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Quick Trade</span>
          <Badge variant="outline">{mode.toUpperCase()}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Price */}
        <div>
          <p className="text-xs text-muted-foreground">Current Price</p>
          <p className="text-2xl font-bold">${formatNumber(currentPrice, 2)}</p>
        </div>

        {/* Quantity Input */}
        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={submitting}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Est. Cost: ${formatNumber(estimatedCost, 2)}
          </p>
        </div>

        {/* Buy/Sell Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => handleOrder("buy")}
            disabled={submitting || !quantity || parseFloat(quantity) <= 0}
            className="bg-green-600 hover:bg-green-700"
          >
            Buy
          </Button>
          <Button
            onClick={() => handleOrder("sell")}
            disabled={submitting || !quantity || parseFloat(quantity) <= 0}
            className="bg-red-600 hover:bg-red-700"
          >
            Sell
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

