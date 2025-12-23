/* eslint-disable */
// @ts-nocheck
import { useState } from "react";
import useSWR from "swr";
import { 
  BookmarkIcon, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Target,
  AlertTriangle,
  Filter,
  RefreshCw,
  Search
} from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { useMode } from "@/lib/mode-context";
import { fetcher } from "@/lib/api";

type JournalEvent = {
  _id: string;
  type: string;
  symbol: string;
  timeframe: string;
  timestamp: string;
  payload: {
    note?: string;
    market_state?: string;
    trend_direction?: string;
    setup_candidates?: string[];
    confidence?: number;
    leverage_band?: number[];
    risk_flags?: string[];
  };
};

type JournalResponse = {
  events: JournalEvent[];
  count: number;
  session_id?: string;
};

type AnalysisResponse = {
  analyses: Array<{
    _id: string;
    symbol: string;
    timeframe: string;
    timestamp: string;
    market_state: string;
    trend_direction: string;
    setup_candidates: string[];
    confidence_pattern: number;
    suggested_leverage_band: number[];
    risk_flags: string[];
    reason: string;
    source: string;
  }>;
  count: number;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getMarketStateColor = (state: string) => {
  switch (state) {
    case 'trend': return 'text-green-400';
    case 'trend_volatile': return 'text-yellow-400';
    case 'range': return 'text-blue-400';
    case 'chop': return 'text-red-400';
    default: return 'text-muted-foreground';
  }
};

const getMarketStateIcon = (state: string, direction?: string) => {
  if (state === 'trend' || state === 'trend_volatile') {
    return direction === 'up' ? TrendingUp : TrendingDown;
  }
  return Target;
};

export default function JournalPage(): JSX.Element {
  const { isEasyMode } = useMode();
  const [filterSymbol, setFilterSymbol] = useState("");
  const [filterType, setFilterType] = useState("all");
  
  // Fetch bookmarks/events
  const {
    data: eventsData,
    error: eventsError,
    isLoading: eventsLoading,
    mutate: refetchEvents,
  } = useSWR<JournalResponse>(
    `/api/extension/journal/events?limit=100&event_types=bookmark_added,context_changed`,
    fetcher,
    { revalidateOnFocus: false }
  );
  
  // Fetch analyses
  const {
    data: analysesData,
    error: analysesError,
    isLoading: analysesLoading,
    mutate: refetchAnalyses,
  } = useSWR<AnalysisResponse>(
    `/api/extension/analyses?limit=50`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const isLoading = eventsLoading || analysesLoading;
  const error = eventsError || analysesError;
  
  const bookmarks = eventsData?.events?.filter(e => e.type === 'bookmark_added') ?? [];
  const analyses = analysesData?.analyses ?? [];
  
  // Filter by symbol
  const filteredBookmarks = filterSymbol 
    ? bookmarks.filter(b => b.symbol?.toLowerCase().includes(filterSymbol.toLowerCase()))
    : bookmarks;
  
  const filteredAnalyses = filterSymbol
    ? analyses.filter(a => a.symbol?.toLowerCase().includes(filterSymbol.toLowerCase()))
    : analyses;

  const handleRefresh = () => {
    refetchEvents();
    refetchAnalyses();
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Trading Journal
            <TooltipExplainer 
              term="Trading Journal" 
              explanation="Your personal trading journal captures all analyses and bookmarks from the Chrome extension. Review past setups, track which patterns worked, and identify areas for improvement. Bookmarks are manually saved moments you wanted to remember, while analyses show all the market assessments made by the extension."
            />
          </h1>
          <p className="text-sm text-muted-foreground">
            Review your bookmarked setups and analysis history from the Chrome extension.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRefresh}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by symbol..."
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entries</SelectItem>
            <SelectItem value="bookmarks">Bookmarks Only</SelectItem>
            <SelectItem value="analyses">Analyses Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <ProgressIndicator message="Loading journal..." variant="spinner" />
      )}

      {error && (
        <ErrorMessage
          title="Failed to load journal"
          message={error instanceof Error ? error.message : "Unknown error"}
          error={error}
          onRetry={handleRefresh}
        />
      )}

      {/* Bookmarks Section */}
      {(filterType === 'all' || filterType === 'bookmarks') && (
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookmarkIcon className="h-5 w-5 text-yellow-500" />
                Bookmarks
                <Badge variant="secondary">{filteredBookmarks.length}</Badge>
              </CardTitle>
              <CardDescription>
                Manually saved setups and moments from your trading sessions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredBookmarks.length > 0 ? (
                <ul className="space-y-3">
                  {filteredBookmarks.map((bookmark) => (
                    <li key={bookmark._id}>
                      <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-4 transition-colors hover:border-primary/50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              {bookmark.symbol}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {bookmark.timeframe}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              •
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(bookmark.timestamp)}
                            </span>
                          </div>
                          {bookmark.payload?.note && (
                            <p className="mt-2 text-sm text-foreground">
                              "{bookmark.payload.note}"
                            </p>
                          )}
                          {bookmark.payload?.market_state && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge 
                                variant="secondary" 
                                className={getMarketStateColor(bookmark.payload.market_state)}
                              >
                                {bookmark.payload.market_state.replace(/_/g, ' ')}
                              </Badge>
                              {bookmark.payload.setup_candidates?.map((setup, i) => (
                                <Badge key={i} variant="outline">
                                  {setup.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  variant="data"
                  title="No Bookmarks Yet"
                  description={
                    isEasyMode
                      ? "When you find an interesting setup in the Chrome extension, click 'Bookmark' to save it here for later review."
                      : "Use the Chrome extension's Bookmark button to save setups for later review."
                  }
                />
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Analyses Section */}
      {(filterType === 'all' || filterType === 'analyses') && (
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />
                Analysis History
                <Badge variant="secondary">{filteredAnalyses.length}</Badge>
              </CardTitle>
              <CardDescription>
                All market analyses performed by the extension.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredAnalyses.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Symbol</th>
                        <th className="pb-2 font-medium">Time</th>
                        <th className="pb-2 font-medium">State</th>
                        <th className="pb-2 font-medium">Setup</th>
                        <th className="pb-2 font-medium">Confidence</th>
                        <th className="pb-2 font-medium">Leverage</th>
                        <th className="pb-2 font-medium">Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredAnalyses.map((analysis) => {
                        const StateIcon = getMarketStateIcon(analysis.market_state, analysis.trend_direction);
                        return (
                          <tr key={analysis._id} className="hover:bg-muted/50">
                            <td className="py-3">
                              <div className="flex flex-col">
                                <span className="font-mono font-medium">{analysis.symbol}</span>
                                <span className="text-xs text-muted-foreground">{analysis.timeframe}</span>
                              </div>
                            </td>
                            <td className="py-3 text-xs text-muted-foreground">
                              {formatDate(analysis.timestamp)}
                            </td>
                            <td className="py-3">
                              <div className={`flex items-center gap-1 ${getMarketStateColor(analysis.market_state)}`}>
                                <StateIcon className="h-4 w-4" />
                                <span className="capitalize">
                                  {analysis.market_state?.replace(/_/g, ' ')}
                                </span>
                              </div>
                            </td>
                            <td className="py-3">
                              {analysis.setup_candidates?.length > 0 ? (
                                <Badge variant="outline" className="text-xs">
                                  {analysis.setup_candidates[0].replace(/_/g, ' ')}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-3">
                              <span className={`font-medium ${
                                analysis.confidence_pattern >= 70 ? 'text-green-400' :
                                analysis.confidence_pattern >= 50 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                                {analysis.confidence_pattern}%
                              </span>
                            </td>
                            <td className="py-3 text-xs">
                              {analysis.suggested_leverage_band?.join('x - ')}x
                            </td>
                            <td className="py-3">
                              {analysis.risk_flags?.length > 0 ? (
                                <div className="flex items-center gap-1 text-yellow-500">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span className="text-xs">{analysis.risk_flags.length}</span>
                                </div>
                              ) : (
                                <span className="text-green-500 text-xs">Clean</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  variant="data"
                  title="No Analyses Yet"
                  description={
                    isEasyMode
                      ? "Analysis history will appear here as you use the Chrome extension on Binance Futures."
                      : "Use the Chrome extension on Binance Futures to generate analyses."
                  }
                />
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Stats Summary */}
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{bookmarks.length}</div>
            <p className="text-xs text-muted-foreground">Total Bookmarks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{analyses.length}</div>
            <p className="text-xs text-muted-foreground">Total Analyses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {analyses.filter(a => a.setup_candidates?.length > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">Setups Detected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {[...new Set(analyses.map(a => a.symbol))].length}
            </div>
            <p className="text-xs text-muted-foreground">Unique Symbols</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

