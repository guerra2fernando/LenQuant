type AllocationDetails = {
  strategy_id: string;
  weight: number;
};

type Props = {
  current?: AllocationDetails[];
  previous?: AllocationDetails[];
};

function toMap(values?: AllocationDetails[]) {
  const map = new Map<string, number>();
  values?.forEach((item) => {
    map.set(item.strategy_id, item.weight);
  });
  return map;
}

export function AllocationDiffList({ current, previous }: Props) {
  if (!current || current.length === 0) {
    return <p className="text-sm text-muted-foreground">Allocator has not produced weights yet.</p>;
  }

  const currentMap = toMap(current);
  const previousMap = toMap(previous);

  const rows = Array.from(currentMap.entries()).map(([strategyId, weight]) => {
    const prevWeight = previousMap.get(strategyId) ?? 0;
    const diff = weight - prevWeight;
    return { strategyId, weight, diff };
  });

  rows.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.strategyId} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium">{row.strategyId}</span>
          <span className="tabular-nums text-muted-foreground">
            {(row.weight * 100).toFixed(2)}%
            <span className={row.diff >= 0 ? "text-emerald-500" : "text-destructive"}>
              {" "}
              ({row.diff >= 0 ? "+" : ""}
              {(row.diff * 100).toFixed(2)}%)
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

