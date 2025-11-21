/* eslint-disable */
// @ts-nocheck
import React from "react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { BarChart3, TrendingUp, Brain, Activity, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/api";

export function AnalyticsSummaryCard() {
  const router = useRouter();

  const { data: forecastsData } = useSWR("/api/forecast/batch?limit=50", fetcher, {
    refreshInterval: 30000,
  });
  const { data: strategiesData } = useSWR("/api/strategies/performance/summary", fetcher, {
    refreshInterval: 30000,
  });
  const { data: modelsData } = useSWR("/api/models/training/status", fetcher, {
    refreshInterval: 30000,
  });

  const totalForecasts = forecastsData?.forecasts?.length || 0;
  const highConfidenceForecasts = forecastsData?.forecasts?.filter(
    (f) => (f.confidence || 0) >= 0.80
  ).length || 0;

  const totalStrategies = strategiesData?.strategies?.length || 0;
  const profitableStrategies = strategiesData?.strategies?.filter(
    (s) => (s.total_pnl || 0) > 0
  ).length || 0;

  const trainedModels = modelsData?.trained_count || 0;
  const modelsHealthy = modelsData?.status === "trained" && trainedModels > 0;

  // Calculate system activity score
  const activityScore = Math.round(
    (totalForecasts > 0 ? 33 : 0) +
    (totalStrategies > 0 ? 33 : 0) +
    (modelsHealthy ? 34 : 0)
  );

  const getActivityColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-blue-600";
    return "text-yellow-600";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics Summary
            </CardTitle>
            <CardDescription>Quick overview of system analytics</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/analytics")}
          >
            View All <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Activity Score */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Activity className={`h-5 w-5 ${getActivityColor(activityScore)}`} />
            <div>
              <div className="text-sm font-medium">System Activity</div>
              <div className="text-xs text-muted-foreground">
                {activityScore >= 80 && "All systems active"}
                {activityScore >= 50 && activityScore < 80 && "Partially active"}
                {activityScore < 50 && "Limited activity"}
              </div>
            </div>
          </div>
          <div className={`text-2xl font-bold ${getActivityColor(activityScore)}`}>
            {activityScore}%
          </div>
        </div>

        {/* Quick Metrics */}
        <div className="grid grid-cols-3 gap-3">
          {/* Forecasts */}
          <div 
            className="p-3 rounded-lg border hover:border-primary/40 transition-colors cursor-pointer"
            onClick={() => router.push("/analytics?tab=forecasts")}
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-muted-foreground">Forecasts</span>
            </div>
            <div className="text-xl font-bold">{totalForecasts}</div>
            {highConfidenceForecasts > 0 && (
              <div className="text-xs text-green-600 mt-1">
                +{highConfidenceForecasts} high conf.
              </div>
            )}
          </div>

          {/* Strategies */}
          <div 
            className="p-3 rounded-lg border hover:border-primary/40 transition-colors cursor-pointer"
            onClick={() => router.push("/analytics?tab=strategies")}
          >
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-muted-foreground">Strategies</span>
            </div>
            <div className="text-xl font-bold">{totalStrategies}</div>
            {profitableStrategies > 0 && (
              <div className="text-xs text-green-600 mt-1">
                {profitableStrategies} profitable
              </div>
            )}
          </div>

          {/* Models */}
          <div 
            className="p-3 rounded-lg border hover:border-primary/40 transition-colors cursor-pointer"
            onClick={() => router.push("/models/registry")}
          >
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-orange-600" />
              <span className="text-xs font-medium text-muted-foreground">Models</span>
            </div>
            <div className="text-xl font-bold">{trainedModels}</div>
            <div className={`text-xs mt-1 ${modelsHealthy ? 'text-green-600' : 'text-yellow-600'}`}>
              {modelsHealthy ? 'Healthy' : 'Needs training'}
            </div>
          </div>
        </div>

        {/* CTA */}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => router.push("/analytics")}
        >
          Open Analytics Dashboard
        </Button>
      </CardContent>
    </Card>
  );
}

