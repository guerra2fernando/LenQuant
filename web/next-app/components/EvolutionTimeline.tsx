/* eslint-disable */
// @ts-nocheck
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TooltipExplainer } from "./TooltipExplainer";
import { ArrowRight, Trophy, GitBranch, Zap } from "lucide-react";

interface Generation {
  generation: number;
  strategies: number;
  champions: number;
  avgFitness: number;
  bestFitness: number;
  timestamp: string;
}

interface EvolutionTimelineProps {
  generations?: Generation[];
}

export function EvolutionTimeline({ generations = [] }: EvolutionTimelineProps) {
  if (generations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Evolution Timeline
          <TooltipExplainer
            term="Evolution Timeline"
            explanation="Shows the progression of strategy evolution over time. Each generation represents a cycle where strategies mutate and the best performers survive. Watch how fitness improves across generations as the system learns."
          />
        </CardTitle>
        <CardDescription>
          Track how strategies evolve across {generations.length} generations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          {/* Generation nodes */}
          <div className="space-y-6">
            {generations.map((gen, index) => {
              const isLatest = index === generations.length - 1;
              const isFirst = index === 0;

              return (
                <div key={gen.generation} className="relative flex gap-4 items-start">
                  {/* Node circle */}
                  <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    isLatest ? 'bg-primary border-primary' : 
                    isFirst ? 'bg-muted border-muted-foreground' : 
                    'bg-background border-border'
                  }`}>
                    {isLatest && <Zap className="h-4 w-4 text-primary-foreground" />}
                    {isFirst && <Trophy className="h-4 w-4 text-muted-foreground" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">
                          Generation {gen.generation}
                          {isLatest && <Badge className="ml-2" variant="default">Current</Badge>}
                          {isFirst && <Badge className="ml-2" variant="outline">First</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(gen.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Best Fitness</p>
                        <p className="font-bold text-primary">{gen.bestFitness.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div className="rounded-md border border-border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Strategies</p>
                        <p className="text-sm font-semibold">{gen.strategies}</p>
                      </div>
                      <div className="rounded-md border border-border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Champions</p>
                        <p className="text-sm font-semibold text-green-600">{gen.champions}</p>
                      </div>
                      <div className="rounded-md border border-border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Avg Fitness</p>
                        <p className="text-sm font-semibold">{gen.avgFitness.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Show improvement arrow */}
                    {index < generations.length - 1 && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <ArrowRight className="h-3 w-3" />
                        {(generations[index + 1].bestFitness - gen.bestFitness) > 0 ? (
                          <span className="text-green-600">
                            +{((generations[index + 1].bestFitness - gen.bestFitness) / gen.bestFitness * 100).toFixed(1)}% improvement
                          </span>
                        ) : (
                          <span className="text-yellow-600">
                            {((generations[index + 1].bestFitness - gen.bestFitness) / gen.bestFitness * 100).toFixed(1)}% change
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

