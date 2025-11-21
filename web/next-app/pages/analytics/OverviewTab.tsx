/* eslint-disable */
// @ts-nocheck
import React from "react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { 
  TrendingUp, 
  BarChart3, 
  Activity, 
  Brain,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  RefreshCw,
  Download
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/api";

export default function OverviewTab() {
  const router = useRouter();
  
  // Use consolidated analytics overview endpoint (Phase 2 UX Conciliation)
  const { data: overviewData, mutate: refreshOverview } = useSWR(
    "/api/analytics/overview", 
    fetcher,
    { refreshInterval: 30000 }
  );

  const handleRefreshAll = async () => {
    await refreshOverview();
  };

  const handleExportAll = () => {
    // Placeholder for export functionality
    window.alert("Export functionality coming soon!");
  };

  // Extract metrics from consolidated endpoint
  const forecasts = overviewData?.forecasts || {};
  const strategies = overviewData?.strategies || {};
  const learning = overviewData?.learning || {};
  const systemHealth = overviewData?.system_health || {};
  
  const totalForecasts = forecasts.total_count || 0;
  const highConfidenceForecasts = forecasts.high_confidence_count || 0;
  const avgConfidence = forecasts.avg_confidence || 0;
  
  const totalStrategies = strategies.total_count || 0;
  const activeStrategies = strategies.active_count || 0;
  const championsCount = strategies.champions_count || 0;
  const profitableStrategies = championsCount; // Use champions as proxy for profitable
  
  const trainedModels = totalStrategies > 0 ? totalStrategies : 0;
  const modelStatus = totalForecasts > 0 ? "trained" : "pending";
  const lastTraining = forecasts.last_updated;
  const modelsHealthy = totalForecasts > 0 && totalStrategies > 0;
  
  const recentInsights = learning.improvements_count || 0;

  // System health score (0-100)
  const healthScore = Math.round(
    (modelsHealthy ? 30 : 0) +
    (totalForecasts > 0 ? 25 : 0) +
    (activeStrategies > 0 ? 25 : 0) +
    (recentInsights > 0 ? 20 : 0)
  );

  const getHealthStatus = (score: number) => {
    if (score >= 80) return { label: "Excellent", color: "text-green-600", bg: "bg-green-100" };
    if (score >= 60) return { label: "Good", color: "text-blue-600", bg: "bg-blue-100" };
    if (score >= 40) return { label: "Fair", color: "text-yellow-600", bg: "bg-yellow-100" };
    return { label: "Needs Attention", color: "text-red-600", bg: "bg-red-100" };
  };

  const healthStatus = getHealthStatus(healthScore);

  return (
    <div className="space-y-6">
      {/* Action Toolbar */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Analytics Dashboard</h3>
              <p className="text-sm text-muted-foreground">
                System-wide overview of all analytics components
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRefreshAll}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh All
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleExportAll}
              >
                <Download className="h-4 w-4 mr-1" />
                Export All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Health Scorecard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health Score
          </CardTitle>
          <CardDescription>
            Overall health assessment across all analytics components
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-gray-200"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - healthScore / 100)}`}
                      className={healthStatus.color}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold">{healthScore}</span>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${healthStatus.bg} ${healthStatus.color}`}>
                    {healthStatus.label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {healthScore >= 80 && "All systems operating optimally. Continue monitoring for best results."}
                  {healthScore >= 60 && healthScore < 80 && "System is performing well with minor areas for improvement."}
                  {healthScore >= 40 && healthScore < 60 && "System needs attention in some areas. Review recommendations below."}
                  {healthScore < 40 && "Multiple systems need immediate attention. Review critical issues below."}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Forecasts */}
        <Card className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => router.push("/analytics?tab=forecasts")}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Forecasts</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{totalForecasts}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {highConfidenceForecasts > 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    {highConfidenceForecasts} high confidence
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Avg: {(avgConfidence * 100).toFixed(0)}% confidence
              </div>
              <Button variant="link" size="sm" className="p-0 h-auto text-xs">
                View Details <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Strategies */}
        <Card className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => router.push("/analytics?tab=strategies")}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Strategies</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{totalStrategies}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-blue-600">{activeStrategies} active</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-green-600">{profitableStrategies} profitable</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {totalStrategies > 0 ? `${((profitableStrategies / totalStrategies) * 100).toFixed(0)}% win rate` : "No data"}
              </div>
              <Button variant="link" size="sm" className="p-0 h-auto text-xs">
                View Details <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Models */}
        <Card className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => router.push("/models/registry")}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">AI Models</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{trainedModels}</div>
              <div className="flex items-center gap-2 text-xs">
                {modelsHealthy ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Healthy
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <AlertTriangle className="h-3 w-3" />
                    {modelStatus}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lastTraining ? new Date(lastTraining).toLocaleDateString() : "Never trained"}
              </div>
              <Button variant="link" size="sm" className="p-0 h-auto text-xs">
                View Details <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Learning Insights */}
        <Card className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => router.push("/analytics?tab=insights")}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Learning Insights</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{recentInsights}</div>
              <div className="text-xs text-muted-foreground">
                Recent knowledge entries
              </div>
              <div className="text-xs text-muted-foreground">
                System learning updates
              </div>
              <Button variant="link" size="sm" className="p-0 h-auto text-xs">
                View Details <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {healthScore < 80 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {!modelsHealthy && (
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600">•</span>
                  <span>
                    <strong>Train AI Models:</strong> Models need training or updates to ensure accurate forecasts.
                  </span>
                </li>
              )}
              {totalForecasts === 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600">•</span>
                  <span>
                    <strong>Generate Forecasts:</strong> No forecasts available. Ensure data ingestion and models are ready.
                  </span>
                </li>
              )}
              {activeStrategies === 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600">•</span>
                  <span>
                    <strong>Activate Strategies:</strong> No active trading strategies. Review and activate strategies to begin trading.
                  </span>
                </li>
              )}
              {recentInsights === 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600">•</span>
                  <span>
                    <strong>Review Learning:</strong> No recent learning insights. Check knowledge base for system updates.
                  </span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

