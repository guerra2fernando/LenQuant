/* eslint-disable */
// @ts-nocheck
import { useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, TrendingUp, TrendingDown } from "lucide-react";
import { fetcher } from "@/lib/api";
import { useSymbols } from "@/lib/hooks";
import { SymbolDisplay } from "./CryptoSelector";
import { formatPercent } from "@/lib/utils";

export function SmartSignalPreviewCard() {
  const { symbols } = useSymbols();

  // Use server-side filtering for better performance
  const { data: forecastData } = useSWR(
    symbols.length > 0
      ? `/api/forecast/batch?symbols=${encodeURIComponent(symbols.join(","))}&horizon=1h&min_confidence=0.8&sort_by=confidence&sort_order=desc&limit=1`
      : null,
    fetcher
  );

  const topSignal = useMemo(() => {
    if (!forecastData?.forecasts || forecastData.forecasts.length === 0) return null;
    
    // Take the first (highest confidence) signal
    const top = forecastData.forecasts[0];
    if (!top || top.error) return null;
    
    const predReturn = top.pred_return ?? 0;
    return {
      symbol: top.symbol,
      confidence: top.confidence,
      expectedReturn: Math.abs(predReturn * 100),
      direction: predReturn > 0 ? "buy" : "sell",
      reasoning: predReturn > 0 
        ? "Strong technical indicators suggest upward momentum" 
        : "Market signals indicate potential decline",
    };
  }, [forecastData]);

  if (!topSignal) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Top Trading Signal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-6 text-center">
            <Bell className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No high-confidence signals right now
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Check back soon or explore the terminal for manual trading
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Top Trading Signal
          <Badge variant="default" className="ml-auto">
            {formatPercent(topSignal.confidence)} Confidence
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <SymbolDisplay symbol={topSignal.symbol} />
            <div>
              <div className="font-semibold text-lg flex items-center gap-2">
                {topSignal.direction === "buy" ? (
                  <>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    BUY
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    SELL
                  </>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Expected return: +{topSignal.expectedReturn.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mb-3">
          {topSignal.reasoning}
        </p>
        
        <div className="flex gap-2">
          <Link href={`/terminal?symbol=${encodeURIComponent(topSignal.symbol)}&action=${topSignal.direction}`} className="flex-1">
            <Button className="w-full">Trade Now</Button>
          </Link>
          <Link href={`/assistant?prompt=${encodeURIComponent(`Tell me about the ${topSignal.symbol} signal and why it has ${(topSignal.confidence * 100).toFixed(0)}% confidence`)}`}>
            <Button variant="outline">Ask Assistant</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

