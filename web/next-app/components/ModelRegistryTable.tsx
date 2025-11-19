import React from "react";
import { EmptyState } from "@/components/EmptyState";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { SymbolDisplay } from "@/components/CryptoSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMode } from "@/lib/mode-context";
import { cn } from "@/lib/utils";

export type ModelRegistryRecord = {
  _id?: string;
  model_id: string;
  symbol: string;
  horizon: string;
  status?: string;
  algorithm?: string;
  trained_at?: string;
  metrics?: {
    test?: {
      rmse?: number;
      mae?: number;
      directional_accuracy?: number;
    };
  };
};

type Props = {
  items: ModelRegistryRecord[];
  isLoading?: boolean;
  onRetrain?: (record: ModelRegistryRecord) => void;
  onSelect?: (record: ModelRegistryRecord) => void;
  selectedModelId?: string | null;
};

export function ModelRegistryTable({ items, isLoading, onRetrain, onSelect, selectedModelId }: Props) {
  const { isEasyMode } = useMode();

  return (
    <Card className="border">
      <CardContent className="-mx-4 -mb-4 px-0 pb-0">
        {isLoading ? (
          <div className="py-12">
            <ProgressIndicator message="Loading model registry..." variant="spinner" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-6">
            <EmptyState
              variant="data"
              title={isEasyMode ? "No Models Yet" : "No Models Registered"}
              description={
                isEasyMode
                  ? "Machine learning models will appear here once they've been trained. Models are created automatically when you run forecasts or training cycles."
                  : "No models registered yet. Train a horizon to populate the registry."
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model ID</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Horizon</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Algorithm</TableHead>
                <TableHead>RMSE</TableHead>
                <TableHead>Dir. Acc.</TableHead>
                <TableHead>Trained</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>

            {items.map((record) => {
              const rmse = record.metrics?.test?.rmse;
              const dirAcc = record.metrics?.test?.directional_accuracy;
              const trainedAt = record.trained_at ? new Date(record.trained_at) : null;
              const isSelected = selectedModelId === record.model_id;

              return (
                <TableRow
                  key={record.model_id}
                  className={cn(onSelect && "cursor-pointer", isSelected && "bg-primary/5")}
                  data-state={isSelected ? "selected" : undefined}
                  onClick={() => {
                    if (onSelect) {
                      onSelect(record);
                    }
                  }}
                >
                  <TableCell className="font-mono text-xs">{record.model_id}</TableCell>
                  <TableCell>
                    <SymbolDisplay symbol={record.symbol} />
                  </TableCell>
                  <TableCell>{record.horizon}</TableCell>
                  <TableCell>{record.status ?? "—"}</TableCell>
                  <TableCell>{record.algorithm ?? "—"}</TableCell>
                  <TableCell>{rmse !== undefined ? rmse.toFixed(6) : "—"}</TableCell>
                  <TableCell>{dirAcc !== undefined ? `${(dirAcc * 100).toFixed(1)}%` : "—"}</TableCell>
                  <TableCell>{trainedAt ? trainedAt.toLocaleString() : record.trained_at ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {onRetrain ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          onRetrain(record);
                        }}
                        disabled={isLoading}
                      >
                        Retrain
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
            <TableCaption>Model registry entries sorted by newest first.</TableCaption>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

