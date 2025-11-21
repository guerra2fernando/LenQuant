/* eslint-disable */
// @ts-nocheck
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GitBranch, Play, Clock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { fetcher } from "@/lib/api";
import Link from "next/link";
import { TooltipExplainer } from "./TooltipExplainer";

export function EvolutionProgressCard() {
  const { data: queueData } = useSWR("/api/experiments/queue", fetcher, {
    refreshInterval: 10000, // Refresh every 10 seconds
  });
  const { data: leaderboardData } = useSWR("/api/leaderboard/today?limit=5", fetcher, {
    refreshInterval: 30000,
  });

  const queueItems = queueData?.queue ?? [];
  const champions = leaderboardData?.leaderboard?.top_strategies?.filter(s => s.status === "champion") ?? [];
  
  const runningExperiments = queueItems.filter(item => item.status === "running");
  const pendingExperiments = queueItems.filter(item => item.status === "pending");
  const completedToday = queueItems.filter(item => item.status === "completed");

  const hasActiveExperiments = runningExperiments.length > 0;
  const hasPendingExperiments = pendingExperiments.length > 0;

  // Calculate progress for running experiments
  const progress = hasActiveExperiments ? 
    Math.min((completedToday.length / (completedToday.length + runningExperiments.length + pendingExperiments.length)) * 100, 90) : 
    0;

  // Estimate completion time (rough estimate: 30 seconds per experiment)
  const estimatedMinutes = Math.ceil((runningExperiments.length + pendingExperiments.length) * 0.5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Evolution Status
              <TooltipExplainer
                term="Evolution Status"
                explanation="Shows the current state of your strategy evolution system. When experiments are running, you'll see progress and estimated completion time. Champions are the best-performing strategies that have been promoted."
              />
            </CardTitle>
            <CardDescription>
              {hasActiveExperiments ? "Experiments in progress" : "Ready to evolve strategies"}
            </CardDescription>
          </div>
          {hasActiveExperiments ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Experiments */}
        {hasActiveExperiments && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                Est. {estimatedMinutes} min remaining • {runningExperiments.length} running, {pendingExperiments.length} pending
              </span>
            </div>
          </div>
        )}

        {/* Status Badges */}
        <div className="flex flex-wrap gap-2">
          {runningExperiments.length > 0 && (
            <Badge className="bg-blue-600">
              <Play className="mr-1 h-3 w-3" />
              {runningExperiments.length} Running
            </Badge>
          )}
          {pendingExperiments.length > 0 && (
            <Badge variant="outline">
              <Clock className="mr-1 h-3 w-3" />
              {pendingExperiments.length} Queued
            </Badge>
          )}
          {completedToday.length > 0 && (
            <Badge className="bg-green-600">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              {completedToday.length} Completed
            </Badge>
          )}
        </div>

        {/* Champions Summary */}
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Active Champions</p>
            <Badge variant="outline">{champions.length}</Badge>
          </div>
          {champions.length > 0 ? (
            <div className="space-y-1">
              {champions.slice(0, 3).map((champion) => (
                <div key={champion.strategy_id} className="flex items-center justify-between text-xs">
                  <span className="font-mono truncate">{champion.strategy_id.slice(0, 16)}...</span>
                  <span className="text-muted-foreground">{champion.composite?.toFixed(2)}</span>
                </div>
              ))}
              {champions.length > 3 && (
                <p className="text-xs text-muted-foreground">+{champions.length - 3} more</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No champions yet. Run experiments to create champions.</p>
          )}
        </div>

        {/* Action Button */}
        <Link href="/analytics?tab=evolution">
          <Button variant="outline" className="w-full">
            {hasActiveExperiments ? "Monitor Progress" : "Run Experiments"}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

