type AllocationItem = {
  strategy_id: string;
  weight: number;
  expected_roi?: number;
};

type Props = {
  allocations?: AllocationItem[];
  isLoading?: boolean;
};

export function AllocatorAllocationChart({ allocations, isLoading = false }: Props) {
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading allocation data...</div>;
  }

  if (!allocations || allocations.length === 0) {
    return <div className="text-sm text-muted-foreground">No allocation snapshot available.</div>;
  }

  const sorted = [...allocations].sort((a, b) => b.weight - a.weight);
  const maxWeight = sorted[0]?.weight ?? 1;

  return (
    <div className="space-y-3">
      {sorted.map((item) => (
        <div key={item.strategy_id} className="space-y-1">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>{item.strategy_id}</span>
            <span className="text-muted-foreground">
              {(item.weight * 100).toFixed(2)}%
              {typeof item.expected_roi === "number" ? ` · ROI ${item.expected_roi.toFixed(3)}` : ""}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/90"
              style={{ width: `${(item.weight / (maxWeight || 1)) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

