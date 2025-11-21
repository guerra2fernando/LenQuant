/* eslint-disable */
// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, TrendingUp, MessageSquare, BarChart3, Settings, Sparkles, Database } from "lucide-react";

import { SymbolDisplay } from "@/components/CryptoSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useMode } from "@/lib/mode-context";
import { fetcher } from "../lib/api";
import { useRegime } from "@/lib/hooks";
import { MacroRegimeCard } from "@/components/MacroRegimeCard";
import { SetupProgressCard } from "@/components/SetupProgressCard";
import { TradingPairsCard } from "@/components/TradingPairsCard";
import { PortfolioQuickStatusCard } from "@/components/PortfolioQuickStatusCard";
import { RecommendedActionCard } from "@/components/RecommendedActionCard";
import { SmartSignalPreviewCard } from "@/components/SmartSignalPreviewCard";
import { SystemHealthCard } from "@/components/SystemHealthCard";
import { AnalyticsSummaryCard } from "@/components/AnalyticsSummaryCard";
import { EvolutionProgressCard } from "@/components/EvolutionProgressCard";
import { LearningProgressCard } from "@/components/LearningProgressCard";

type StatusResponse = {
  status: string;
};

type Report = {
  date: string;
  summary?: string;
};

type ReportsResponse = {
  reports: Report[];
};

type InventoryRow = {
  symbol: string;
  interval: string;
  ohlcv_count: number;
  features_count: number;
  latest_candle: string | null;
  latest_feature: string | null;
};

type AdminOverviewResponse = {
  available_symbols: string[];
  default_symbols: string[];
  default_intervals: string[];
  default_lookback_days: number;
  inventory: InventoryRow[];
};

type BootstrapResponse = {
  seeded_symbols: number;
  ingested: Array<{ symbol: string; interval: string; rows: number }>;
  features: Array<{ symbol: string; interval: string; rows: number }>;
  simulation_run_id: string | null;
  report_path: string | null;
  inventory: InventoryRow[];
  batch_size: number;
  lookback_days: number;
  requested_symbols: string[];
  requested_intervals: string[];
  timestamp: string;
};

export default function Home(): JSX.Element {
  const { data: status, mutate: refreshStatus } = useSWR<StatusResponse>("/api/status", fetcher);
  const { data: reports, mutate: refreshReports } = useSWR<ReportsResponse>("/api/reports?limit=3", fetcher);
  const { data: overview, mutate: refreshOverview } = useSWR<AdminOverviewResponse>("/api/admin/overview", fetcher);
  const { regime: btcRegime, isLoading: isLoadingRegime } = useRegime("BTC/USD", "1h");
  const [bootstrapResult, setBootstrapResult] = useState<BootstrapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [symbolsInitialized, setSymbolsInitialized] = useState(false);
  const [selectedIntervals, setSelectedIntervals] = useState<string[]>([]);
  const [intervalsInitialized, setIntervalsInitialized] = useState(false);
  const [lookbackDays, setLookbackDays] = useState<number>(30);
  const [lookbackInitialized, setLookbackInitialized] = useState(false);

  const availableSymbols = overview?.available_symbols ?? [];
  const inventory = overview?.inventory ?? [];
  const reportItems: Report[] = reports?.reports ?? [];
  const uniqueSymbolsCount = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach((row) => set.add(row.symbol));
    return set.size;
  }, [inventory]);
  const latestCandleTimestamp = useMemo(() => {
    return inventory.reduce((latest, row) => {
      if (!row.latest_candle) {
        return latest;
      }
      const timestamp = new Date(row.latest_candle).getTime();
      return Number.isNaN(timestamp) ? latest : Math.max(latest, timestamp);
    }, 0);
  }, [inventory]);
  const latestCandleDisplay = latestCandleTimestamp ? new Date(latestCandleTimestamp).toLocaleString() : null;
  const latestReport = reportItems[0] ?? null;

  useEffect(() => {
    if (!symbolsInitialized && overview?.default_symbols?.length) {
      setSelectedSymbols(overview.default_symbols);
      setSymbolsInitialized(true);
    }
  }, [overview, symbolsInitialized]);

  useEffect(() => {
    if (!intervalsInitialized && overview?.default_intervals?.length) {
      setSelectedIntervals(overview.default_intervals);
      setIntervalsInitialized(true);
    }
  }, [overview, intervalsInitialized]);

  useEffect(() => {
    if (!lookbackInitialized && overview?.default_lookback_days) {
      setLookbackDays(overview.default_lookback_days);
      setLookbackInitialized(true);
    }
  }, [overview, lookbackInitialized]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat("en-US"), []);
  const formatNumber = (value: number) => numberFormatter.format(value);

  const highlightedKeys = useMemo(() => {
    const keys = new Set<string>();
    selectedSymbols.forEach((symbol) => {
      selectedIntervals.forEach((interval) => {
        keys.add(`${symbol}__${interval}`);
      });
    });
    return keys;
  }, [selectedSymbols, selectedIntervals]);

  const handleSymbolToggle = (symbol: string, checked: boolean) => {
    setSelectedSymbols((prev) => {
      if (checked) {
        if (prev.includes(symbol)) {
          return prev;
        }
        return [...prev, symbol];
      }
      return prev.filter((item) => item !== symbol);
    });
  };

  const handleIntervalToggle = (interval: string, checked: boolean) => {
    setSelectedIntervals((prev) => {
      if (checked) {
        if (prev.includes(interval)) {
          return prev;
        }
        return [...prev, interval];
      }
      return prev.filter((item) => item !== interval);
    });
  };

  const handleLookbackChange = (value: string) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      setLookbackDays(0);
      return;
    }
    setLookbackDays(Math.max(1, Math.min(365, Math.floor(parsed))));
  };

  const handleBootstrap = async () => {
    if (!selectedSymbols.length || !selectedIntervals.length) {
      setError("Choose at least one symbol and interval.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetcher<BootstrapResponse>("/api/admin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: selectedSymbols,
          intervals: selectedIntervals,
          lookback_days: lookbackDays,
        }),
      });
      setBootstrapResult(response);
      await Promise.all([refreshStatus(), refreshReports(), refreshOverview()]);
    } catch (err: any) {
      setError(err.message || "Failed to bootstrap data.");
    } finally {
      setLoading(false);
    }
  };

  const canBootstrap = selectedSymbols.length > 0 && selectedIntervals.length > 0 && !loading;
  const { isEasyMode } = useMode();

  // Easy Mode Dashboard
  if (isEasyMode) {
    const hasData = inventory.some(row => row.ohlcv_count > 0 || row.features_count > 0);
    const hasReports = reportItems.length > 0;

    return (
      <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">LenQuant</h1>
            <p className="mt-2 mb-8 text-lg text-muted-foreground md:text-xl">
              Run AI-assisted crypto strategies with guided workflows.
            </p>
          </div>

        {/* Getting Started Banner */}
        {!hasData && (
          <Link href="/get-started">
            <div className="cursor-pointer rounded-lg border-2 border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-600 to-purple-500 p-6 shadow-lg transition-all hover:border-fuchsia-400/50 hover:shadow-xl">
              <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-white/20 p-3">
                    <Database className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Start Your Trading Journey</h3>
                    <p className="mt-1 text-sm text-white/90">
                      Configure and fetch crypto market data to unlock trading, insights, and AI-powered strategies
                    </p>
                  </div>
                </div>
                <Button variant="secondary" size="lg" className="whitespace-nowrap">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </Link>
        )}

        {/* Phase 1: Setup Progress Card (shown until complete) */}
        <SetupProgressCard />

        {/* Phase 1: Recommended Next Action */}
        <RecommendedActionCard />

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/trading">
            <Card className="flex h-full cursor-pointer flex-col transition-all hover:border-primary/50 hover:shadow-md">
              <CardHeader className="flex flex-col gap-2 pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">Trading</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="mt-auto text-sm text-muted-foreground">
                <p className="text-sm text-muted-foreground">Place orders and manage your positions</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/insights">
            <Card className="flex h-full cursor-pointer flex-col transition-all hover:border-primary/50 hover:shadow-md">
              <CardHeader className="flex flex-col gap-2 pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">Insights</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="mt-auto text-sm text-muted-foreground">
                <p className="text-sm text-muted-foreground">View forecasts and strategy recommendations</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/assistant">
            <Card className="flex h-full cursor-pointer flex-col transition-all hover:border-primary/50 hover:shadow-md">
              <CardHeader className="flex flex-col gap-2 pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">Assistant</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="mt-auto text-sm text-muted-foreground">
                <p className="text-sm text-muted-foreground">Ask questions and get trading advice</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/settings">
            <Card className="flex h-full cursor-pointer flex-col transition-all hover:border-primary/50 hover:shadow-md">
              <CardHeader className="flex flex-col gap-2 pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">Settings</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="mt-auto text-sm text-muted-foreground">
                <p className="text-sm text-muted-foreground">Configure your trading preferences</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Phase 1: Three-column layout for new cards */}
        {hasData && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <TradingPairsCard />
            <PortfolioQuickStatusCard />
            <SmartSignalPreviewCard />
          </div>
        )}

        {/* Phase 1: System Health Card */}
        {hasData && <SystemHealthCard />}

        {/* Phase 2: Analytics Summary Card */}
        {hasData && <AnalyticsSummaryCard />}

        {/* Phase 5: Evolution Progress Card */}
        {hasData && <EvolutionProgressCard />}

        {/* Phase 6: Learning Progress Card */}
        <LearningProgressCard />

        {/* System Status Indicator */}
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-2 w-2 rounded-full",
              status?.status === "ok" ? "bg-green-500 animate-pulse" : "bg-amber-500"
            )} />
            <div>
              <p className="text-sm font-medium text-foreground">
                System {status ? (status.status === "ok" ? "Online" : status.status) : "Loading..."}
              </p>
              <p className="text-xs text-muted-foreground">
                {uniqueSymbolsCount} pairs tracked • {inventory.length} datasets
              </p>
            </div>
          </div>
          <Link href="/settings?tab=general">
            <Button variant="ghost" size="sm">
              View Details
            </Button>
          </Link>
        </div>

        {/* Market Regime */}
        <MacroRegimeCard 
          symbol="BTC/USD" 
          interval="1h" 
          regimeData={btcRegime} 
          isLoading={isLoadingRegime}
        />

        {/* Recent Activity */}
        {hasReports && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
              <CardDescription>Latest performance summaries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reportItems.slice(0, 3).map((report: Report) => (
                  <div key={report.date} className="rounded-lg border bg-muted/30 p-3">
                    <div className="text-sm font-semibold text-foreground">{report.date}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{report.summary || "No summary available."}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Advanced Mode Dashboard - Similar to Easy Mode
  const hasData = inventory.some(row => row.ohlcv_count > 0 || row.features_count > 0);
  const hasReports = reportItems.length > 0;

  return (
    <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground md:text-5xl">LenQuant</h1>
          <p className="mt-2 mb-8 text-lg text-muted-foreground md:text-xl">
            Advanced control center with full access to data pipelines, models, and system configuration.
          </p>
        </div>

      {/* Getting Started Banner */}
      {!hasData && (
        <Link href="/get-started">
          <div className="cursor-pointer rounded-lg border-2 border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-600 to-purple-500 p-6 shadow-lg transition-all hover:border-fuchsia-400/50 hover:shadow-xl">
            <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-white/20 p-3">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Configure Your Data Pipeline</h3>
                  <p className="mt-1 text-sm text-white/90">
                    Select cryptocurrencies and timeframes to fetch market data and power your trading system
                  </p>
                </div>
              </div>
              <Button variant="secondary" size="lg" className="whitespace-nowrap">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </Link>
      )}

      {/* Phase 1: Setup Progress Card (shown until complete) */}
      <SetupProgressCard />

      {/* Phase 1: Recommended Next Action */}
      <RecommendedActionCard />

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/trading">
          <Card className="flex h-full cursor-pointer flex-col transition-all hover:border-primary/50 hover:shadow-md">
            <CardHeader className="flex flex-col gap-2 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Trading</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="mt-auto text-sm text-muted-foreground">
              <p className="text-sm text-muted-foreground">Execute trades and manage positions</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/insights">
          <Card className="flex h-full cursor-pointer flex-col transition-all hover:border-primary/50 hover:shadow-md">
            <CardHeader className="flex flex-col gap-2 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Insights</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="mt-auto text-sm text-muted-foreground">
              <p className="text-sm text-muted-foreground">Advanced analytics and forecasts</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/assistant">
          <Card className="flex h-full cursor-pointer flex-col transition-all hover:border-primary/50 hover:shadow-md">
            <CardHeader className="flex flex-col gap-2 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Assistant</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="mt-auto text-sm text-muted-foreground">
              <p className="text-sm text-muted-foreground">AI-powered trading insights</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/settings">
          <Card className="flex h-full cursor-pointer flex-col transition-all hover:border-primary/50 hover:shadow-md">
            <CardHeader className="flex flex-col gap-2 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Settings className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="mt-auto text-sm text-muted-foreground">
              <p className="text-sm text-muted-foreground">Full system configuration</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Phase 1: Three-column layout for new cards */}
      {hasData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <TradingPairsCard />
          <PortfolioQuickStatusCard />
          <SmartSignalPreviewCard />
        </div>
      )}

      {/* Phase 1: System Health Card */}
      {hasData && <SystemHealthCard />}

      {/* Phase 2: Analytics Summary Card */}
      {hasData && <AnalyticsSummaryCard />}

      {/* Phase 5: Evolution Progress Card */}
      {hasData && <EvolutionProgressCard />}

      {/* Phase 6: Learning Progress Card */}
      <LearningProgressCard />

      {/* System Status Indicator */}
      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-2 w-2 rounded-full",
            status?.status === "ok" ? "bg-green-500 animate-pulse" : "bg-amber-500"
          )} />
          <div>
            <p className="text-sm font-medium text-foreground">
              System {status ? (status.status === "ok" ? "Online" : status.status) : "Loading..."}
            </p>
            <p className="text-xs text-muted-foreground">
              {uniqueSymbolsCount} pairs tracked • {availableSymbols.length} available • {inventory.length} datasets
            </p>
          </div>
        </div>
        <Link href="/settings?tab=general">
          <Button variant="ghost" size="sm">
            View Details
          </Button>
        </Link>
      </div>

      {/* Market Regime */}
      <MacroRegimeCard 
        symbol="BTC/USD" 
        interval="1h" 
        regimeData={btcRegime} 
        isLoading={isLoadingRegime}
      />

      {/* Recent Activity with link to all reports */}
      {hasReports && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Reports</CardTitle>
                <CardDescription>Latest performance summaries</CardDescription>
              </div>
              <Link href="/reports">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reportItems.slice(0, 3).map((report: Report) => (
                <Link key={report.date} href={`/reports/${report.date}`}>
                  <div className="rounded-lg border bg-muted/30 p-3 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer">
                    <div className="text-sm font-semibold text-foreground">{report.date}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{report.summary || "No summary available."}</div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Coverage Table */}
      {hasData && (
        <Card>
          <CardHeader>
            <CardTitle>Data Coverage</CardTitle>
            <CardDescription>Live inventory from MongoDB collections</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">OHLCV Candles</TableHead>
                  <TableHead className="text-right">Feature Rows</TableHead>
                  <TableHead className="text-right">Latest Candle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((row) => {
                  const key = `${row.symbol}__${row.interval}`;
                  return (
                    <TableRow key={key}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <SymbolDisplay symbol={row.symbol} />
                          <Badge variant="secondary">{row.interval}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(row.ohlcv_count)}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(row.features_count)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {row.latest_candle ? new Date(row.latest_candle).toLocaleString() : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export async function getStaticProps() {
  return {
    props: {
      title: "LenQuant - AI-Powered Crypto Trading Platform",
      description: "Advanced AI-assisted cryptocurrency trading platform with predictive analytics, automated strategies, and real-time market insights.",
    },
  };
}
