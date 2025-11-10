import { useMemo, useState } from "react";
import useSWR from "swr";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InsightCard } from "@/components/InsightCard";
import { KnowledgeSearchInput } from "@/components/KnowledgeSearchInput";
import { KnowledgeTimeline } from "@/components/KnowledgeTimeline";
import { fetcher } from "@/lib/api";

type KnowledgeEntry = {
  period: string;
  summary?: string;
  insights?: string[];
  actionables?: string[];
  winners_summary?: string[];
  losers_summary?: string[];
  feature_correlations?: Record<string, number>;
};

type KnowledgeResponse = {
  entries: KnowledgeEntry[];
};

type SearchResponse = {
  results: KnowledgeEntry[];
};

export default function KnowledgePage() {
  const { data } = useSWR<KnowledgeResponse>("/api/knowledge/?limit=20", fetcher, { refreshInterval: 60000 });
  const [query, setQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const { data: searchData } = useSWR<SearchResponse>(
    query.trim().length > 1 ? `/api/knowledge/search?q=${encodeURIComponent(query.trim())}&limit=10` : null,
    fetcher,
  );

  const entries = data?.entries ?? [];
  const selectedEntry =
    entries.find((entry) => entry.period === selectedPeriod) ??
    (entries.length ? entries[0] : undefined);

  const searchResults = searchData?.results ?? [];

  const correlations = useMemo(() => {
    if (!selectedEntry?.feature_correlations) return [];
    return Object.entries(selectedEntry.feature_correlations)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .slice(0, 6);
  }, [selectedEntry]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Browser</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <KnowledgeSearchInput value={query} onChange={setQuery} />
          {query.trim() && searchResults.length ? (
            <div className="space-y-2 rounded-md border border-dashed border-border/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Matches</p>
              <ul className="space-y-1">
                {searchResults.map((entry) => (
                  <li key={`search-${entry.period}`} className="flex items-center justify-between">
                    <button
                      type="button"
                      className="text-left text-foreground underline-offset-2 hover:underline"
                      onClick={() => {
                        setSelectedPeriod(entry.period);
                        setQuery("");
                      }}
                    >
                      {entry.period}
                    </button>
                    <span className="text-muted-foreground">{entry.summary?.slice(0, 80)}…</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
        <KnowledgeTimeline entries={entries} onSelect={(entry) => setSelectedPeriod(entry.period)} />

        {selectedEntry ? (
          <div className="space-y-4">
            <InsightCard title="Summary" summary={selectedEntry.summary} />
            <InsightCard title="Winners" bullets={selectedEntry.winners_summary} />
            <InsightCard title="Losers" bullets={selectedEntry.losers_summary} />
            {correlations.length ? (
              <Card>
                <CardHeader>
                  <CardTitle>Feature Correlations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  {correlations.map(([feature, value]) => (
                    <div key={feature} className="flex items-center justify-between">
                      <span>{feature}</span>
                      <span>{(value * 100).toFixed(2)}%</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
            <InsightCard title="Actionables" bullets={selectedEntry.actionables} />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Insight Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Select a period to view generated insights.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

