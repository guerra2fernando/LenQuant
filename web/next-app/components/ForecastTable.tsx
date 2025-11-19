import { ConfidenceIndicator } from "@/components/ConfidenceIndicator";
import { EmptyState } from "@/components/EmptyState";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { SymbolDisplay } from "@/components/CryptoSelector";
import { Badge } from "@/components/ui/badge";
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={5}>
                <div className="animate-pulse py-6 text-sm text-muted-foreground">Loading forecasts…</div>
              </TableCell>
            </TableRow>
          )}

          {!isLoading && data.length === 0 && (
            <TableRow>
              <TableCell colSpan={isEasyMode ? 6 : 6} className="p-0">
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

            return (
              <TableRow key={`${row.symbol}-${row.timestamp}`} className={cn(row.error && "bg-destructive/10")}>
                <TableCell>
                  <SymbolDisplay symbol={row.symbol} />
                </TableCell>
                <TableCell>
                  {row.error ? (
                    <span className="text-sm text-destructive">{row.error}</span>
                  ) : pred !== null ? (
                    <span className={pred >= 0 ? "text-emerald-500" : "text-destructive"}>
                      {(pred * 100).toFixed(2)}%
                    </span>
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

