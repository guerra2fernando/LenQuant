/* eslint-disable */
// @ts-nocheck
import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, AlertCircle, Clock, Activity } from "lucide-react";
import { fetcher } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

const statusIcons: Record<string, any> = {
  healthy: CheckCircle,
  trained: CheckCircle,
  active: CheckCircle,
  running: Activity,
  aging: Clock,
  stale: AlertCircle,
  pending: AlertCircle,
  inactive: AlertCircle,
  idle: Clock,
};

const statusColors: Record<string, string> = {
  healthy: "text-green-500",
  trained: "text-green-500",
  active: "text-green-500",
  running: "text-blue-500",
  aging: "text-yellow-500",
  stale: "text-orange-500",
  pending: "text-muted-foreground",
  inactive: "text-muted-foreground",
  idle: "text-muted-foreground",
};

export function SystemHealthCard() {
  const { data: health } = useSWR("/api/system/health", fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  if (!health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Monitor key system components</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading system health...</p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      label: "Data Pipeline",
      status: health.data_pipeline?.status || "inactive",
      description: health.data_pipeline?.freshness_hours 
        ? `${health.data_pipeline.symbols_count} symbols, ${health.data_pipeline.freshness_hours.toFixed(1)}h old`
        : "No data",
      link: "/settings?tab=data-ingestion",
    },
    {
      label: "Models",
      status: health.models?.status || "pending",
      description: health.models?.trained_count 
        ? `${health.models.trained_count} trained`
        : "Pending training",
      link: "/models/registry",
    },
    {
      label: "Forecasts",
      status: health.forecasts?.status || "inactive",
      description: health.forecasts?.high_confidence_count 
        ? `${health.forecasts.high_confidence_count} high-confidence`
        : "No forecasts",
      link: "/analytics?tab=forecasts",
    },
    {
      label: "Evolution",
      status: health.evolution?.status || "idle",
      description: health.evolution?.champions_count 
        ? `${health.evolution.champions_count} champions, queue: ${health.evolution.queue_size || 0}`
        : "No champions yet",
      link: "/analytics?tab=evolution",
    },
  ];

  const overallColor = 
    health.overall_status === "healthy" ? "text-green-500" :
    health.overall_status === "degraded" ? "text-yellow-500" :
    "text-red-500";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Monitor key system components</CardDescription>
          </div>
          <Badge 
            variant={health.overall_status === "healthy" ? "default" : "outline"}
            className={overallColor}
          >
            {health.overall_status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.map((metric, idx) => {
          const Icon = statusIcons[metric.status] || AlertCircle;
          const color = statusColors[metric.status] || "text-muted-foreground";
          
          return (
            <Link key={idx} href={metric.link}>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <div>
                    <div className="text-sm font-medium">{metric.label}</div>
                    <div className="text-xs text-muted-foreground">{metric.description}</div>
                  </div>
                </div>
                <Badge 
                  variant={
                    metric.status === "healthy" || metric.status === "trained" || metric.status === "active" || metric.status === "running"
                      ? "default" 
                      : "outline"
                  }
                >
                  {metric.status}
                </Badge>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
