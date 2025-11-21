/* eslint-disable */
// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { ErrorMessage } from "@/components/ErrorMessage";
import { ForecastTable, type ForecastRow } from "@/components/ForecastTable";
import { ForecastFilterPanel, type ForecastFilters } from "@/components/ForecastFilterPanel";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildApiUrl, fetcher } from "@/lib/api";

const HORIZONS = ["1m", "1h", "1d"] as const;
const DEFAULT_SYMBOLS = ["BTC/USD", "ETH/USDT", "SOL/USDT"];
const HISTORY_LENGTH = 60;

type RawForecast = ForecastRow & {
  predicted_return?: number;
  prediction?: number;
};

type ForecastBatchResponse = {
  forecasts: RawForecast[];
};

function useBatchForecast(horizon: string, symbols: string[]) {
  const params = new URLSearchParams({
    horizon,
    symbols: symbols.join(","),
  });
  const key = `/api/forecast/batch?${params.toString()}`;
  return useSWR(key, fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });
}

export default function ForecastsTab() {
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>("1h");
  const [symbols] = useState(DEFAULT_SYMBOLS);
  const { data, isLoading, error, mutate } = useBatchForecast(horizon, symbols);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [filters, setFilters] = useState<ForecastFilters>({
    minConfidence: 0,
    direction: 'all',
  });

  useEffect(() => {
    if (data) {
      setLastUpdated(new Date());
    }
  }, [data]);

  useEffect(() => {
    setHistory({});
  }, [horizon]);

  useEffect(() => {
    const forecastData = data as ForecastBatchResponse | undefined;
    if (!forecastData?.forecasts) {
      return;
    }
    setHistory((prev: Record<string, number[]>) => {
      const next: Record<string, number[]> = { ...prev };
      for (const item of forecastData.forecasts) {
        const key = item.symbol;
        const prediction = item.pred_return ?? item.predicted_return ?? item.prediction;
        if (typeof prediction !== "number" || Number.isNaN(prediction)) {
          continue;
        }
        const series = next[key] ? [...next[key], prediction] : [prediction];
        next[key] = series.slice(-HISTORY_LENGTH);
      }
      return next;
    });
  }, [data]);

  const handleExport = async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        horizon,
        symbols: symbols.join(","),
      });
      const url = buildApiUrl(`/api/forecast/export?${params.toString()}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const filename = `forecast_${horizon}_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export forecasts.");
    } finally {
      setIsExporting(false);
    }
  };

  const rows: ForecastRow[] = useMemo(
    () =>
      (data as ForecastBatchResponse | undefined)?.forecasts?.map((item) => ({
        symbol: item.symbol,
        horizon: item.horizon,
        timestamp: item.timestamp,
        pred_return: item.pred_return ?? item.predicted_return ?? item.prediction ?? undefined,
        confidence: item.confidence,
        models: item.models,
        error: item.error,
      })) ?? [],
    [data],
  );

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Confidence filter
      if (row.confidence !== undefined && row.confidence < filters.minConfidence) {
        return false;
      }

      // Direction filter
      if (filters.direction !== 'all' && row.pred_return !== undefined) {
        if (filters.direction === 'up' && row.pred_return <= 0.02) return false;
        if (filters.direction === 'down' && row.pred_return >= -0.02) return false;
        if (filters.direction === 'neutral' && (row.pred_return > 0.02 || row.pred_return < -0.02)) return false;
      }

      return true;
    });
  }, [rows, filters]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.minConfidence > 0) count++;
    if (filters.direction !== 'all') count++;
    return count;
  }, [filters]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Forecast Studio
            <TooltipExplainer 
              term="Forecast Studio" 
              explanation="This shows AI predictions about how cryptocurrency prices will move in the future. Forecasts combine multiple machine learning models to predict price changes over different time periods (1 minute, 1 hour, or 1 day)."
            />
          </h2>
          <p className="text-sm text-muted-foreground">
            Ensemble predictions for {symbols.join(", ")} across multiple horizons. {filteredRows.length} of {rows.length} shown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {HORIZONS.map((h) => (
            <Button key={h} variant={h === horizon ? "default" : "outline"} onClick={() => setHorizon(h)}>
              {h.toUpperCase()}
              {h === "1m" && (
                <TooltipExplainer 
                  term="1m Horizon" 
                  explanation="1-minute predictions: Very short-term forecasts for rapid trading decisions. Best for high-frequency strategies."
                  size="sm"
                />
              )}
              {h === "1h" && (
                <TooltipExplainer 
                  term="1h Horizon" 
                  explanation="1-hour predictions: Medium-term forecasts for intraday trading. Good balance between noise reduction and responsiveness."
                  size="sm"
                />
              )}
              {h === "1d" && (
                <TooltipExplainer 
                  term="1d Horizon" 
                  explanation="1-day predictions: Long-term forecasts for swing trading or position holding. Smooths out short-term volatility to identify bigger trends."
                  size="sm"
                />
              )}
            </Button>
          ))}
          <ForecastFilterPanel
            filters={filters}
            onFiltersChange={setFilters}
            activeFiltersCount={activeFiltersCount}
          />
          <Button variant="outline" onClick={handleExport} disabled={isLoading || isExporting}>
            {isExporting ? "Exporting..." : "Download CSV"}
          </Button>
          <Button variant="ghost" onClick={() => mutate()} disabled={isLoading}>
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <ErrorMessage
          title="Unable to load forecasts"
          message={error instanceof Error ? error.message : "Unknown error"}
          error={error}
          onRetry={() => mutate()}
        />
      )}

      {exportError && (
        <ErrorMessage
          title="Export failed"
          message={exportError}
          variant="warning"
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {horizon.toUpperCase()} Ensemble Forecasts
            <TooltipExplainer 
              term="Ensemble Forecasts" 
              explanation="These predictions combine multiple AI models into one forecast. Each model's contribution is weighted based on its past accuracy (inverse RMSE). This approach is more reliable than using a single model because different models may perform better under different market conditions."
            />
          </CardTitle>
          <CardDescription>
            Weighted by inverse RMSE with confidence derived from prediction spread.
            <TooltipExplainer 
              term="Confidence Scoring" 
              explanation="Confidence shows how much the different models agree with each other. High confidence (green) means models strongly agree on the direction. Low confidence (red) means models disagree, suggesting uncertain market conditions. Confidence is calculated from the spread (variance) of individual model predictions."
              size="sm"
            />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForecastTable data={filteredRows} isLoading={isLoading} lastUpdated={lastUpdated} history={history} />
        </CardContent>
      </Card>
    </div>
  );
}

