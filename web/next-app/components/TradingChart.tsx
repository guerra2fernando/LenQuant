
import { useEffect, useRef, useState, useMemo } from "react";
import useSWR from "swr";
import { createChart, IChartApi, ISeriesApi, CandlestickData } from "lightweight-charts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PredictionOverlay } from "@/components/PredictionOverlay";
import { fetcher, buildApiUrl } from "@/lib/api";

type TradingChartProps = {
  symbol: string;
  interval: string;
  height?: number;
  showPredictions?: boolean;
  mode?: string;
};

export function TradingChart({ 
  symbol, 
  interval, 
  height = 500,
  showPredictions = false,
  mode = "paper"
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const positionLineRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartInitialized, setChartInitialized] = useState(false);

  console.log(`[TradingChart] Render - Symbol: ${symbol}, Interval: ${interval}, Loading: ${loading}, ChartInit: ${chartInitialized}`);

  // Fetch positions
  const { data: summary } = useSWR<{ positions: any[] }>("/api/trading/summary", fetcher, {
    refreshInterval: 5000,
  });

  const currentPosition = useMemo(() => {
    if (!summary?.positions) return null;
    return summary.positions.find(
      (p: any) => p.symbol === symbol && (p.mode ?? mode) === mode
    );
  }, [summary, symbol, mode]);

  useEffect(() => {
    console.log('[TradingChart] Initializing chart...');
    if (!chartContainerRef.current) {
      console.warn('[TradingChart] Chart container ref not available');
      return;
    }

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: "transparent" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "rgba(42, 46, 57, 0.5)" },
        horzLines: { color: "rgba(42, 46, 57, 0.5)" },
      },
      crosshair: {
        mode: 1, // Normal crosshair
      },
      rightPriceScale: {
        borderColor: "rgba(42, 46, 57, 0.8)",
      },
      timeScale: {
        borderColor: "rgba(42, 46, 57, 0.8)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    setChartInitialized(true);
    console.log('[TradingChart] Chart initialized successfully');

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      console.log('[TradingChart] Cleaning up chart');
      window.removeEventListener("resize", handleResize);
      chart.remove();
      setChartInitialized(false);
    };
  }, [height]);

  // Fetch and update data when symbol/interval changes
  useEffect(() => {
    console.log(`[TradingChart] Data fetch effect triggered - ChartInit: ${chartInitialized}, CandleSeries: ${!!candleSeriesRef.current}`);
    
    if (!chartInitialized || !candleSeriesRef.current) {
      console.warn('[TradingChart] Chart not ready yet, waiting for initialization');
      setLoading(true);
      return;
    }

    const fetchData = async () => {
      console.log(`[TradingChart] Starting data fetch for ${symbol} ${interval}`);
      setLoading(true);
      setError(null);

      try {
        const url = buildApiUrl(
          `/api/market/ohlcv?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=500`
        );
        console.log(`[TradingChart] Fetching from: ${url}`);
        const response = await fetch(url);
        
        console.log(`[TradingChart] Response status: ${response.status}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`No data available for ${symbol} ${interval}. Please ingest data first.`);
          }
          throw new Error(`Failed to fetch data: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[TradingChart] Received ${data.candles?.length || 0} candles`);

        if (!data.candles || data.candles.length === 0) {
          throw new Error(`No data for ${symbol} ${interval}. Go to Get Started to ingest data.`);
        }
        
        // Safety check: ensure chart and series still exist before setting data
        if (candleSeriesRef.current && chartRef.current) {
          try {
            candleSeriesRef.current.setData(data.candles as CandlestickData[]);
            // Ensure the chart is properly sized after data load
            chartRef.current.timeScale().fitContent();
            console.log(`[TradingChart] Chart data set successfully`);
          } catch (chartErr: any) {
            console.error("[TradingChart] Error setting chart data:", chartErr);
            throw new Error("Failed to render chart. Try refreshing the page.");
          }
        } else {
          console.warn('[TradingChart] Chart refs disappeared during fetch');
          throw new Error("Chart was destroyed during data fetch. Please try again.");
        }
      } catch (err: any) {
        console.error("[TradingChart] Error fetching chart data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
        console.log(`[TradingChart] Data fetch complete - Loading: false`);
      }
    };

    fetchData();
  }, [symbol, interval, chartInitialized]);

  // Add position entry line
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !currentPosition) {
      // Remove line if no position
      if (positionLineRef.current && candleSeriesRef.current) {
        candleSeriesRef.current.removePriceLine(positionLineRef.current);
        positionLineRef.current = null;
      }
      return;
    }

    const avgEntry = currentPosition.avg_entry_price ?? 0;
    if (avgEntry <= 0) return;

    // Remove old line if exists
    if (positionLineRef.current) {
      candleSeriesRef.current.removePriceLine(positionLineRef.current);
    }

    // Add new position entry line
    positionLineRef.current = candleSeriesRef.current.createPriceLine({
      price: avgEntry,
      color: "#FF9800",
      lineWidth: 2,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: `Entry: $${avgEntry.toFixed(2)}`,
    });
  }, [currentPosition]);

  if (error) {
    return (
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {symbol} - {interval}
          </h3>
        </div>
        <div className="flex h-96 flex-col items-center justify-center">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Try a different symbol/timeframe or ingest more data
          </p>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {symbol} - {interval}
          </h3>
        </div>
        <div className="flex h-96 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading chart...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {symbol} - {interval}
        </h3>
        {currentPosition && (
          <Badge variant="outline">
            Position: {currentPosition.quantity.toFixed(4)}
          </Badge>
        )}
      </div>
      <div ref={chartContainerRef} className="relative" />
      
      {/* Add prediction overlay */}
      <PredictionOverlay
        chart={chartRef.current}
        symbol={symbol}
        interval={interval}
        enabled={showPredictions}
      />
    </Card>
  );
}

