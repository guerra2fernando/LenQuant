/* eslint-disable */
// @ts-nocheck
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, GitBranch, Sparkles, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PostRunSummary {
  newChampions: number;
  improvements: number;
  totalTested: number;
  avgFitnessGain: number;
  bestStrategy: {
    id: string;
    fitness: number;
  } | null;
  duration: number;
}

interface PostRunSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: PostRunSummary | null;
}

export function PostRunSummaryModal({ open, onOpenChange, summary }: PostRunSummaryModalProps) {
  if (!summary) return null;

  const stats = [
    {
      label: "New Champions",
      value: summary.newChampions,
      icon: Trophy,
      color: "text-yellow-600",
    },
    {
      label: "Improvements",
      value: summary.improvements,
      icon: TrendingUp,
      color: "text-green-600",
    },
    {
      label: "Strategies Tested",
      value: summary.totalTested,
      icon: GitBranch,
      color: "text-blue-600",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Experiment Complete!</DialogTitle>
              <DialogDescription>
                Evolution cycle finished in {Math.round(summary.duration / 1000)}s
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center space-y-2">
                      <Icon className={`h-8 w-8 ${stat.color}`} />
                      <div className="text-3xl font-bold">{stat.value}</div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Fitness Improvement */}
          {summary.avgFitnessGain > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-green-600" />
                <p className="font-semibold text-green-900 dark:text-green-100">
                  Average Fitness Improved!
                </p>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                Strategies showed an average fitness gain of{" "}
                <span className="font-bold">+{summary.avgFitnessGain.toFixed(2)}%</span>
              </p>
            </div>
          )}

          {/* Best Strategy */}
          {summary.bestStrategy && (
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Top Performer</p>
                  <p className="font-mono text-sm font-semibold">{summary.bestStrategy.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">Fitness Score</p>
                  <Badge className="bg-primary">
                    {summary.bestStrategy.fitness.toFixed(2)}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="rounded-md bg-muted/50 p-4">
            <p className="font-semibold mb-2 text-sm">What's Next?</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• New champions are automatically available for allocation</li>
              <li>• Check the leaderboard to see detailed strategy rankings</li>
              <li>• Run more experiments to continue evolution</li>
              <li>• Deploy top strategies to live trading when ready</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => {
            onOpenChange(false);
            // Could navigate to leaderboard or other relevant page
          }}>
            View Leaderboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

