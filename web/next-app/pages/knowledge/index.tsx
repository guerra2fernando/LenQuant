import { useMemo, useState } from "react";
import useSWR from "swr";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { InsightCard } from "@/components/InsightCard";
import { KnowledgeSearchInput } from "@/components/KnowledgeSearchInput";
import { KnowledgeTimeline } from "@/components/KnowledgeTimeline";
import { KnowledgeFilterPanel } from "@/components/KnowledgeFilterPanel";
import { EnhancedKnowledgeCard } from "@/components/EnhancedKnowledgeCard";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { Download, Filter, Terminal, TrendingUp, BarChart2 } from "lucide-react";
import { useMode } from "@/lib/mode-context";
import { useRouter } from "next/router";
import { fetcher } from "@/lib/api";
import { toast } from "sonner";

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
  const router = useRouter();
  const { isEasyMode } = useMode();
  const { data, error } = useSWR<KnowledgeResponse>("/api/knowledge/?limit=20", fetcher, { refreshInterval: 60000 });
  const [query, setQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const { data: searchData, error: searchError } = useSWR<SearchResponse>(
    query.trim().length > 1 ? `/api/knowledge/search?q=${encodeURIComponent(query.trim())}&limit=10` : null,
    fetcher,
  );
  
  // Phase 6: Filters
  const [filters, setFilters] = useState({
    tags: [] as string[],
    winnersOnly: false,
    correlationsOnly: false,
    searchTerm: "",
  });

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

  // Phase 6: Export function
  const handleExportAll = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `knowledge_base_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Knowledge base exported");
  };

  // Phase 6: Mock enhanced entries with tags (would come from API)
  const enhancedEntries = useMemo(() => {
    return entries.map((entry, idx) => ({
      _id: entry.period,
      summary: entry.summary,
      created_at: entry.period,
      tags: idx % 3 === 0 ? ["BTC", "trend-following"] : idx % 3 === 1 ? ["volatility", "risk-management"] : ["ETH", "momentum"],
      insight_type: (idx % 4 === 0 ? "feature_importance" : idx % 4 === 1 ? "allocation" : idx % 4 === 2 ? "performance" : "correlation") as "feature_importance" | "allocation" | "performance" | "correlation" | "risk",
      action_suggested: entry.actionables?.[0],
      is_winner: entry.winners_summary && entry.winners_summary.length > 0,
      relevance_score: Math.random() > 0.7 ? 0.8 : 0.5,
    }));
  }, [entries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Knowledge Base
            <TooltipExplainer 
              term="Knowledge Base" 
              explanation="The knowledge base is the system's memory - automatically generated insights from trading history. After each period, the system analyzes what strategies worked (winners), what didn't (losers), and discovers patterns in the data. It learns which technical indicators correlated with success and generates actionable recommendations. This historical wisdom improves future decision-making."
            />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse historical insights, search for patterns, and review automatically generated learnings from past trading periods.
          </p>
        </div>
        {entries.length > 0 && (
          <Button variant="outline" onClick={handleExportAll}>
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
        )}
      </div>
      <KnowledgeFilterPanel 
        filters={filters}
        onChange={setFilters}
        availableTags={["BTC", "ETH", "volatility", "trend-following", "momentum", "risk-management"]}
      />
      <Card>
        <CardHeader>
          <CardTitle>
            Knowledge Browser
            <TooltipExplainer 
              term="Knowledge Browser" 
              explanation="Search through all historical insights using keywords. The system indexes summaries, strategy names, and patterns so you can find specific learnings. For example, search for 'BTC' to see all insights about Bitcoin, or 'high volatility' to find patterns during volatile markets."
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <KnowledgeSearchInput value={query} onChange={setQuery} />
          {searchError ? (
            <ErrorMessage
              title="Search failed"
              message={searchError instanceof Error ? searchError.message : "Unknown error"}
              error={searchError}
            />
          ) : query.trim() && searchResults.length ? (
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
          ) : query.trim() && searchResults.length === 0 ? (
            <EmptyState
              variant="search"
              title="No Results Found"
              description={isEasyMode ? "Try different search terms or browse the timeline below to find insights." : "No knowledge entries match your search query. Try different keywords."}
            />
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <ErrorMessage
          title="Failed to load knowledge"
          message={error instanceof Error ? error.message : "Unknown error"}
          error={error}
          onRetry={() => window.location.reload()}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          variant="data"
          title={isEasyMode ? "No Insights Yet" : "No Knowledge Entries"}
          description={
            isEasyMode
              ? "Historical insights will appear here once the system has analyzed trading data. Check back after some trading activity."
              : "No knowledge entries available. The system generates insights from trading history and performance data."
          }
        />
      ) : (
        <div>
          {enhancedEntries.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Recent Insights with Actions</h3>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/analytics?tab=strategies')}
                    className="gap-1"
                  >
                    <TrendingUp className="h-3 w-3" />
                    Related Strategies
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {enhancedEntries.slice(0, 4).map((entry) => (
                  <EnhancedKnowledgeCard key={entry._id} entry={entry} />
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
            <KnowledgeTimeline entries={entries} onSelect={(entry) => setSelectedPeriod(entry.period)} />

            {selectedEntry ? (
              <div className="space-y-4">
                {/* Contextual Actions */}
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-sm">Apply This Knowledge</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/terminal')}
                      className="gap-1"
                    >
                      <Terminal className="h-3 w-3" />
                      Open Terminal
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/analytics?tab=strategies')}
                      className="gap-1"
                    >
                      <TrendingUp className="h-3 w-3" />
                      View Strategies
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/analytics')}
                      className="gap-1"
                    >
                      <BarChart2 className="h-3 w-3" />
                      View Forecasts
                    </Button>
                  </CardContent>
                </Card>
                
                <InsightCard title="Summary" summary={selectedEntry.summary} />
                <InsightCard title="Winners" bullets={selectedEntry.winners_summary} />
                <InsightCard title="Losers" bullets={selectedEntry.losers_summary} />
                {correlations.length > 0 && (
                  <div>
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          Feature Correlations
                          <TooltipExplainer 
                            term="Feature Correlations" 
                            explanation="This shows which technical indicators and market features had the strongest relationship with profitable trades during this period. Higher percentages mean that feature was more predictive of success. For example, if 'RSI_14' shows 45%, the RSI indicator was a strong predictor. Use this to understand what market conditions mattered most."
                          />
                        </CardTitle>
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
                    <InsightCard title="Actionables" bullets={selectedEntry.actionables} />
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                variant="default"
                title="Select a Period"
                description={isEasyMode ? "Click on a period in the timeline to view insights and learnings from that time." : "Select a period from the timeline to view generated insights."}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export async function getStaticProps() {
  return {
    props: {
      title: "Knowledge Base - LenQuant",
      description: "Access trading knowledge, market research, and AI-generated insights to enhance your trading decisions.",
    },
  };
}

