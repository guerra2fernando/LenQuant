/* eslint-disable */
// @ts-nocheck
import React from "react";
import useSWR from "swr";
import { TrendingUp, TrendingDown, Activity, Brain, BookOpen, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { fetcher } from "@/lib/api";

export function ContextPanel() {
  // Use consolidated context endpoint (Phase 2 UX Conciliation)
  const { data: contextData } = useSWR("/api/assistant/context", fetcher, {
    refreshInterval: 30000,
  });

  // Extract context data
  const portfolio = contextData?.portfolio || {};
  const market = contextData?.market || {};
  const opportunities = contextData?.opportunities || {};
  const models = contextData?.models || {};
  const knowledge = contextData?.knowledge || {};

  const totalPositions = portfolio.positions_count || 0;
  const totalPnL = portfolio.total_pnl || 0;
  const opportunitiesCount = opportunities.signals_count || 0;

  // Map status to display values
  const marketStatusMap: { [key: string]: string } = {
    active: "Active",
    limited_data: "Limited Data",
    inactive: "Inactive",
  };
  const marketStatus = marketStatusMap[market.status] || "Unknown";

  const modelsHealthy = models.status === "healthy";
  const modelsStale = models.status === "stale";

  const recentKnowledgeCount = knowledge.recent_insights_count || 0;

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="pt-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          System Context
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Portfolio Status */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${totalPositions > 0 ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-xs font-medium text-muted-foreground">Portfolio</span>
            </div>
            <div className="text-lg font-semibold">
              {totalPositions} {totalPositions === 1 ? 'position' : 'positions'}
            </div>
            <div className={`text-xs flex items-center gap-1 ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalPnL >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)} PnL
            </div>
          </div>

          {/* Market Status */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${marketStatus === "Active" ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-xs font-medium text-muted-foreground">Market</span>
            </div>
            <div className="text-lg font-semibold">{marketStatus}</div>
            <div className="text-xs text-muted-foreground">
              {market.forecasts_count || 0} forecasts
            </div>
          </div>

          {/* Opportunities */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${opportunitiesCount > 0 ? 'bg-blue-500' : 'bg-gray-400'}`} />
              <span className="text-xs font-medium text-muted-foreground">Opportunities</span>
            </div>
            <div className="text-lg font-semibold">{opportunitiesCount}</div>
            <div className="text-xs text-muted-foreground">
              {opportunitiesCount > 0 ? 'High confidence' : 'No signals'}
            </div>
          </div>

          {/* Model Health */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              {modelsHealthy ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
              )}
              <span className="text-xs font-medium text-muted-foreground">Models</span>
            </div>
            <div className="text-lg font-semibold">
              {modelsHealthy ? 'Healthy' : modelsStale ? 'Stale' : 'Pending'}
            </div>
            <div className="text-xs text-muted-foreground">
              {models.trained_count || 0} trained
            </div>
          </div>

          {/* Knowledge Base */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Knowledge</span>
            </div>
            <div className="text-lg font-semibold">{recentKnowledgeCount}</div>
            <div className="text-xs text-muted-foreground">
              Recent insights
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

