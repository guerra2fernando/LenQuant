/* eslint-disable */
// @ts-nocheck
import { useMemo } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetcher } from "@/lib/api";

type StrategySelectorProps = {
  selectedStrategies: string[];
  onSelect: (strategyIds: string[]) => void;
};

export function StrategySelector({
  selectedStrategies,
  onSelect,
}: StrategySelectorProps) {
  // Fetch active strategies
  const { data } = useSWR("/api/strategies/genomes?status=active&limit=20", fetcher);

  const strategies = useMemo(() => {
    return data?.genomes ?? [];
  }, [data]);

  // Find best strategy (highest composite fitness)
  const bestStrategy = useMemo(() => {
    if (strategies.length === 0) return null;
    return strategies.reduce((best: any, current: any) => {
      const bestFitness = best?.fitness?.composite ?? 0;
      const currentFitness = current?.fitness?.composite ?? 0;
      return currentFitness > bestFitness ? current : best;
    }, strategies[0]);
  }, [strategies]);

  const toggleStrategy = (strategyId: string) => {
    if (selectedStrategies.includes(strategyId)) {
      onSelect(selectedStrategies.filter((id) => id !== strategyId));
    } else {
      onSelect([...selectedStrategies, strategyId]);
    }
  };

  if (strategies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Strategies</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No active strategies available. Run evolution to generate strategies.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategy Selection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {strategies.map((strategy: any) => {
          const isSelected = selectedStrategies.includes(strategy.strategy_id);
          const isBest = strategy.strategy_id === bestStrategy?.strategy_id;

          return (
            <div
              key={strategy.strategy_id}
              className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                isSelected ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
              }`}
              onClick={() => toggleStrategy(strategy.strategy_id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{strategy.strategy_id}</span>
                    {isBest && (
                      <Badge variant="default" className="text-xs">
                        Best
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fitness: {strategy.fitness?.composite?.toFixed(3) ?? "N/A"}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="h-4 w-4"
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

