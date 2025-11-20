/* eslint-disable */
// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { CheckCircle2, XCircle, Clock, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/api";
import type { BatchJobStatus, IngestionJob } from "@/types/data-ingestion";

interface DataIngestionDashboardProps {
  jobId: string;
  onComplete?: () => void;
}

export function DataIngestionDashboard({ jobId, onComplete }: DataIngestionDashboardProps) {
  const [batchStatus, setBatchStatus] = useState<BatchJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Connect to SSE stream for real-time updates
    const url = buildApiUrl(`/api/data-ingestion/stream-batch-status/${jobId}`);
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setBatchStatus(data);
        setIsLoading(false);
        setError(null);
      } catch (err) {
        console.error("Failed to parse SSE data:", err);
        setError("Failed to parse status update");
      }
    };

    eventSource.addEventListener("done", () => {
      console.log("Ingestion complete, closing SSE connection");
      eventSource.close();
      if (onComplete) {
        onComplete();
      }
    });

    eventSource.addEventListener("error", (event) => {
      console.error("SSE error:", event);
      setError("Connection lost. Refreshing...");
      eventSource.close();
      // Retry connection after 3 seconds
      setTimeout(() => {
        setError(null);
        window.location.reload();
      }, 3000);
    });

    eventSourceRef.current = eventSource;

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [jobId, onComplete]);

  if (isLoading && !batchStatus) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading status...</span>
      </div>
    );
  }

  if (error && !batchStatus) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <span className="font-medium text-destructive">{error}</span>
        </div>
      </div>
    );
  }

  if (!batchStatus) {
    return (
      <div className="text-sm text-muted-foreground">No data available</div>
    );
  }

  const isComplete = batchStatus.completed === batchStatus.total_jobs;
  const hasFailures = batchStatus.failed > 0;
  const allJobs = batchStatus.child_jobs || [];

  return (
    <div className="space-y-6">
      {/* Overall Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Data Ingestion Progress</span>
            <Badge
              variant={
                isComplete
                  ? hasFailures
                    ? "destructive"
                    : "default"
                  : "secondary"
              }
            >
              {batchStatus.completed} / {batchStatus.total_jobs} Complete
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={batchStatus.overall_progress_pct} className="h-3" />
          
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {batchStatus.in_progress}
              </div>
              <div className="text-sm text-muted-foreground">In Progress</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {batchStatus.completed}
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {batchStatus.failed}
              </div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">
                {batchStatus.pending}
              </div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </div>

          {isComplete && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              {hasFailures ? (
                <div className="flex items-center justify-between gap-4">
                  <p className="text-destructive">
                    ⚠️ Ingestion completed with {batchStatus.failed} failed job(s). You can retry failed jobs below.
                  </p>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      try {
                        const url = buildApiUrl(`/api/data-ingestion/retry-batch/${jobId}`);
                        const response = await fetch(url, { method: "POST" });
                        const result = await response.json();
                        if (result.retried > 0) {
                          alert(`Retried ${result.retried} job(s). Refreshing...`);
                          window.location.reload();
                        } else if (result.skipped > 0) {
                          alert(`All failed jobs have reached maximum retry limit (${result.skipped} skipped).`);
                        } else {
                          alert("No failed jobs to retry.");
                        }
                      } catch (err) {
                        console.error("Failed to retry batch:", err);
                        alert("Failed to retry jobs. Please try again.");
                      }
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry All Failed ({batchStatus.failed})
                  </Button>
                </div>
              ) : (
                <p className="text-primary">
                  ✓ All ingestion jobs completed successfully! Your data is ready to use.
                </p>
              )}
            </div>
          )}

          {!isComplete && hasFailures && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const url = buildApiUrl(`/api/data-ingestion/retry-batch/${jobId}`);
                    const response = await fetch(url, { method: "POST" });
                    const result = await response.json();
                    if (result.retried > 0) {
                      alert(`Retried ${result.retried} job(s). Monitoring progress...`);
                    } else if (result.skipped > 0) {
                      alert(`Some jobs have reached maximum retry limit (${result.skipped} skipped).`);
                    }
                  } catch (err) {
                    console.error("Failed to retry batch:", err);
                    alert("Failed to retry jobs. Please try again.");
                  }
                }}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry All Failed ({batchStatus.failed})
              </Button>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Job Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allJobs.map((job) => (
          <JobCard key={job.job_id} job={job} />
        ))}
      </div>
    </div>
  );
}

interface JobCardProps {
  job: IngestionJob;
}

function JobCard({ job }: JobCardProps) {
  const statusConfig = {
    completed: {
      icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
    },
    failed: {
      icon: <XCircle className="h-5 w-5 text-red-600" />,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-900/20",
    },
    in_progress: {
      icon: <Loader2 className="h-5 w-5 animate-spin text-blue-600" />,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    pending: {
      icon: <Clock className="h-5 w-5 text-gray-600" />,
      color: "text-gray-600",
      bgColor: "bg-gray-50 dark:bg-gray-900/20",
    },
    queued: {
      icon: <Clock className="h-5 w-5 text-gray-600" />,
      color: "text-gray-600",
      bgColor: "bg-gray-50 dark:bg-gray-900/20",
    },
    cancelled: {
      icon: <XCircle className="h-5 w-5 text-gray-600" />,
      color: "text-gray-600",
      bgColor: "bg-gray-50 dark:bg-gray-900/20",
    },
  };

  const config = statusConfig[job.status] || statusConfig.pending;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "—";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds || seconds <= 0) return "—";
    if (seconds < 60) return `${Math.round(seconds)}s remaining`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m remaining`;
    return `${Math.round(seconds / 3600)}h remaining`;
  };

  return (
    <Card className={config.bgColor}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-semibold">{job.symbol}</div>
            <div className="text-sm text-muted-foreground">{job.interval}</div>
          </div>
          {config.icon}
        </div>

        {job.status === "in_progress" && (
          <>
            <Progress value={job.progress_pct} className="h-2 mb-2" />
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Progress:</span>
                <span className="font-medium">{job.progress_pct.toFixed(1)}%</span>
              </div>
              {job.records_expected && (
                <div className="flex justify-between">
                  <span>Records:</span>
                  <span className="font-medium">
                    {job.records_fetched.toLocaleString()} / {job.records_expected.toLocaleString()}
                  </span>
                </div>
              )}
              {job.progress_details?.batches_total && (
                <div className="flex justify-between">
                  <span>Batches:</span>
                  <span className="font-medium">
                    {job.progress_details.batches_completed} / {job.progress_details.batches_total}
                  </span>
                </div>
              )}
              {job.progress_details?.estimated_completion_seconds && (
                <div className="flex justify-between">
                  <span>ETA:</span>
                  <span className="font-medium">
                    {formatTimeRemaining(job.progress_details.estimated_completion_seconds)}
                  </span>
                </div>
              )}
              {job.current_step && (
                <div className="mt-2 text-xs italic">
                  {job.current_step.replace(/_/g, " ")}
                </div>
              )}
            </div>
          </>
        )}

        {job.status === "failed" && (
          <div className="space-y-2">
            {job.error_message && (
              <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                {job.error_message}
              </div>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              className="w-full"
              onClick={async () => {
                try {
                  const url = buildApiUrl(`/api/data-ingestion/retry/${job.job_id}`);
                  await fetch(url, { method: "POST" });
                  // Reload the page to see updated status
                  window.location.reload();
                } catch (err) {
                  console.error("Failed to retry job:", err);
                }
              }}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {job.status === "completed" && (
          <div className="text-xs space-y-1">
            <div className="text-green-600 font-medium">
              ✓ {job.records_fetched.toLocaleString()} records
            </div>
            {job.features_generated > 0 && (
              <div className="text-muted-foreground">
                {job.features_generated.toLocaleString()} features
              </div>
            )}
            {job.duration_seconds && (
              <div className="text-muted-foreground">
                Completed in {formatDuration(job.duration_seconds)}
              </div>
            )}
          </div>
        )}

        {(job.status === "pending" || job.status === "queued") && (
          <div className="text-xs text-muted-foreground">
            Waiting to start...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

