import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type KnowledgeEntry = {
  period: string;
  summary?: string;
  insights?: string[];
  actionables?: string[];
  evaluation_count?: number;
  created_at?: string;
};

type KnowledgeTimelineProps = {
  entries: KnowledgeEntry[];
  onSelect?: (entry: KnowledgeEntry) => void;
};

export function KnowledgeTimeline({ entries, onSelect }: KnowledgeTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">No knowledge recorded yet.</p> : null}
        {entries.map((entry) => (
          <button
            key={entry.period}
            type="button"
            onClick={() => onSelect?.(entry)}
            className="w-full rounded-lg border border-border/60 bg-muted/20 p-4 text-left transition hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">{entry.period}</span>
              <span className="text-xs text-muted-foreground">
                {entry.evaluation_count ? `${entry.evaluation_count} evaluations` : "—"}
              </span>
            </div>
            {entry.summary ? <p className="mt-2 text-xs text-muted-foreground">{entry.summary}</p> : null}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

