import useSWR from "swr";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { fetcher } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/utils";

type QuickStatsProps = {
  symbol: string;
};

export function QuickStats({ symbol }: QuickStatsProps) {
  const { data, error, isLoading } = useSWR(
    `/api/market/latest-price?symbol=${encodeURIComponent(symbol)}`,
    fetcher,
    { refreshInterval: 5000 }
  );

  if (isLoading) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Loading price data...</p>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-4">
        <p className="text-sm text-destructive">
          Failed to load price data for {symbol}
        </p>
      </Card>
    );
  }

  const priceChange = data.close - data.open;
  const priceChangePercent = (priceChange / data.open) * 100;
  const isPositive = priceChange >= 0;

  return (
    <Card className="p-4">
      <div className="space-y-3">
        {/* Current Price */}
        <div>
          <p className="text-sm text-muted-foreground">Current Price</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold">${formatNumber(data.price, 2)}</p>
            <div
              className={`flex items-center gap-1 text-sm font-medium ${
                isPositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {isPositive ? "+" : ""}
              {formatPercent(priceChangePercent / 100)}
            </div>
          </div>
        </div>

        {/* 24h Stats */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">High</p>
            <p className="font-medium">${formatNumber(data.high, 2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Low</p>
            <p className="font-medium">${formatNumber(data.low, 2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Volume</p>
            <p className="font-medium">{formatNumber(data.volume, 0)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

