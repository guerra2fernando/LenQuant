/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { Database, RefreshCw, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataIngestionDashboard } from "@/components/DataIngestionDashboard";
import { DataFreshnessBadge, SymbolFreshnessIndicator } from "@/components/DataFreshnessBadge";
import { SystemHealthBadge } from "@/components/SystemHealthBadge";
import { fetcher, postJson } from "@/lib/api";
import type { SymbolStatus, StartIngestionResponse } from "@/types/data-ingestion";

export default function DataIngestionTab() {
  const router = useRouter();
  const { job_id, section } = router.query;
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch all symbols status
  const { data: symbols, error: symbolsError, mutate } = useSWR<SymbolStatus[]>(
    "/api/data-ingestion/symbols-status",
    fetcher,
    { refreshInterval: job_id ? 5000 : 30000 } // Refresh every 5s if job active, else 30s
  );

  const handleRefreshSymbol = async (symbol: string, intervals: string[]) => {
    setRefreshing(symbol);
    setError(null);
    
    try {
      const response = await postJson<StartIngestionResponse>(
        "/api/data-ingestion/start",
        {
          symbols: [symbol],
          intervals: intervals,
          lookback_days: 30,
          job_type: "manual_refresh"
        }
      );
      
      // Redirect to show progress
      router.push(
        `/settings?section=data-ingestion&job_id=${response.job_id}`,
        undefined,
        { shallow: true }
      );
    } catch (err: any) {
      setError(err.message || "Failed to start refresh");
    } finally {
      setRefreshing(null);
    }
  };

  const handleRefreshAll = async () => {
    if (!symbols || symbols.length === 0) return;
    
    setRefreshing("all");
    setError(null);
    
    try {
      // Get all enabled symbols and their intervals
      const enabledSymbols = symbols.filter(s => s.enabled).map(s => s.symbol);
      const allIntervals = Array.from(
        new Set(
          symbols.flatMap(s => 
            s.intervals_status ? Object.keys(s.intervals_status) : []
          )
        )
      );
      
      if (enabledSymbols.length === 0) {
        setError("No enabled symbols found");
        return;
      }
      
      const response = await postJson<StartIngestionResponse>(
        "/api/data-ingestion/start",
        {
          symbols: enabledSymbols,
          intervals: allIntervals.length > 0 ? allIntervals : ["1m", "5m"],
          lookback_days: 7, // Shorter lookback for refresh
          job_type: "manual_refresh"
        }
      );
      
      // Redirect to show progress
      router.push(
        `/settings?section=data-ingestion&job_id=${response.job_id}`,
        undefined,
        { shallow: true }
      );
    } catch (err: any) {
      setError(err.message || "Failed to start refresh");
    } finally {
      setRefreshing(null);
    }
  };

  // If there's a job_id in the URL, show the dashboard
  if (job_id && typeof job_id === "string") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Data Ingestion Status</h2>
            <p className="text-sm text-muted-foreground">
              Monitor real-time progress of your data ingestion jobs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SystemHealthBadge />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Store the current job_id for later retrieval
                if (typeof window !== 'undefined') {
                  localStorage.setItem('lastViewedIngestionJobId', job_id);
                }
                router.push("/settings?section=data-ingestion", undefined, { shallow: true });
              }}
            >
              <Database className="h-4 w-4 mr-2" />
              View All Symbols
            </Button>
          </div>
        </div>

        <DataIngestionDashboard 
          jobId={job_id} 
          onComplete={() => {
            // Refresh symbols list when ingestion completes
            mutate();
          }}
        />
      </div>
    );
  }

  // Otherwise, show symbol management and status
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Data Management</h2>
          <p className="text-sm text-muted-foreground">
            View data status and refresh market data for your symbols
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SystemHealthBadge />
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              // Try to get the most recent ingestion job from the API
              try {
                const response = await fetch('/api/data-ingestion/recent-jobs?limit=1');
                if (response.ok) {
                  const jobs = await response.json();
                  if (jobs && jobs.length > 0) {
                    const recentJobId = jobs[0].job_id;
                    router.push(`/settings?section=data-ingestion&job_id=${recentJobId}`, undefined, { shallow: true });
                    return;
                  }
                }
              } catch (err) {
                console.error("Failed to fetch recent jobs:", err);
              }
              
              // Fallback: try localStorage
              if (typeof window !== 'undefined') {
                const lastJobId = localStorage.getItem('lastViewedIngestionJobId');
                if (lastJobId) {
                  router.push(`/settings?section=data-ingestion&job_id=${lastJobId}`, undefined, { shallow: true });
                  return;
                }
              }
              
              // No jobs found - show message
              setError("No recent ingestion jobs found. Start a data refresh to see progress.");
            }}
          >
            <Clock className="h-4 w-4 mr-2" />
            View Progress
          </Button>
          <Button
            onClick={handleRefreshAll}
            disabled={refreshing === "all" || !symbols || symbols.length === 0}
            size="sm"
          >
            {refreshing === "all" ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh All
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        </div>
      )}

      {symbolsError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load symbols status. Please try refreshing the page.
          </p>
        </div>
      )}

      {!symbols && !symbolsError && (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading symbols...</span>
        </div>
      )}

      {symbols && symbols.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              No symbols configured yet. Set up your data in Get Started.
            </p>
            <Button onClick={() => router.push("/get-started")}>
              Go to Get Started
            </Button>
          </CardContent>
        </Card>
      )}

      {symbols && symbols.length > 0 && (
        <div className="grid gap-4">
          {symbols.map((symbolData) => (
            <SymbolCard
              key={symbolData.symbol}
              symbolData={symbolData}
              onRefresh={handleRefreshSymbol}
              isRefreshing={refreshing === symbolData.symbol}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About Data Freshness</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span><strong>Fresh:</strong> Latest candle is less than 2 hours old</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span><strong>Aging:</strong> Latest candle is 2-24 hours old</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span><strong>Stale:</strong> Latest candle is more than 24 hours old</span>
          </div>
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs font-medium mb-1">💡 Important Notes:</p>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li>Freshness shows the timestamp of the <strong>actual candle data</strong>, not when you last refreshed</li>
              <li>If data shows as "Stale" even after refresh, the exchange may not have recent data for that symbol/interval</li>
              <li>All timestamps are in UTC (server time may differ from your local timezone)</li>
              <li>Scheduled tasks automatically refresh data every hour if Celery workers are running</li>
            </ul>
          </div>
          <div className="mt-3 p-3 border border-destructive/50 bg-destructive/10 rounded-lg">
            <p className="text-xs font-semibold text-destructive mb-1">🔧 If data is consistently stale:</p>
            <ol className="text-xs space-y-1 list-decimal list-inside text-destructive/90">
              <li>Run the diagnostic: <code className="bg-black/10 px-1 rounded">python scripts/diagnose_stale_data.py</code></li>
              <li>Check that Celery workers are running</li>
              <li>Verify the exchange API is accessible from your server</li>
              <li>Try manually refreshing with a longer lookback period</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface SymbolCardProps {
  symbolData: SymbolStatus;
  onRefresh: (symbol: string, intervals: string[]) => void;
  isRefreshing: boolean;
}

function SymbolCard({ symbolData, onRefresh, isRefreshing }: SymbolCardProps) {
  const intervals = symbolData.intervals_status || {};
  const intervalKeys = Object.keys(intervals).sort();
  
  if (intervalKeys.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{symbolData.symbol}</div>
              <div className="text-sm text-muted-foreground">No data available</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRefresh(symbolData.symbol, ["1m", "5m"])}
              disabled={isRefreshing}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Fetch Data
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <SymbolFreshnessIndicator 
              symbol={symbolData.symbol} 
              intervals={intervals}
            />
            {!symbolData.enabled && (
              <Badge variant="secondary" className="mt-2 text-xs">
                Disabled
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRefresh(symbolData.symbol, intervalKeys)}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {intervalKeys.map((interval) => {
            const status = intervals[interval];
            return (
              <div key={interval} className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{interval}</span>
                  <DataFreshnessBadge 
                    lastUpdated={status.last_updated} 
                    showText={false}
                  />
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {status.record_count ? (
                    <div>{status.record_count.toLocaleString()} records</div>
                  ) : (
                    <div>No records</div>
                  )}
                  {status.feature_count !== undefined && (
                    <div>{status.feature_count.toLocaleString()} features</div>
                  )}
                  {status.data_quality_score !== undefined && (
                    <div>Quality: {(status.data_quality_score * 100).toFixed(1)}%</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

