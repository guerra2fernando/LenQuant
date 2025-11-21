/* eslint-disable */
// @ts-nocheck
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, TrendingUp, TrendingDown, CheckCircle, GitBranch } from "lucide-react";

type ModelVersion = {
  version: number;
  model_id: string;
  trained_at: string;
  metrics: {
    test?: {
      rmse?: number;
      mae?: number;
      directional_accuracy?: number;
    };
  };
  status: "active" | "archived" | "deprecated";
  notes?: string;
  parent_version?: number;
};

type Props = {
  versions: ModelVersion[];
  currentVersion?: number;
  onRestore?: (version: number) => void;
};

export function ModelVersionHistory({ versions, currentVersion, onRestore }: Props) {
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  const getVersionComparison = (version: ModelVersion, previousVersion?: ModelVersion) => {
    if (!previousVersion || !version.metrics?.test || !previousVersion.metrics?.test) {
      return null;
    }

    const rmseChange =
      version.metrics.test.rmse && previousVersion.metrics.test.rmse
        ? ((version.metrics.test.rmse - previousVersion.metrics.test.rmse) /
            previousVersion.metrics.test.rmse) *
          100
        : null;

    const dirAccChange =
      version.metrics.test.directional_accuracy && previousVersion.metrics.test.directional_accuracy
        ? ((version.metrics.test.directional_accuracy -
            previousVersion.metrics.test.directional_accuracy) /
            previousVersion.metrics.test.directional_accuracy) *
          100
        : null;

    return { rmseChange, dirAccChange };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Model Version History
        </CardTitle>
        <CardDescription>
          Track model evolution and performance across versions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {sortedVersions.map((version, idx) => {
              const previousVersion = sortedVersions[idx + 1];
              const comparison = getVersionComparison(version, previousVersion);
              const isCurrent = version.version === currentVersion;

              return (
                <div
                  key={version.version}
                  className={`relative pl-6 pb-4 border-l-2 ${
                    isCurrent ? "border-l-green-500" : "border-l-gray-200"
                  } ${idx === sortedVersions.length - 1 ? "border-l-transparent" : ""}`}
                >
                  {/* Timeline Dot */}
                  <div
                    className={`absolute left-[-9px] top-0 h-4 w-4 rounded-full border-2 ${
                      isCurrent
                        ? "border-green-500 bg-green-500"
                        : version.status === "active"
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300 bg-white"
                    }`}
                  />

                  <div className="space-y-2">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Version {version.version}</span>
                          {isCurrent && (
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Current
                            </Badge>
                          )}
                          {version.status === "active" && !isCurrent && (
                            <Badge variant="secondary">Active</Badge>
                          )}
                          {version.status === "deprecated" && (
                            <Badge variant="outline" className="text-red-600 border-red-600">
                              Deprecated
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          {new Date(version.trained_at).toLocaleString()}
                        </div>
                      </div>
                      {!isCurrent && version.status === "active" && onRestore && (
                        <Button size="sm" variant="outline" onClick={() => onRestore(version.version)}>
                          Restore
                        </Button>
                      )}
                    </div>

                    {/* Metrics */}
                    {version.metrics?.test && (
                      <div className="grid grid-cols-3 gap-3 pt-2">
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">RMSE</p>
                          <div className="flex items-center gap-1">
                            <p className="font-medium">
                              {version.metrics.test.rmse?.toFixed(4) || "N/A"}
                            </p>
                            {comparison?.rmseChange !== null && (
                              <span
                                className={`text-xs flex items-center ${
                                  comparison.rmseChange < 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {comparison.rmseChange < 0 ? (
                                  <TrendingDown className="h-3 w-3" />
                                ) : (
                                  <TrendingUp className="h-3 w-3" />
                                )}
                                {Math.abs(comparison.rmseChange).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">MAE</p>
                          <p className="font-medium">
                            {version.metrics.test.mae?.toFixed(4) || "N/A"}
                          </p>
                        </div>
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">Dir. Acc.</p>
                          <div className="flex items-center gap-1">
                            <p className="font-medium">
                              {version.metrics.test.directional_accuracy
                                ? `${(version.metrics.test.directional_accuracy * 100).toFixed(1)}%`
                                : "N/A"}
                            </p>
                            {comparison?.dirAccChange !== null && (
                              <span
                                className={`text-xs flex items-center ${
                                  comparison.dirAccChange > 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {comparison.dirAccChange > 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {Math.abs(comparison.dirAccChange).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {version.notes && (
                      <div className="text-xs text-muted-foreground pt-1">
                        <p>📝 {version.notes}</p>
                      </div>
                    )}

                    {/* Parent Version */}
                    {version.parent_version && (
                      <div className="text-xs text-muted-foreground">
                        <p>↳ Derived from version {version.parent_version}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

