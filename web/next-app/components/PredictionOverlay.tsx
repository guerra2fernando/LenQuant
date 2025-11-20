import { useEffect, useRef } from "react";
import { IChartApi, ISeriesApi, LineData, LineStyle } from "lightweight-charts";

type PredictionOverlayProps = {
  chart: IChartApi | null;
  symbol: string;
  interval: string;
  enabled: boolean;
};

export function PredictionOverlay({
  chart,
  symbol,
  interval,
  enabled,
}: PredictionOverlayProps) {
  const predictionSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!chart || !enabled) {
      // Remove series if disabled
      if (predictionSeriesRef.current && chart) {
        chart.removeSeries(predictionSeriesRef.current);
        predictionSeriesRef.current = null;
      }
      return;
    }

    // Create prediction line series
    if (!predictionSeriesRef.current) {
      predictionSeriesRef.current = chart.addLineSeries({
        color: "#2962FF",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: "AI Prediction",
      });
    }

    // Fetch forecast data
    const fetchForecast = async () => {
      try {
        const response = await fetch(
          `/api/market/forecast-chart?symbol=${encodeURIComponent(
            symbol
          )}&horizon=${interval}&forecast_periods=20`
        );

        if (!response.ok) {
          console.warn("No forecast available for", symbol, interval);
          return;
        }

        const data = await response.json();
        predictionSeriesRef.current?.setData(data.forecast_points as LineData[]);
      } catch (error) {
        console.error("Error fetching forecast:", error);
      }
    };

    fetchForecast();
  }, [chart, symbol, interval, enabled]);

  return null; // This component doesn't render anything directly
}

