// @ts-nocheck
import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Lightbulb,
  BarChart3
} from "lucide-react";
import { postJson } from "@/lib/api";
import { formatPercent } from "@/lib/utils";

interface SignalExplanationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  horizon: string;
  forecast_id?: string;
  initialData?: {
    confidence: number;
    predicted_return: number;
    direction: "buy" | "sell";
  };
}

export function SignalExplanationModal({
  open,
  onOpenChange,
  symbol,
  horizon,
  forecast_id,
  initialData,
}: SignalExplanationModalProps) {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch explanation when modal opens
  const fetchExplanation = async () => {
    if (explanation && !loading) return; // Already fetched

    setLoading(true);
    setError(null);

    try {
      const response = await postJson("/api/forecast/explain", {
        symbol,
        horizon,
        forecast_id,
      });
      setExplanation(response);
    } catch (err: any) {
      setError(err.message || "Failed to generate explanation");
    } finally {
      setLoading(false);
    }
  };

  // Fetch when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !explanation) {
      fetchExplanation();
    }
  };

  const predReturn = explanation?.predicted_return ?? initialData?.predicted_return ?? 0;
  const confidence = explanation?.confidence ?? initialData?.confidence ?? 0;
  const direction = predReturn >= 0 ? "buy" : "sell";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Why This Signal?
          </DialogTitle>
          <DialogDescription>
            AI-powered explanation for {symbol} {horizon} forecast
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Analyzing forecast and generating explanation...
                  </p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">Failed to Generate Explanation</p>
                    <p className="text-sm text-destructive/90 mt-1">{error}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchExplanation}
                  className="mt-3"
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Explanation Content */}
            {explanation && !loading && (
              <>
                {/* Summary Section */}
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    {direction === "buy" ? (
                      <TrendingUp className="h-6 w-6 text-green-500 mt-0.5" />
                    ) : (
                      <TrendingDown className="h-6 w-6 text-red-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">
                          {direction === "buy" ? "Bullish" : "Bearish"} Signal
                        </h3>
                        <Badge variant={confidence >= 0.8 ? "default" : "secondary"}>
                          {formatPercent(confidence)} Confidence
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {explanation.explanation?.summary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Key Factors */}
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Key Factors
                  </h4>
                  <ul className="space-y-2">
                    {explanation.explanation?.key_factors?.map((factor: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Model Agreement */}
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    Model Consensus
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Agreement</span>
                          <span className="font-medium">
                            {explanation.explanation?.models_agreement?.agree ?? 0} models
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{
                              width: `${
                                ((explanation.explanation?.models_agreement?.agree ?? 0) /
                                  ((explanation.explanation?.models_agreement?.agree ?? 0) +
                                    (explanation.explanation?.models_agreement?.disagree ?? 1))) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {explanation.explanation?.models_agreement?.details}
                    </p>
                  </div>
                </div>

                {/* Historical Context */}
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-purple-500" />
                    Historical Context
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {explanation.explanation?.historical_context}
                  </p>
                </div>

                {/* Risks */}
                {explanation.explanation?.risks && explanation.explanation.risks.length > 0 && (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
                      <AlertTriangle className="h-4 w-4" />
                      Risk Considerations
                    </h4>
                    <ul className="space-y-2">
                      {explanation.explanation.risks.map((risk: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-yellow-700 dark:text-yellow-500/90">
                          <span className="mt-0.5">⚠️</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer Disclaimer */}
                <div className="rounded-lg border-l-4 border-muted-foreground/30 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    <strong>Disclaimer:</strong> AI predictions are based on historical patterns and 
                    statistical models. Past performance does not guarantee future results. Always use 
                    proper risk management and never invest more than you can afford to lose.
                  </p>
                </div>

                {/* Generated Timestamp */}
                <div className="text-center text-xs text-muted-foreground">
                  Generated at {new Date(explanation.generated_at).toLocaleString()}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {explanation && (
            <Button onClick={() => {
              // Navigate to terminal with this signal pre-filled
              const router = window.next?.router;
              if (router) {
                router.push(
                  `/terminal?symbol=${encodeURIComponent(symbol)}&action=${direction}&source=forecast&confidence=${Math.round(confidence * 100)}`
                );
              }
              onOpenChange(false);
            }}>
              Trade This Signal
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

