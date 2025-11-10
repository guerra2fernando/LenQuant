import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LineageNode = {
  strategy_id: string;
  parent?: string | null;
  generation?: number;
};

type Props = {
  nodes?: LineageNode[];
  links?: { source: string; target: string }[];
};

const COLORS = ["#22c55e", "#38bdf8", "#f97316", "#c084fc", "#f43f5e"];

export function LineageGraph({ nodes, links }: Props) {
  const items = nodes ?? [];
  const map = new Map(items.map((node) => [node.strategy_id, node]));
  const grouped = new Map<number, LineageNode[]>();
  const childCounts = new Map<string, number>();

  if (links) {
    for (const link of links) {
      const count = childCounts.get(link.source) ?? 0;
      childCounts.set(link.source, count + 1);
    }
  }

  for (const node of items) {
    const generation = node.generation ?? 0;
    const bucket = grouped.get(generation) ?? [];
    bucket.push(node);
    grouped.set(generation, bucket);
  }

  const sortedGenerations = [...grouped.keys()].sort((a, b) => a - b);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Lineage</CardTitle>
        <CardDescription>Track mutations across generations.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lineage data recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {sortedGenerations.map((generation, index) => {
              const bucket = grouped.get(generation) ?? [];
              return (
                <div key={generation} className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Generation {generation}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {bucket.map((node) => {
                      const color = COLORS[index % COLORS.length];
                      const parent = node.parent && map.get(node.parent);
                      return (
                        <div
                          key={node.strategy_id}
                          className="rounded-md border border-border bg-background/60 px-3 py-2 text-xs shadow-sm"
                          style={{ borderColor: color }}
                        >
                          <p className="font-semibold text-foreground">{node.strategy_id}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Parent: {parent ? parent.strategy_id : node.parent ?? "seed"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Children: {childCounts.get(node.strategy_id) ?? 0}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


