/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { fetcher, postJson } from "@/lib/api";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

type QuickOrderPanelProps = {
  symbol: string;
  mode: string;
  forecastContext?: {
    action?: string;
    suggestedSize?: string;
    confidence?: string;
    source?: string;
  } | null;
};

export function QuickOrderPanel({ symbol, mode, forecastContext }: QuickOrderPanelProps) {
  const [quantity, setQuantity] = useState<string>("0.001");
  const [submitting, setSubmitting] = useState(false);
  
  // Pre-fill quantity from forecast if provided
  useEffect(() => {
    if (forecastContext?.suggestedSize) {
      // Convert suggested size to a reasonable quantity
      // This is simplified - in production, consider position sizing logic
      const size = parseFloat(forecastContext.suggestedSize) / 100; // Convert percentage to units
      setQuantity(Math.max(0.001, size).toFixed(3));
    }
  }, [forecastContext]);

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
      toast.success("Order submitted", {
        description: `${side.toUpperCase()} ${quantity} ${symbol}`,
      });
    } catch (error: any) {
      toast.error("Order failed", {
        description: error.message || "Failed to submit order",
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
        {/* Forecast Context Badge */}
        {forecastContext?.source === 'forecast' && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  AI Forecast Signal
                </p>
                <p className="text-xs text-muted-foreground">
                  {forecastContext.action === 'buy' ? 'Buy' : 'Sell'} recommendation with {forecastContext.confidence}% confidence
                </p>
              </div>
            </div>
          </div>
        )}
        
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

