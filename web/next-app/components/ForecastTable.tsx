import { ConfidenceIndicator } from "@/components/ConfidenceIndicator";
import { EmptyState } from "@/components/EmptyState";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { SymbolDisplay } from "@/components/CryptoSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ForecastSparkline } from "@/components/ForecastSparkline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMode } from "@/lib/mode-context";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, MessageSquare } from "lucide-react";
import { useRouter } from "next/router";

export type ForecastModelBreakdown = {
  model_id: string;
  prediction?: number;
  weight?: number;
  rmse?: number;
};

export type ForecastRow = {
  symbol: string;
  horizon: string;
  timestamp: string;
  pred_return?: number;
  confidence?: number;
  models?: ForecastModelBreakdown[];
  error?: string;
};

type Props = {
  data: ForecastRow[];
  isLoading?: boolean;
  lastUpdated?: Date | null;
  history?: Record<string, number[]>;
};

export function ForecastTable({ data, isLoading, lastUpdated, history }: Props) {
  const { isEasyMode } = useMode();
  const router = useRouter();

  const handleTradeNow = (symbol: string, pred: number, confidence: number, forecastId?: string) => {
    const action = pred >= 0 ? 'buy' : 'sell';
    // Calculate suggested size based on confidence (higher confidence = larger size)
    const suggestedSize = Math.round(confidence * 100); // Simple calculation: 80% confidence = 80 units
    
    const params = new URLSearchParams({
      symbol: symbol,
      action: action,
      suggested_size: suggestedSize.toString(),
      source: 'forecast',
      confidence: (confidence * 100).toFixed(0),
    });
    
    if (forecastId) {
      params.append('forecast_id', forecastId);
    }
    
    router.push(`/terminal?${params.toString()}`);
  };

  const handleAskAI = (symbol: string, pred: number, confidence: number) => {
    const direction = pred >= 0 ? 'increase' : 'decrease';
    const prompt = `Why is the forecast predicting ${symbol} will ${direction} by ${(Math.abs(pred) * 100).toFixed(2)}% with ${(confidence * 100).toFixed(0)}% confidence? What factors are driving this prediction?`;
    router.push(`/assistant?prompt=${encodeURIComponent(prompt)}`);
  };

  // Generate plain language summary for Easy Mode
  const getPlainLanguageSummary = (row: ForecastRow): string => {
    const pred = row.pred_return ?? 0;
    const confidence = row.confidence ?? 0;
    const symbol = row.symbol;

    if (pred > 0.05) {
      return `The system predicts ${symbol} will go up by ${(pred * 100).toFixed(1)}% with ${(confidence * 100).toFixed(0)}% confidence. This is a strong positive signal.`;
    } else if (pred > 0.02) {
      return `The system predicts ${symbol} will go up by ${(pred * 100).toFixed(1)}% with ${(confidence * 100).toFixed(0)}% confidence. This is a moderate positive signal.`;
    } else if (pred < -0.05) {
      return `The system predicts ${symbol} will go down by ${(Math.abs(pred) * 100).toFixed(1)}% with ${(confidence * 100).toFixed(0)}% confidence. This is a strong negative signal.`;
    } else if (pred < -0.02) {
      return `The system predicts ${symbol} will go down by ${(Math.abs(pred) * 100).toFixed(1)}% with ${(confidence * 100).toFixed(0)}% confidence. This is a moderate negative signal.`;
    } else {
      return `The system predicts ${symbol} will have minimal movement (${(pred * 100).toFixed(1)}%) with ${(confidence * 100).toFixed(0)}% confidence.`;
    }
  };

  return (
    <Card className="border">
      {isEasyMode && (
        <CardHeader>
          <CardTitle>
            Price Predictions
            <TooltipExplainer 
              term="Price Predictions" 
              explanation="Machine learning models analyze historical patterns, technical indicators, and market data to predict future price movements. Each prediction includes a confidence score showing how certain the system is. These forecasts help inform trading decisions but aren't guarantees - markets are unpredictable. The 'trend' sparkline shows recent prediction history."
            />
          </CardTitle>
          <CardDescription>
            These are predictions about how cryptocurrency prices might change. Higher confidence means the system is
            more certain about the prediction.
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className={cn("-mx-4 -mb-4 px-0 pb-0", isEasyMode && "-mt-4")}>
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{isEasyMode ? "Cryptocurrency" : "Symbol"}</TableHead>
            <TableHead>{isEasyMode ? "Expected Change" : "Predicted Return"}</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Trend</TableHead>
            <TableHead>Timestamp</TableHead>
            {!isEasyMode && <TableHead>Models</TableHead>}
            {isEasyMode && <TableHead>Summary</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={7}>
                <div className="animate-pulse py-6 text-sm text-muted-foreground">Loading forecasts…</div>
              </TableCell>
            </TableRow>
          )}

          {!isLoading && data.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="p-0">
                <div className="py-6">
                  <EmptyState
                    variant="data"
                    title={isEasyMode ? "No Predictions Yet" : "No Forecasts Available"}
                    description={
                      isEasyMode
                        ? "Price predictions will appear here once the system has analyzed market data. Check back soon or run the initial setup if you haven't already."
                        : "No forecasts available for the selected horizon. Try selecting a different time horizon or wait for new forecasts to be generated."
                    }
                  />
                </div>
              </TableCell>
            </TableRow>
          )}

          {data.map((row) => {
            const pred = row.pred_return ?? null;
            const confidence = row.confidence ?? null;
            const timestamp = new Date(row.timestamp);
            const formattedTimestamp =
              Number.isNaN(timestamp.getTime()) === false
                ? timestamp.toLocaleString()
                : row.timestamp || "—";
            
            // Highlight high-confidence forecasts (>80%)
            const isHighConfidence = confidence !== null && confidence > 0.8;
            const rowClassName = cn(
              row.error && "bg-destructive/10",
              isHighConfidence && "bg-emerald-500/5 border-l-4 border-l-emerald-500"
            );

            return (
              <TableRow key={`${row.symbol}-${row.timestamp}`} className={rowClassName}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <SymbolDisplay symbol={row.symbol} />
                    {isHighConfidence && (
                      <Badge variant="default" className="bg-emerald-500 text-xs">
                        High Confidence
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {row.error ? (
                    <span className="text-sm text-destructive">{row.error}</span>
                  ) : pred !== null ? (
                    <div className="flex items-center gap-2">
                      {pred >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      )}
                      <span className={pred >= 0 ? "text-emerald-500 font-semibold" : "text-destructive font-semibold"}>
                        {(pred * 100).toFixed(2)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <ConfidenceIndicator value={confidence} />
                </TableCell>
                <TableCell>
                  <ForecastSparkline values={history?.[row.symbol] ?? []} />
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">{formattedTimestamp}</span>
                </TableCell>
                {isEasyMode ? (
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{getPlainLanguageSummary(row)}</span>
                  </TableCell>
                ) : (
                  <TableCell>
                    {row.models && row.models.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {row.models.map((model) => (
                          <Badge key={model.model_id} variant="outline">
                            <span className="font-medium">{model.model_id}</span>
                            {model.prediction !== undefined && (
                              <span className="ml-1 text-muted-foreground">
                                {(model.prediction * 100).toFixed(2)}%
                              </span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {pred !== null && !row.error && (
                      <>
                        <Button
                          size="sm"
                          variant={isHighConfidence ? "default" : "outline"}
                          onClick={() => handleTradeNow(row.symbol, pred, confidence ?? 0, row.timestamp)}
                          className="whitespace-nowrap"
                        >
                          {isEasyMode ? "Trade Now" : "Trade"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAskAI(row.symbol, pred, confidence ?? 0)}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableCaption>
          {lastUpdated
            ? isEasyMode
              ? `Last updated ${lastUpdated.toLocaleTimeString()}`
              : `Last refreshed ${lastUpdated.toLocaleTimeString()}`
            : isEasyMode
              ? "Predictions update automatically every 30 seconds"
              : "Forecasts refresh every 30s."}
        </TableCaption>
        </Table>
      </CardContent>
    </Card>
  );
}

