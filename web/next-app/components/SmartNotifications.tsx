/* eslint-disable */
// @ts-nocheck
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Bell, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ToastProvider";
import { fetcher, postJson } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/utils";

type SmartNotificationsProps = {
  symbol: string;
  interval: string;
  mode: string;
  confidenceThreshold?: number;
};

export function SmartNotifications({
  symbol,
  interval,
  mode,
  confidenceThreshold = 0.8,
}: SmartNotificationsProps) {
  const [executing, setExecuting] = useState<string | null>(null);
  const { pushToast } = useToast();

  // Fetch forecasts for symbol
  const { data: forecastData } = useSWR(
    `/api/forecast/batch?symbols=${encodeURIComponent(symbol)}&horizon=${interval}`,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30s
  );

  // Filter high-confidence signals
  const signals = useMemo(() => {
    if (!forecastData?.forecasts) return [];

    return forecastData.forecasts
      .filter((f: any) => f.confidence >= confidenceThreshold)
      .map((f: any) => {
        const predReturn = f.pred_return ?? 0;
        const isPositive = predReturn > 0;

        return {
          symbol: f.symbol,
          confidence: f.confidence,
          predReturn: predReturn,
          direction: isPositive ? "buy" : "sell",
          expectedReturn: Math.abs(predReturn * 100),
          models: f.models,
        };
      })
      .sort((a: any, b: any) => b.confidence - a.confidence);
  }, [forecastData, confidenceThreshold]);

  const handleExecute = async (signal: any) => {
    setExecuting(signal.symbol);
    try {
      const payload = {
        symbol: signal.symbol,
        side: signal.direction,
        quantity: 0.001, // Default quantity - should be calculated based on risk
        mode,
        type: "market",
      };

      await postJson("/api/trading/orders", payload);
      pushToast({
        title: "Order executed",
        description: `${signal.direction.toUpperCase()} ${signal.symbol}`,
        variant: "success",
      });
    } catch (error: any) {
      pushToast({
        title: "Execution failed",
        description: error.message,
        variant: "error",
      });
    } finally {
      setExecuting(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Smart Signals
          {signals.length > 0 && (
            <Badge variant="default" className="ml-auto">
              {signals.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 text-xs text-muted-foreground">
          Showing predictions with {formatPercent(confidenceThreshold)}+ confidence
        </div>

        {signals.length === 0 ? (
          <div className="py-8 text-center">
            <Bell className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No high-confidence signals at the moment
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {signals.map((signal: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {signal.direction === "buy" ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">{signal.symbol}</span>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Confidence</p>
                          <p className="font-semibold">
                            {formatPercent(signal.confidence)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Expected</p>
                          <p className="font-semibold">
                            {signal.expectedReturn.toFixed(2)}%
                          </p>
                        </div>
                      </div>

                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground">
                          Action: <span className="font-medium capitalize">{signal.direction}</span> now
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => handleExecute(signal)}
                    disabled={executing === signal.symbol}
                    variant={signal.direction === "buy" ? "default" : "destructive"}
                  >
                    {executing === signal.symbol ? (
                      "Executing..."
                    ) : (
                      <>
                        <Zap className="mr-1 h-3 w-3" />
                        Execute {signal.direction.toUpperCase()}
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

