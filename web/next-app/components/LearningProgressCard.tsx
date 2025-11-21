/* eslint-disable */
// @ts-nocheck
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, TrendingUp, Sparkles, CheckCircle, Clock, Loader2 } from "lucide-react";
import { fetcher } from "@/lib/api";
import { useRouter } from "next/router";

type LearningStatus = {
  models?: {
    status: "idle" | "training" | "complete" | "error";
    progress?: number;
    current?: string;
    total?: number;
    completed?: number;
    eta_seconds?: number;
    trained_at?: string;
  };
  forecasts?: {
    status: "idle" | "generating" | "complete" | "error";
    progress?: number;
    count?: number;
    high_confidence_count?: number;
    generated_at?: string;
  };
  knowledge?: {
    status: "idle" | "processing" | "complete" | "error";
    insights_count?: number;
    last_update?: string;
  };
};

export function LearningProgressCard() {
  const router = useRouter();
  const { data, error, mutate } = useSWR<LearningStatus>("/api/learning/status", fetcher, {
    refreshInterval: 5000, // Refresh every 5 seconds for real-time updates
    revalidateOnFocus: true,
  });

  const [showComplete, setShowComplete] = useState(false);

  const isLoading = !data && !error;
  const hasActiveProcess =
    data?.models?.status === "training" ||
    data?.forecasts?.status === "generating" ||
    data?.knowledge?.status === "processing";

  useEffect(() => {
    // Show completion notification when all processes complete
    if (
      data?.models?.status === "complete" &&
      data?.forecasts?.status === "complete" &&
      data?.knowledge?.status === "complete"
    ) {
      setShowComplete(true);
      const timer = setTimeout(() => setShowComplete(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (isLoading) {
    return null; // Don't show card while loading initially
  }

  if (!hasActiveProcess && !showComplete) {
    return null; // Hide card when nothing is happening
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "training":
      case "generating":
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "complete":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <span className="h-4 w-4 text-red-500">⚠️</span>;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "training":
        return "Training";
      case "generating":
        return "Generating";
      case "processing":
        return "Processing";
      case "complete":
        return "Complete";
      case "error":
        return "Error";
      default:
        return "Idle";
    }
  };

  const formatETA = (seconds?: number) => {
    if (!seconds) return null;
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg">Learning in Progress</CardTitle>
          </div>
          {hasActiveProcess && (
            <Badge variant="outline" className="border-blue-500 text-blue-600">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Active
            </Badge>
          )}
          {showComplete && (
            <Badge variant="outline" className="border-green-500 text-green-600">
              <CheckCircle className="mr-1 h-3 w-3" />
              Complete
            </Badge>
          )}
        </div>
        <CardDescription>
          {hasActiveProcess
            ? "AI is training models and generating forecasts..."
            : "All learning processes completed successfully"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Model Training */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(data?.models?.status)}
              <span className="text-sm font-medium">Model Training</span>
              <Badge variant="secondary" className="text-xs">
                {getStatusLabel(data?.models?.status)}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {data?.models?.completed !== undefined && data?.models?.total !== undefined && (
                <span>
                  {data.models.completed} / {data.models.total}
                </span>
              )}
              {data?.models?.eta_seconds && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatETA(data.models.eta_seconds)}
                </span>
              )}
            </div>
          </div>
          {data?.models?.progress !== undefined && (
            <Progress value={data.models.progress} className="h-2" />
          )}
          {data?.models?.current && (
            <p className="text-xs text-muted-foreground">Training: {data.models.current}</p>
          )}
        </div>

        {/* Forecast Generation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(data?.forecasts?.status)}
              <span className="text-sm font-medium">Forecast Generation</span>
              <Badge variant="secondary" className="text-xs">
                {getStatusLabel(data?.forecasts?.status)}
              </Badge>
            </div>
            {data?.forecasts?.count !== undefined && (
              <span className="text-xs text-muted-foreground">{data.forecasts.count} forecasts</span>
            )}
          </div>
          {data?.forecasts?.progress !== undefined && (
            <Progress value={data.forecasts.progress} className="h-2" />
          )}
          {data?.forecasts?.high_confidence_count !== undefined && (
            <p className="text-xs text-muted-foreground">
              {data.forecasts.high_confidence_count} high-confidence signals
            </p>
          )}
        </div>

        {/* Knowledge Processing */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(data?.knowledge?.status)}
              <span className="text-sm font-medium">Knowledge Generation</span>
              <Badge variant="secondary" className="text-xs">
                {getStatusLabel(data?.knowledge?.status)}
              </Badge>
            </div>
            {data?.knowledge?.insights_count !== undefined && (
              <span className="text-xs text-muted-foreground">
                {data.knowledge.insights_count} insights
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/analytics?tab=forecasts")}
            disabled={data?.forecasts?.status !== "complete"}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            View Forecasts
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/analytics?tab=insights")}
            disabled={data?.knowledge?.status !== "complete"}
          >
            <Brain className="mr-2 h-4 w-4" />
            View Insights
          </Button>
          <Button size="sm" variant="ghost" onClick={() => mutate()}>
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

