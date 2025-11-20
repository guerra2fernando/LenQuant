/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from "react";
import { Activity, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildApiUrl } from "@/lib/api";

interface SystemHealth {
  status: "healthy" | "degraded" | "down" | "unknown";
  timestamp: string;
  components: {
    mongodb?: { status: string; message: string };
    redis?: { status: string; message: string };
    celery_workers?: { status: string; message: string; active_workers: number; workers?: string[] };
  };
  metrics?: {
    last_24h_jobs_total: number;
    last_24h_jobs_completed: number;
    last_24h_jobs_failed: number;
    last_24h_jobs_in_progress: number;
    average_job_duration_seconds: number;
    failure_rate_percent: number;
  };
  issues?: string[];
}

export function SystemHealthBadge() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    fetchHealth();
    // Refresh health every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    try {
      const url = buildApiUrl("/api/data-ingestion/health");
      const response = await fetch(url);
      const data = await response.json();
      setHealth(data);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to fetch system health:", err);
      setHealth({
        status: "unknown",
        timestamp: new Date().toISOString(),
        components: {},
        issues: ["Cannot connect to API"],
      });
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Badge variant="outline" className="cursor-pointer">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Checking...
      </Badge>
    );
  }

  if (!health) {
    return (
      <Badge variant="outline" className="cursor-pointer">
        <AlertCircle className="h-3 w-3 mr-1" />
        Unknown
      </Badge>
    );
  }

  const statusConfig = {
    healthy: {
      icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
      variant: "default" as const,
      label: "Healthy",
      color: "text-green-600",
    },
    degraded: {
      icon: <AlertCircle className="h-3 w-3 mr-1" />,
      variant: "secondary" as const,
      label: "Degraded",
      color: "text-yellow-600",
    },
    down: {
      icon: <AlertCircle className="h-3 w-3 mr-1" />,
      variant: "destructive" as const,
      label: "Down",
      color: "text-red-600",
    },
    unknown: {
      icon: <AlertCircle className="h-3 w-3 mr-1" />,
      variant: "outline" as const,
      label: "Unknown",
      color: "text-gray-600",
    },
  };

  const config = statusConfig[health.status] || statusConfig.unknown;

  return (
    <div>
      <Badge
        variant={config.variant}
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {config.icon}
        System {config.label}
      </Badge>

      {isExpanded && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              System Health Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Components Status */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Components</h4>
              <div className="grid gap-2">
                {health.components.mongodb && (
                  <div className="flex items-center justify-between text-sm">
                    <span>MongoDB</span>
                    <Badge
                      variant={
                        health.components.mongodb.status === "healthy"
                          ? "default"
                          : "destructive"
                      }
                    >
                      {health.components.mongodb.status}
                    </Badge>
                  </div>
                )}
                {health.components.redis && (
                  <div className="flex items-center justify-between text-sm">
                    <span>Redis</span>
                    <Badge
                      variant={
                        health.components.redis.status === "healthy"
                          ? "default"
                          : "destructive"
                      }
                    >
                      {health.components.redis.status}
                    </Badge>
                  </div>
                )}
                {health.components.celery_workers && (
                  <div className="flex items-center justify-between text-sm">
                    <span>Celery Workers</span>
                    <Badge
                      variant={
                        health.components.celery_workers.status === "healthy"
                          ? "default"
                          : "destructive"
                      }
                    >
                      {health.components.celery_workers.active_workers} active
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Metrics */}
            {health.metrics && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Last 24 Hours</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Jobs Total</div>
                    <div className="text-lg font-medium">
                      {health.metrics.last_24h_jobs_total}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Completed</div>
                    <div className="text-lg font-medium text-green-600">
                      {health.metrics.last_24h_jobs_completed}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Failed</div>
                    <div className="text-lg font-medium text-red-600">
                      {health.metrics.last_24h_jobs_failed}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Failure Rate</div>
                    <div className="text-lg font-medium">
                      {health.metrics.failure_rate_percent.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground pt-2">
                  Avg duration: {health.metrics.average_job_duration_seconds}s per job
                </div>
              </div>
            )}

            {/* Issues */}
            {health.issues && health.issues.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-destructive">Issues</h4>
                <ul className="list-disc list-inside text-sm text-destructive space-y-1">
                  {health.issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-xs text-muted-foreground pt-2">
              Last checked: {new Date(health.timestamp).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

