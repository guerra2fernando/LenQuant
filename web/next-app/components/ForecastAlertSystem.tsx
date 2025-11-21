/* eslint-disable */
// @ts-nocheck
import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { useSymbols } from "@/lib/hooks";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

type Forecast = {
  symbol: string;
  pred_return?: number;
  confidence?: number;
  horizon: string;
  timestamp: string;
};

type ForecastChange = {
  symbol: string;
  oldPred: number;
  newPred: number;
  confidence: number;
  flipped: boolean;
};

const ALERT_THRESHOLD = 0.8; // Only alert on >80% confidence
const FLIP_THRESHOLD = 0.03; // Consider significant if >3% difference
const CHECK_INTERVAL = 60_000; // Check every minute

export function ForecastAlertSystem() {
  const { toast } = useToast();
  const { symbols } = useSymbols();
  const [previousForecasts, setPreviousForecasts] = useState<Map<string, Forecast>>(new Map());
  const [alertedChanges, setAlertedChanges] = useState<Set<string>>(new Set());

  const { data: forecastData } = useSWR(
    symbols.length > 0
      ? `/api/forecast/batch?symbols=${encodeURIComponent(symbols.join(","))}&limit=20&horizon=1h`
      : null,
    fetcher,
    {
      refreshInterval: CHECK_INTERVAL,
      revalidateOnFocus: false,
    }
  );

  const detectSignificantChanges = useCallback((
    current: Forecast[],
    previous: Map<string, Forecast>
  ): ForecastChange[] => {
    const changes: ForecastChange[] = [];

    current.forEach((forecast) => {
      if (!forecast.pred_return || !forecast.confidence) return;
      if (forecast.confidence < ALERT_THRESHOLD) return;

      const prev = previous.get(forecast.symbol);
      if (!prev || !prev.pred_return) return;

      const oldDirection = prev.pred_return >= 0 ? 'up' : 'down';
      const newDirection = forecast.pred_return >= 0 ? 'up' : 'down';
      const flipped = oldDirection !== newDirection;
      const changeMagnitude = Math.abs(forecast.pred_return - prev.pred_return);

      // Alert on direction flip OR significant magnitude change
      if (flipped || changeMagnitude > FLIP_THRESHOLD) {
        changes.push({
          symbol: forecast.symbol,
          oldPred: prev.pred_return,
          newPred: forecast.pred_return,
          confidence: forecast.confidence,
          flipped,
        });
      }
    });

    return changes;
  }, []);

  useEffect(() => {
    if (!forecastData?.forecasts) return;

    const currentForecasts = forecastData.forecasts as Forecast[];
    
    // Skip first load - just store the data
    if (previousForecasts.size === 0) {
      const newMap = new Map<string, Forecast>();
      currentForecasts.forEach((f) => newMap.set(f.symbol, f));
      setPreviousForecasts(newMap);
      return;
    }

    // Detect changes
    const changes = detectSignificantChanges(currentForecasts, previousForecasts);

    // Show alerts for new changes
    changes.forEach((change) => {
      const changeKey = `${change.symbol}-${change.newPred.toFixed(4)}-${Date.now()}`;
      
      // Avoid duplicate alerts for same change
      if (alertedChanges.has(changeKey)) return;

      const Icon = change.flipped
        ? AlertTriangle
        : change.newPred >= 0
          ? TrendingUp
          : TrendingDown;

      const title = change.flipped
        ? `🔄 Forecast Flip: ${change.symbol}`
        : `⚡ Forecast Update: ${change.symbol}`;

      const description = change.flipped
        ? `Direction changed from ${change.oldPred >= 0 ? 'bullish' : 'bearish'} to ${change.newPred >= 0 ? 'bullish' : 'bearish'}. New prediction: ${(change.newPred * 100).toFixed(2)}% (${(change.confidence * 100).toFixed(0)}% confidence)`
        : `Significant change: ${(change.oldPred * 100).toFixed(2)}% → ${(change.newPred * 100).toFixed(2)}% (${(change.confidence * 100).toFixed(0)}% confidence)`;

      toast({
        title,
        description,
        duration: 8000,
        variant: change.flipped ? "default" : undefined,
      });

      setAlertedChanges((prev) => {
        const newSet = new Set(prev);
        newSet.add(changeKey);
        // Keep only last 50 alerts in memory
        if (newSet.size > 50) {
          const arr = Array.from(newSet);
          arr.shift();
          return new Set(arr);
        }
        return newSet;
      });
    });

    // Update previous forecasts
    const newMap = new Map<string, Forecast>();
    currentForecasts.forEach((f) => newMap.set(f.symbol, f));
    setPreviousForecasts(newMap);
  }, [forecastData, previousForecasts, detectSignificantChanges, toast, alertedChanges]);

  // This component doesn't render anything - it just manages alerts
  return null;
}

