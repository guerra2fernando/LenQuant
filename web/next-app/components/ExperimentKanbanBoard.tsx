/* eslint-disable */
// @ts-nocheck
import { useMemo } from "react";

import { ExperimentCard } from "@/components/ExperimentCard";

type Experiment = {
  experiment_id: string;
  status: string;
  [key: string]: any;
};

type ExperimentKanbanBoardProps = {
  experiments: Experiment[];
  onSelect?: (experiment: Experiment) => void;
  selectedId?: string | null;
};

const COLUMNS = [
  { key: "pending", title: "Pending" },
  { key: "running", title: "Running" },
  { key: "completed", title: "Completed" },
  { key: "promoted", title: "Promoted" },
  { key: "rejected", title: "Rejected" },
];

export function ExperimentKanbanBoard({ experiments, onSelect, selectedId }: ExperimentKanbanBoardProps) {
  const grouped = useMemo(() => {
    const buckets: Record<string, Experiment[]> = {};
    for (const column of COLUMNS) {
      buckets[column.key] = [];
    }
    for (const experiment of experiments) {
      const key = experiment.status ?? "pending";
      if (!buckets[key]) {
        buckets[key] = [];
      }
      buckets[key].push(experiment);
    }
    return buckets;
  }, [experiments]);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {COLUMNS.map((column) => (
        <div key={column.key} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
            <span className="text-xs text-muted-foreground">{grouped[column.key]?.length ?? 0}</span>
          </div>
          <div className="space-y-3">
            {(grouped[column.key] ?? []).map((experiment) => (
              <ExperimentCard
                key={experiment.experiment_id}
                experiment={experiment}
                onSelect={onSelect}
                active={selectedId === experiment.experiment_id}
              />
            ))}
            {((grouped[column.key] ?? []).length === 0) && (
              <p className="rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                No experiments in this column.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

