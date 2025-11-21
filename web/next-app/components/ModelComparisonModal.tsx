/* eslint-disable */
// @ts-nocheck
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModelHealthBadge } from "@/components/ModelHealthBadge";
import { TrendingUp, TrendingDown, Minus, CheckCircle, XCircle } from "lucide-react";
import type { ModelRegistryRecord } from "@/components/ModelRegistryTable";

type Props = {
  models: ModelRegistryRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ModelComparisonModal({ models, open, onOpenChange }: Props) {
  if (models.length < 2) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Model Comparison</DialogTitle>
            <DialogDescription>Select at least 2 models to compare</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const getMetricComparison = (metric: "rmse" | "mae" | "directional_accuracy") => {
    const values = models
      .map((m, idx) => ({
        idx,
        value: m.metrics?.test?.[metric],
      }))
      .filter((v) => v.value !== undefined);

    if (values.length === 0) return null;

    // For RMSE/MAE, lower is better. For directional_accuracy, higher is better
    const isBetterHigher = metric === "directional_accuracy";
    const bestValue = isBetterHigher
      ? Math.max(...values.map((v) => v.value!))
      : Math.min(...values.map((v) => v.value!));

    return values.map((v) => ({
      modelIdx: v.idx,
      value: v.value,
      isBest: v.value === bestValue,
      isWorst:
        v.value ===
        (isBetterHigher ? Math.min(...values.map((v) => v.value!)) : Math.max(...values.map((v) => v.value!))),
    }));
  };

  const rmseComparison = getMetricComparison("rmse");
  const maeComparison = getMetricComparison("mae");
  const dirAccComparison = getMetricComparison("directional_accuracy");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Model Comparison</DialogTitle>
          <DialogDescription>
            Comparing {models.length} models side-by-side
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-medium mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {models.map((model, idx) => (
                <Card key={idx} className="border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Model {idx + 1}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Model ID</p>
                      <p className="text-xs font-mono">{model.model_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Symbol</p>
                      <Badge variant="secondary">{model.symbol}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Horizon</p>
                      <Badge variant="outline">{model.horizon}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Algorithm</p>
                      <p className="text-xs">{model.algorithm || "Unknown"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Health</p>
                      <ModelHealthBadge trainedAt={model.trained_at} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Trained</p>
                      <p className="text-xs">
                        {model.trained_at
                          ? new Date(model.trained_at).toLocaleDateString()
                          : "Unknown"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          <div>
            <h3 className="text-sm font-medium mb-3">Performance Metrics</h3>
            <div className="space-y-3">
              {/* RMSE */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">RMSE (Root Mean Squared Error)</CardTitle>
                  <p className="text-xs text-muted-foreground">Lower is better</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {models.map((model, idx) => {
                      const comparison = rmseComparison?.find((c) => c.modelIdx === idx);
                      const value = model.metrics?.test?.rmse;
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded border ${
                            comparison?.isBest
                              ? "border-green-500 bg-green-50"
                              : comparison?.isWorst
                                ? "border-red-500 bg-red-50"
                                : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Model {idx + 1}</span>
                            {comparison?.isBest && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            {comparison?.isWorst && <XCircle className="h-4 w-4 text-red-500" />}
                          </div>
                          <p className="text-lg font-semibold mt-1">
                            {value !== undefined ? value.toFixed(4) : "N/A"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* MAE */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">MAE (Mean Absolute Error)</CardTitle>
                  <p className="text-xs text-muted-foreground">Lower is better</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {models.map((model, idx) => {
                      const comparison = maeComparison?.find((c) => c.modelIdx === idx);
                      const value = model.metrics?.test?.mae;
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded border ${
                            comparison?.isBest
                              ? "border-green-500 bg-green-50"
                              : comparison?.isWorst
                                ? "border-red-500 bg-red-50"
                                : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Model {idx + 1}</span>
                            {comparison?.isBest && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            {comparison?.isWorst && <XCircle className="h-4 w-4 text-red-500" />}
                          </div>
                          <p className="text-lg font-semibold mt-1">
                            {value !== undefined ? value.toFixed(4) : "N/A"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Directional Accuracy */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Directional Accuracy</CardTitle>
                  <p className="text-xs text-muted-foreground">Higher is better</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {models.map((model, idx) => {
                      const comparison = dirAccComparison?.find((c) => c.modelIdx === idx);
                      const value = model.metrics?.test?.directional_accuracy;
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded border ${
                            comparison?.isBest
                              ? "border-green-500 bg-green-50"
                              : comparison?.isWorst
                                ? "border-red-500 bg-red-50"
                                : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Model {idx + 1}</span>
                            {comparison?.isBest && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            {comparison?.isWorst && <XCircle className="h-4 w-4 text-red-500" />}
                          </div>
                          <p className="text-lg font-semibold mt-1">
                            {value !== undefined ? `${(value * 100).toFixed(1)}%` : "N/A"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Summary */}
          <Card className="border-blue-500 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {rmseComparison && (
                  <li>
                    • <strong>Best RMSE:</strong> Model {rmseComparison.find((c) => c.isBest)!.modelIdx + 1} (
                    {rmseComparison.find((c) => c.isBest)!.value!.toFixed(4)})
                  </li>
                )}
                {maeComparison && (
                  <li>
                    • <strong>Best MAE:</strong> Model {maeComparison.find((c) => c.isBest)!.modelIdx + 1} (
                    {maeComparison.find((c) => c.isBest)!.value!.toFixed(4)})
                  </li>
                )}
                {dirAccComparison && (
                  <li>
                    • <strong>Best Directional Accuracy:</strong> Model{" "}
                    {dirAccComparison.find((c) => c.isBest)!.modelIdx + 1} (
                    {(dirAccComparison.find((c) => c.isBest)!.value! * 100).toFixed(1)}%)
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

