/* eslint-disable */
// @ts-nocheck
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RefreshCw, Clock, CheckCircle } from "lucide-react";
import { ModelHealthBadge } from "@/components/ModelHealthBadge";

type ModelRetrainInfo = {
  model_id: string;
  symbol: string;
  horizon: string;
  trained_at: string;
  age_days: number;
  health: "fresh" | "aging" | "stale";
  recommendation: "no_action" | "consider_retrain" | "retrain_now";
  reason?: string;
  last_forecast_count?: number;
};

type Props = {
  models: ModelRetrainInfo[];
  onRetrain?: (modelId: string) => void;
  onRetrainAll?: () => void;
};

export function ModelRetrainRecommendation({ models, onRetrain, onRetrainAll }: Props) {
  const staleModels = models.filter((m) => m.recommendation === "retrain_now");
  const agingModels = models.filter((m) => m.recommendation === "consider_retrain");
  const freshModels = models.filter((m) => m.recommendation === "no_action");

  const hasRecommendations = staleModels.length > 0 || agingModels.length > 0;

  if (!hasRecommendations && freshModels.length === 0) {
    return null; // Don't render if no models
  }

  return (
    <Card className={hasRecommendations ? "border-l-4 border-l-amber-500" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Model Retrain Recommendations
            </CardTitle>
            <CardDescription>
              {hasRecommendations
                ? `${staleModels.length + agingModels.length} model${staleModels.length + agingModels.length > 1 ? "s" : ""} need attention`
                : "All models are up to date"}
            </CardDescription>
          </div>
          {hasRecommendations && onRetrainAll && (
            <Button size="sm" onClick={onRetrainAll}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retrain All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasRecommendations && (
          <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-md">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">All models are fresh</p>
              <p className="text-xs text-green-700">No retraining needed at this time</p>
            </div>
          </div>
        )}

        {/* Stale Models (Priority) */}
        {staleModels.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <h4 className="text-sm font-medium">Retrain Now ({staleModels.length})</h4>
            </div>
            <div className="space-y-2">
              {staleModels.map((model) => (
                <Card key={model.model_id} className="border-red-200 bg-red-50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{model.symbol}</Badge>
                          <Badge variant="outline">{model.horizon}</Badge>
                          <ModelHealthBadge trainedAt={model.trained_at} showTooltip={false} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          <Clock className="inline h-3 w-3 mr-1" />
                          Model is {model.age_days} days old
                        </p>
                        {model.reason && (
                          <p className="text-xs text-red-700 mt-1">⚠️ {model.reason}</p>
                        )}
                      </div>
                      {onRetrain && (
                        <Button size="sm" variant="destructive" onClick={() => onRetrain(model.model_id)}>
                          <RefreshCw className="mr-2 h-3 w-3" />
                          Retrain
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Aging Models */}
        {agingModels.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-medium">Consider Retraining ({agingModels.length})</h4>
            </div>
            <div className="space-y-2">
              {agingModels.map((model) => (
                <Card key={model.model_id} className="border-amber-200 bg-amber-50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{model.symbol}</Badge>
                          <Badge variant="outline">{model.horizon}</Badge>
                          <ModelHealthBadge trainedAt={model.trained_at} showTooltip={false} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          <Clock className="inline h-3 w-3 mr-1" />
                          Model is {model.age_days} days old
                        </p>
                        {model.reason && (
                          <p className="text-xs text-amber-700 mt-1">💡 {model.reason}</p>
                        )}
                      </div>
                      {onRetrain && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-500 text-amber-700"
                          onClick={() => onRetrain(model.model_id)}
                        >
                          <RefreshCw className="mr-2 h-3 w-3" />
                          Retrain
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {hasRecommendations && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> Regular retraining helps models stay accurate with current market
              conditions. Retrain stale models (7+ days old) immediately and aging models (3+ days) when
              convenient.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

