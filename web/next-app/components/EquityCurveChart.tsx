/* eslint-disable */
// @ts-nocheck
import { useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetcher } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { createChart, IChartApi, LineStyle } from "lightweight-charts";
import { TrendingUp, TrendingDown } from "lucide-react";

type EquityCurveChartProps = {
  mode: string;
  limit?: number;
};

export function EquityCurveChart({ mode, limit = 100 }: EquityCurveChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const { data, isLoading } = useSWR(
    `/api/trading/portfolio/equity-history?mode=${mode}&limit=${limit}`,
    fetcher,
    { refreshInterval: 30_000 }
  );

  const chartData = useMemo(() => {
    if (!data?.snapshots || data.snapshots.length === 0) return null;
    
    const equityData = [];
    const walletData = [];
    const positionsData = [];
    
    for (const snapshot of data.snapshots) {
      const timestamp = new Date(snapshot.timestamp).getTime() / 1000;
      equityData.push({ time: timestamp, value: snapshot.equity });
      walletData.push({ time: timestamp, value: snapshot.wallet_balance });
      positionsData.push({ time: timestamp, value: snapshot.positions_value });
    }
    
    return { equityData, walletData, positionsData };
  }, [data]);

  const stats = useMemo(() => {
    if (!data?.snapshots || data.snapshots.length === 0) return null;
    
    const latest = data.snapshots[data.snapshots.length - 1];
    const first = data.snapshots[0];
    const latestEquity = latest?.equity || 0;
    const firstEquity = first?.equity || latestEquity;
    const change = latestEquity - firstEquity;
    const changePercent = firstEquity > 0 ? (change / firstEquity) * 100 : 0;
    
    return { latestEquity, change, changePercent, isPositive: change >= 0 };
  }, [data]);

  useEffect(() => {
    if (!chartContainerRef.current || !chartData) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300,
      layout: {
        background: { color: "transparent" },
        textColor: "#d1d5db",
      },
      grid: {
        vertLines: { color: "#374151", style: LineStyle.Dotted },
        horzLines: { color: "#374151", style: LineStyle.Dotted },
      },
      timeScale: {
        borderColor: "#374151",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#374151",
      },
    });

    // Add equity line (main)
    const equitySeries = chart.addLineSeries({
      color: "#10b981",
      lineWidth: 2,
      title: "Total Equity",
    });
    equitySeries.setData(chartData.equityData);

    // Add wallet line (dashed)
    const walletSeries = chart.addLineSeries({
      color: "#3b82f6",
      lineWidth: 1.5,
      lineStyle: LineStyle.Dashed,
      title: "Wallet",
    });
    walletSeries.setData(chartData.walletData);

    // Add positions line (dashed)
    const positionsSeries = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 1.5,
      lineStyle: LineStyle.Dashed,
      title: "Positions",
    });
    positionsSeries.setData(chartData.positionsData);

    chart.timeScale().fitContent();

    chartRef.current = chart;

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
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [chartData]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!chartData || !stats) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center py-8">
            No equity history available for {mode} mode
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Equity Curve - {mode.toUpperCase()}</span>
          <div className={`flex items-center gap-2 text-sm ${
            stats.isPositive ? "text-green-500" : "text-red-500"
          }`}>
            {stats.isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>
              {stats.isPositive ? "+" : ""}${formatNumber(stats.change, 2)} ({stats.changePercent.toFixed(2)}%)
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={chartContainerRef} style={{ position: "relative" }} />
        <div className="flex justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-green-500" />
            <span>Total Equity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-blue-500" style={{ borderTop: "1.5px dashed" }} />
            <span>Wallet</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-amber-500" style={{ borderTop: "1.5px dashed" }} />
            <span>Positions</span>
          </div>
        </div>
        <div className="text-center text-sm text-muted-foreground mt-2">
          Current Equity: ${formatNumber(stats.latestEquity, 2)}
        </div>
      </CardContent>
    </Card>
  );
}

