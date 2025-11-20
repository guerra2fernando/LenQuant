import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { ErrorMessage } from "@/components/ErrorMessage";
import { ModelRegistryTable, type ModelRegistryRecord } from "@/components/ModelRegistryTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { fetcher, postJson } from "@/lib/api";

type RegistryResponse = {
  items: ModelRegistryRecord[];
};

type ModelRegistryDetail = ModelRegistryRecord & {
  feature_importance?: Array<{ feature: string; importance: number }>;
  shap_summary_top_features?: Array<{ feature: string; importance: number }>;
  evaluation_artifact?: string;
  shap_summary_artifact?: string;
  evaluation_dashboard?: string;
};

function useRegistry(symbol: string, horizon: string) {
  const params = new URLSearchParams();
  if (symbol) params.append("symbol", symbol);
  if (horizon) params.append("horizon", horizon);
  params.append("limit", "50");

  const key = `/api/models/registry?${params.toString()}`;
  return useSWR<RegistryResponse>(key, (url: string) => fetcher<RegistryResponse>(url), {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });
}

export default function ModelRegistryPage() {
  const [symbolFilter, setSymbolFilter] = useState("");
  const [horizonFilter, setHorizonFilter] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useRegistry(symbolFilter, horizonFilter);
  const items = useMemo(() => data?.items ?? [], [data]);

  useEffect(() => {
    if (!selectedModelId && items.length) {
      setSelectedModelId(items[0].model_id);
    } else if (selectedModelId && items.every((item) => item.model_id !== selectedModelId)) {
      setSelectedModelId(items.length ? items[0].model_id : null);
    }
  }, [items, selectedModelId]);

  const { data: selectedModel, error: selectedModelError } = useSWR<ModelRegistryDetail>(
    selectedModelId ? `/api/models/registry/${selectedModelId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  const handleRetrain = async (record: ModelRegistryRecord) => {
    setIsSubmitting(true);
    setActionMessage(null);
    try {
      await postJson("/api/models/retrain", {
        symbol: record.symbol,
        horizon: record.horizon,
        algorithm: record.algorithm?.toLowerCase().includes("lightgbm") ? "lgbm" : "rf",
        promote: false,
      });
      setActionMessage(`Retrain scheduled for ${record.symbol} ${record.horizon}.`);
      mutate();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to schedule retrain.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const featureImportanceMax = useMemo(() => {
    if (!selectedModel?.feature_importance?.length) {
      return 0;
    }
    return Math.max(...selectedModel.feature_importance.map((item) => item.importance ?? 0));
  }, [selectedModel?.feature_importance]);

  const shapImportanceMax = useMemo(() => {
    if (!selectedModel?.shap_summary_top_features?.length) {
      return 0;
    }
    return Math.max(...selectedModel.shap_summary_top_features.map((item) => item.importance ?? 0));
  }, [selectedModel?.shap_summary_top_features]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Model Registry
            <TooltipExplainer 
              term="Model Registry" 
              explanation="The model registry is a catalog of all machine learning models that predict price movements. Each model is trained on specific symbol/timeframe combinations (like BTC/USD 1h). The registry tracks model performance metrics (RMSE, directional accuracy), training dates, and deployment status. Models are periodically retrained with fresh data to maintain accuracy. Think of this as your ML model database and performance tracker."
            />
          </h1>
          <p className="text-sm text-muted-foreground">
            Inspect trained models, compare metrics, and trigger retraining jobs.
          </p>
        </div>
        <Button variant="ghost" onClick={() => mutate()} disabled={isSubmitting || isLoading}>
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Limit the registry feed by symbol or horizon.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="symbol-filter">Symbol</Label>
              <Input
                id="symbol-filter"
                placeholder="e.g. BTC/USD"
                value={symbolFilter}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSymbolFilter(event.target.value.trim().toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="horizon-filter">Horizon</Label>
              <select
                id="horizon-filter"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={horizonFilter}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setHorizonFilter(event.target.value)}
              >
                <option value="">All</option>
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
                <option value="4h">4h</option>
                <option value="1d">1d</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-indicator">Status</Label>
              <Input id="status-indicator" value="Candidate / Production" disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <ErrorMessage
          title="Unable to load registry"
          message={error instanceof Error ? error.message : "Unknown error"}
          error={error}
          onRetry={() => window.location.reload()}
        />
      )}

      {actionMessage && (
        <Card className="border-muted">
          <CardContent className="py-4 text-sm text-muted-foreground">{actionMessage}</CardContent>
        </Card>
      )}

      <ModelRegistryTable
        items={items}
        isLoading={isLoading}
        onRetrain={handleRetrain}
        onSelect={(record) => setSelectedModelId(record.model_id)}
        selectedModelId={selectedModelId}
      />

      {selectedModelError && (
        <ErrorMessage
          title="Failed to load model details"
          message={selectedModelError instanceof Error ? selectedModelError.message : "Unknown error"}
          error={selectedModelError}
        />
      )}

      {selectedModel ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="font-mono text-base">{selectedModel.model_id}</CardTitle>
                <CardDescription>
                  {selectedModel.symbol} • {selectedModel.horizon} • {(selectedModel.status || "candidate").toUpperCase()}
                </CardDescription>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>
                  RMSE: {selectedModel.metrics?.test?.rmse !== undefined ? selectedModel.metrics.test.rmse.toFixed(6) : "—"}
                </div>
                <div>
                  Dir. Acc: {selectedModel.metrics?.test?.directional_accuracy !== undefined
                    ? `${(selectedModel.metrics.test.directional_accuracy * 100).toFixed(1)}%`
                    : "—"}
                </div>
                <div>Trained: {selectedModel.trained_at ? new Date(selectedModel.trained_at).toLocaleString() : "Unknown"}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Feature Importance
                <TooltipExplainer 
                  term="Feature Importance" 
                  explanation="Shows which technical indicators and market data the model relies on most when making predictions. Higher values mean the feature has more influence on the model's decisions. For example, if 'EMA_20' has high importance, the 20-period exponential moving average strongly affects predictions. Use this to understand what your model is paying attention to."
                  size="sm"
                />
              </h3>
              {selectedModel.feature_importance?.length ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {selectedModel.feature_importance.slice(0, 8).map((item) => {
                    const width = featureImportanceMax > 0 ? Math.min(100, (item.importance / featureImportanceMax) * 100) : 0;
                    return (
                      <li key={`fi-${item.feature}`} className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium text-foreground">{item.feature}</span>
                          <span>{item.importance.toFixed(4)}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-sky-500" style={{ width: `${width}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No feature importance logged.</p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                SHAP Top Features
                <TooltipExplainer 
                  term="SHAP Values" 
                  explanation="SHAP (SHapley Additive exPlanations) provides a more sophisticated analysis of feature importance by showing how much each feature contributes to individual predictions on average. Unlike basic feature importance, SHAP accounts for feature interactions. This gives you deeper insight into model decision-making and helps identify if the model learned sensible patterns."
                  size="sm"
                />
              </h3>
              {selectedModel.shap_summary_top_features?.length ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {selectedModel.shap_summary_top_features.slice(0, 8).map((item) => {
                    const width = shapImportanceMax > 0 ? Math.min(100, (item.importance / shapImportanceMax) * 100) : 0;
                    return (
                      <li key={`shap-${item.feature}`} className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium text-foreground">{item.feature}</span>
                          <span>{item.importance.toExponential(2)}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${width}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">SHAP summary not available.</p>
              )}
            </div>

            <div className="lg:col-span-2 space-y-2 text-xs text-muted-foreground">
              {selectedModel.evaluation_artifact ? (
                <p>
                  Evaluation CSV: <span className="font-mono text-foreground">{selectedModel.evaluation_artifact}</span>
                </p>
              ) : null}
              {selectedModel.shap_summary_artifact ? (
                <p>
                  SHAP summary: <span className="font-mono text-foreground">{selectedModel.shap_summary_artifact}</span>
                </p>
              ) : null}
              {selectedModel.evaluation_dashboard ? (
                <p>
                  Evaluation dashboard:{" "}
                  <a
                    className="font-mono text-sky-400 underline hover:text-sky-300"
                    href={selectedModel.evaluation_dashboard}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selectedModel.evaluation_dashboard}
                  </a>
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

