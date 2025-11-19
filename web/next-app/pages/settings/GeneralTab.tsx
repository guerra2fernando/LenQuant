/* eslint-disable */
// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { useTheme } from "next-themes";

import { TooltipExplainer } from "@/components/TooltipExplainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fetcher, postJson } from "@/lib/api";

const SETTINGS_STORAGE_KEY = "cryptotrader-settings-v1";

type AutoRefreshSettings = {
  enabled: boolean;
  intervalSeconds: number;
};

type LocalSettings = {
  autoRefresh: AutoRefreshSettings;
};

const DEFAULT_SETTINGS: LocalSettings = {
  autoRefresh: {
    enabled: false,
    intervalSeconds: 60,
  },
};

const STATUS_ENDPOINTS = [
  { key: "status", label: "API Health", path: "/api/status" },
  { key: "overview", label: "Admin Overview", path: "/api/admin/overview" },
  { key: "reports", label: "Recent Reports", path: "/api/reports?limit=3" },
  { key: "runs", label: "Simulation Runs", path: "/api/run/sim?limit=3" },
] as const;

type EndpointKey = (typeof STATUS_ENDPOINTS)[number]["key"];

type EndpointState = "ok" | "warning" | "error";

type EndpointStatus = {
  key: EndpointKey;
  label: string;
  path: string;
  state: EndpointState;
  message: string;
};

type ModelHorizonSetting = {
  name: string;
  train_window_days: number;
  retrain_cadence: string;
  threshold_pct: number;
};

type ModelSettingsResponse = {
  horizons: ModelHorizonSetting[];
  updated_at?: string | null;
};

type RetrainJob = {
  _id: string;
  symbols: string[];
  algorithm: string;
  promote?: boolean;
  dry_run?: boolean;
  status: string;
  commands?: string[];
  created_at?: string;
  finished_at?: string | null;
  logs?: Array<{
    command?: string | null;
    status?: string;
    returncode?: number;
  }>;
};

const extractEndpointStatus = (endpoint: (typeof STATUS_ENDPOINTS)[number], response: unknown): EndpointStatus => {
  if (endpoint.key === "status") {
    const statusResponse = response as { status?: string };
    const state = statusResponse?.status === "ok" ? "ok" : "warning";
    return {
      ...endpoint,
      state,
      message: statusResponse?.status ? statusResponse.status.toUpperCase() : "Unknown status response",
    };
  }

  if (endpoint.key === "overview") {
    const overview = response as { inventory?: Array<unknown>; available_symbols?: Array<string> };
    const inventoryCount = overview?.inventory?.length ?? 0;
    const symbolCount = overview?.available_symbols?.length ?? 0;
    const state: EndpointState = inventoryCount > 0 ? "ok" : "warning";
    const message =
      inventoryCount > 0
        ? `${inventoryCount} inventory rows • ${symbolCount} symbols`
        : "No inventory rows returned";
    return { ...endpoint, state, message };
  }

  if (endpoint.key === "reports") {
    const reports = response as { reports?: Array<unknown> };
    const count = reports?.reports?.length ?? 0;
    const state: EndpointState = count > 0 ? "ok" : "warning";
    const message = count > 0 ? `${count} recent reports` : "No reports available";
    return { ...endpoint, state, message };
  }

  if (endpoint.key === "runs") {
    const runs = response as { runs?: Array<unknown> };
    const count = runs?.runs?.length ?? 0;
    const state: EndpointState = count > 0 ? "ok" : "warning";
    const message = count > 0 ? `${count} recorded runs` : "No simulation runs returned";
    return { ...endpoint, state, message };
  }

  return {
    ...endpoint,
    state: "warning",
    message: "Unhandled endpoint response",
  };
};

const loadEndpointStatuses = async (): Promise<EndpointStatus[]> => {
  const results = await Promise.allSettled(
    STATUS_ENDPOINTS.map(async (endpoint) => {
      const response = await fetcher(endpoint.path);
      return extractEndpointStatus(endpoint, response);
    }),
  );

  return results.map((result, index) => {
    const endpoint = STATUS_ENDPOINTS[index];
    if (result.status === "fulfilled") {
      return result.value;
    }

    const error = result.reason;
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      ...endpoint,
      state: "error" as const,
      message,
    };
  });
};

const loadInitialSettings = (): LocalSettings => {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Partial<LocalSettings>;
    return {
      autoRefresh: {
        enabled: parsed.autoRefresh?.enabled ?? DEFAULT_SETTINGS.autoRefresh.enabled,
        intervalSeconds: parsed.autoRefresh?.intervalSeconds ?? DEFAULT_SETTINGS.autoRefresh.intervalSeconds,
      },
    };
  } catch (error) {
    console.warn("Failed to read stored settings", error);
    return DEFAULT_SETTINGS;
  }
};

export default function GeneralTab(): JSX.Element {
  const [settings, setSettings] = useState<LocalSettings>(DEFAULT_SETTINGS);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null);
  const [bulkRunMessage, setBulkRunMessage] = useState<string | null>(null);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [newSymbol, setNewSymbol] = useState<string>("");
  const [symbolMessage, setSymbolMessage] = useState<string | null>(null);
  const [isAddingSymbol, setIsAddingSymbol] = useState(false);

  const refreshIntervalMs = useMemo(
    () => (settings.autoRefresh.enabled ? Math.max(settings.autoRefresh.intervalSeconds, 5) * 1000 : 0),
    [settings.autoRefresh.enabled, settings.autoRefresh.intervalSeconds],
  );

  useEffect(() => {
    const initial = loadInitialSettings();
    setSettings(initial);
  }, []);

  const persistSettings = (nextSettings: LocalSettings) => {
    setSettings(nextSettings);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
    }
  };

  const handleAutoRefreshEnabledChange = (enabled: boolean) => {
    persistSettings({
      autoRefresh: {
        enabled,
        intervalSeconds: settings.autoRefresh.intervalSeconds,
      },
    });
  };

  const handleIntervalChange = (value: string) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }
    const clamped = Math.min(Math.max(parsed, 5), 600);
    persistSettings({
      autoRefresh: {
        enabled: settings.autoRefresh.enabled,
        intervalSeconds: clamped,
      },
    });
  };

  const handleResetSettings = () => {
    persistSettings(DEFAULT_SETTINGS);
  };

  const { theme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  const currentTheme = themeMounted ? theme ?? "system" : "system";

  const {
    data: statuses,
    error: statusError,
    isLoading: statusesLoading,
    mutate: mutateStatuses,
  } = useSWR(
    "cryptotrader.settings.endpoint-status",
    loadEndpointStatuses,
    {
      refreshInterval: refreshIntervalMs,
      revalidateOnFocus: false,
      onSuccess: () => setLastChecked(new Date()),
    },
  );

  const { data: modelSettings, mutate: mutateModelSettings } = useSWR<ModelSettingsResponse>(
    "/api/settings/models",
    fetcher,
  );
  const [modelSettingsDraft, setModelSettingsDraft] = useState<ModelHorizonSetting[]>([]);
  const [modelSettingsMessage, setModelSettingsMessage] = useState<string | null>(null);
  const [savingModelSettings, setSavingModelSettings] = useState(false);
  const { data: retrainJobs, mutate: mutateRetrainJobs } = useSWR<{ jobs: RetrainJob[] }>(
    "/api/models/retrain/jobs?limit=6",
    fetcher,
    { refreshInterval: 30_000 },
  );
  const { data: overview, mutate: mutateOverview } = useSWR<{
    available_symbols: string[];
    default_symbols: string[];
    default_intervals: string[];
    default_lookback_days: number;
    inventory?: Array<{
      symbol: string;
      interval: string;
      ohlcv_count: number;
      features_count: number;
      latest_candle: string | null;
      latest_feature: string | null;
    }>;
  }>("/api/admin/overview", fetcher);

  const { data: systemStatus } = useSWR<{ status: string }>("/api/status", fetcher, {
    refreshInterval: refreshIntervalMs,
  });

  const { data: recentReports } = useSWR<{ reports: Array<{ date: string; summary?: string }> }>("/api/reports?limit=3", fetcher, {
    refreshInterval: refreshIntervalMs,
  });

  const inventory = overview?.inventory ?? [];
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
  const latestReport = recentReports?.reports?.[0] ?? null;

  useEffect(() => {
    if (modelSettings?.horizons?.length) {
      setModelSettingsDraft(modelSettings.horizons.map((item) => ({ ...item })));
    }
  }, [modelSettings?.horizons]);

  const updateHorizonField = (index: number, field: keyof ModelHorizonSetting, value: string | number) => {
    setModelSettingsDraft((prev) => {
      if (!prev.length) {
        return prev;
      }
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: typeof value === "string" ? value : Number(value),
      };
      return next;
    });
  };

  const handleTrainWindowChange = (index: number, rawValue: string) => {
    const parsed = Number(rawValue);
    const clamped = Number.isNaN(parsed) ? 0 : Math.max(1, Math.min(3650, Math.floor(parsed)));
    updateHorizonField(index, "train_window_days", clamped);
  };

  const handleCadenceChange = (index: number, value: string) => {
    updateHorizonField(index, "retrain_cadence", value.toLowerCase());
  };

  const handleThresholdChange = (index: number, rawValue: string) => {
    const parsed = Number(rawValue) / 100;
    const safeValue = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(1, parsed));
    updateHorizonField(index, "threshold_pct", safeValue);
  };

  const handleResetModelSettings = () => {
    if (modelSettings?.horizons?.length) {
      setModelSettingsDraft(modelSettings.horizons.map((item) => ({ ...item })));
    } else {
      setModelSettingsDraft([]);
    }
    setModelSettingsMessage(null);
  };

  const handleSaveModelSettings = async () => {
    if (!modelSettingsDraft.length) {
      return;
    }
    setSavingModelSettings(true);
    setModelSettingsMessage(null);
    try {
      await postJson("/api/settings/models", { horizons: modelSettingsDraft });
      setModelSettingsMessage("Model preferences saved.");
      await mutateModelSettings();
    } catch (error) {
      setModelSettingsMessage(error instanceof Error ? error.message : "Failed to persist model settings.");
    } finally {
      setSavingModelSettings(false);
    }
  };

  const handleAddSymbol = async () => {
    const trimmedSymbol = newSymbol.trim().toUpperCase();
    if (!trimmedSymbol) {
      setSymbolMessage("Please enter a symbol (e.g., BTC/USD, ETH/USD)");
      return;
    }
    
    // Validate format (should contain a /)
    if (!trimmedSymbol.includes("/")) {
      setSymbolMessage("Symbol must be in format like BTC/USD or ETH/USDT");
      return;
    }

    setIsAddingSymbol(true);
    setSymbolMessage(null);
    try {
      const response = await postJson("/api/admin/bootstrap", {
        symbols: [trimmedSymbol],
        intervals: overview?.default_intervals || ["1m", "5m"],
        lookback_days: overview?.default_lookback_days || 30,
      });
      setSymbolMessage(`Successfully added ${trimmedSymbol} and fetched ${response.ingested?.length || 0} datasets`);
      setNewSymbol("");
      await mutateOverview();
    } catch (error) {
      setSymbolMessage(error instanceof Error ? error.message : `Failed to add ${trimmedSymbol}`);
    } finally {
      setIsAddingSymbol(false);
    }
  };

  const renderEndpointBadge = (state: EndpointState) => {
    if (state === "ok") {
      return (
        <Badge variant="success" className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          OK
        </Badge>
      );
    }
    if (state === "warning") {
      return (
        <Badge variant="warning" className="inline-flex items-center gap-1">
          <TriangleAlert className="h-3.5 w-3.5" />
          Check
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="inline-flex items-center gap-1">
        <TriangleAlert className="h-3.5 w-3.5" />
        Error
      </Badge>
    );
  };

  return (
    <div className="space-y-8">
      {bootstrapMessage ? (
        <div className="rounded-lg border border-muted bg-muted/20 p-3 text-sm text-muted-foreground">{bootstrapMessage}</div>
      ) : null}
      {bulkRunMessage ? (
        <div className="rounded-lg border border-muted bg-muted/20 p-3 text-sm text-muted-foreground">{bulkRunMessage}</div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Theme & Appearance
              <TooltipExplainer 
                term="Theme & Appearance" 
                explanation="Choose how the interface looks. Light mode is easier on the eyes in bright environments, dark mode reduces eye strain in low light, and system mode automatically matches your device's theme preference."
              />
            </CardTitle>
            <CardDescription>Switch between light, dark, or system-based themes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {["light", "dark", "system"].map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={currentTheme === option ? "default" : "outline"}
                  onClick={() => setTheme(option)}
                  disabled={!themeMounted}
                >
                  {option === "system" ? "System" : option === "dark" ? "Dark" : "Light"}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Theme preference persists in your browser via `next-themes`. The header toggle mirrors this selection.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Auto-refresh
              <TooltipExplainer 
                term="Auto-refresh" 
                explanation="When enabled, the dashboard automatically updates with the latest data at your chosen interval. This keeps information current without manually refreshing the page. Lower intervals (5-30s) keep data fresher but use more resources."
              />
            </CardTitle>
            <CardDescription>Control how often dashboards poll the API for fresh data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Enable auto-refresh</p>
                <p className="text-xs text-muted-foreground">
                  Applies to overview widgets and report summaries in this session.
                </p>
              </div>
              <Checkbox
                checked={settings.autoRefresh.enabled}
                onCheckedChange={(value) => handleAutoRefreshEnabledChange(value === true)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="refresh-interval">
                Refresh interval (seconds)
                <TooltipExplainer 
                  term="Refresh interval" 
                  explanation="How many seconds to wait between automatic data updates. For example, 30 means the page will refresh data every 30 seconds. Shorter intervals keep data more current but increase server load and bandwidth usage."
                />
              </Label>
              <Input
                id="refresh-interval"
                type="number"
                min={5}
                max={600}
                step={5}
                value={settings.autoRefresh.intervalSeconds}
                onChange={(event) => handleIntervalChange(event.target.value)}
                disabled={!settings.autoRefresh.enabled}
              />
              <p className="text-xs text-muted-foreground">Allowed range: 5s - 10m. Stored per browser.</p>
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" onClick={handleResetSettings} type="button">
                Reset to defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>
              Symbol Management
              <TooltipExplainer 
                term="Symbol Management" 
                explanation="Manage which cryptocurrency trading pairs (like BTC/USD or ETH/USDT) the system tracks. Adding a symbol downloads historical price data and enables the assistant to trade that cryptocurrency. More symbols provide more opportunities but require more data storage and processing."
              />
            </CardTitle>
            <CardDescription>
              Add new cryptocurrency pairs to track and pull market data for. The system will automatically start fetching price data and calculating features.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {symbolMessage ? (
              <div className="rounded-lg border border-muted bg-muted/20 p-3 text-sm text-muted-foreground">
                {symbolMessage}
              </div>
            ) : null}
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="new-symbol">Add New Symbol</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Enter a trading pair (e.g., BTC/USD, ETH/USD, SOL/USDT, DOGE/USD)
                </p>
                <div className="flex gap-2">
                  <Input
                    id="new-symbol"
                    placeholder="BTC/USD"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleAddSymbol();
                      }
                    }}
                    disabled={isAddingSymbol}
                  />
                  <Button onClick={handleAddSymbol} disabled={isAddingSymbol || !newSymbol.trim()}>
                    {isAddingSymbol ? "Adding..." : "Add Symbol"}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-foreground mb-2">Current Symbols ({overview?.available_symbols?.length || 0})</p>
                <div className="flex flex-wrap gap-2">
                  {overview?.available_symbols?.length ? (
                    overview.available_symbols.map((symbol) => (
                      <Badge key={symbol} variant="secondary" className="text-sm">
                        {symbol}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No symbols configured yet</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-medium text-primary mb-1">How it works:</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• Adding a symbol fetches the last {overview?.default_lookback_days || 30} days of market data</li>
                  <li>• Data is pulled at intervals: {overview?.default_intervals?.join(", ") || "1m, 5m"}</li>
                  <li>• Features are calculated automatically for model training</li>
                  <li>• The assistant can only negotiate with coins that have data downloaded</li>
                  <li>• Once added, data continues to update automatically</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>
              Data Maintenance
              <TooltipExplainer 
                term="Data Maintenance" 
                explanation="This runs the complete data preparation pipeline: downloads historical price data (candles) for all configured symbols, calculates technical indicators and features, runs a baseline simulation to test the setup, and generates a performance report. Run this when first setting up the system or adding new trading pairs."
              />
            </CardTitle>
            <CardDescription>
              Run the initial data setup pipeline (seed symbols, ingest candles, rebuild features, run the baseline sim, and generate a report).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Uses `/api/admin/bootstrap` with the currently configured default symbols and intervals. Expect runtime of a few minutes
              depending on lookback.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={async () => {
                  setBootstrapMessage(null);
                  setIsBootstrapping(true);
                  try {
                    const response = await postJson("/api/admin/bootstrap", {});
                    const ingested = Array.isArray(response?.ingested) ? response.ingested.length : 0;
                    setBootstrapMessage(
                      `Data setup complete (${ingested} ingest batches). Latest report: ${response?.report_path ?? "n/a"}.`,
                    );
                    await mutateOverview();
                  } catch (error) {
                    setBootstrapMessage(error instanceof Error ? error.message : "Failed to run data setup.");
                  } finally {
                    setIsBootstrapping(false);
                  }
                }}
                disabled={isBootstrapping}
              >
                {isBootstrapping ? "Setting up…" : "Run Data Setup"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Monitor progress on the dashboard (`/`), strategies table, and recent reports while the job runs.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>
              Model Retraining Preferences
              <TooltipExplainer 
                term="Model Retraining Preferences" 
                explanation="Machine learning models that predict price movements need periodic retraining with fresh data to stay accurate. These settings control how often models are retrained (daily/weekly/monthly), how much historical data to use for training, and the minimum performance threshold for activating a model. Each horizon (short/mid/long) can have different settings."
              />
            </CardTitle>
            <CardDescription>
              Configure per-horizon training windows, cadences, and activation thresholds saved in MongoDB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {modelSettingsMessage ? (
              <div className="rounded-lg border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">
                {modelSettingsMessage}
              </div>
            ) : null}

            {modelSettingsDraft.length ? (
              <div className="grid gap-4 md:grid-cols-3">
                {modelSettingsDraft.map((item, index) => {
                  const thresholdPercent = (item.threshold_pct * 100).toFixed(3);
                  return (
                    <div key={item.name} className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{item.name.toUpperCase()}</span>
                        <Badge variant="secondary">{item.retrain_cadence.toUpperCase()}</Badge>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`train-${item.name}`}>
                          Train window (days)
                          <TooltipExplainer 
                            term="Train window" 
                            explanation="How many days of historical price data to use when training the model. More days provide more data but may include outdated patterns. For example, 365 means the model learns from the past year of trading data."
                          />
                        </Label>
                        <Input
                          id={`train-${item.name}`}
                          type="number"
                          min={1}
                          max={3650}
                          value={item.train_window_days}
                          onChange={(event) => handleTrainWindowChange(index, event.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`cadence-${item.name}`}>
                          Retrain cadence
                          <TooltipExplainer 
                            term="Retrain cadence" 
                            explanation="How often to retrain the model with fresh data. Daily keeps models most current but uses more computing resources. Weekly or monthly is suitable for longer-term strategies. More frequent retraining helps models adapt to changing market conditions."
                          />
                        </Label>
                        <select
                          id={`cadence-${item.name}`}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={item.retrain_cadence}
                          onChange={(event) => handleCadenceChange(index, event.target.value)}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`threshold-${item.name}`}>
                          Activation threshold (%)
                          <TooltipExplainer 
                            term="Activation threshold" 
                            explanation="The minimum accuracy percentage a model must achieve in testing before it's activated for making predictions. For example, 65% means the model must be correct at least 65% of the time. Higher thresholds ensure only high-quality models are used but may reject models that could still be profitable."
                          />
                        </Label>
                        <Input
                          id={`threshold-${item.name}`}
                          type="number"
                          min={0}
                          max={100}
                          step={0.001}
                          value={thresholdPercent}
                          onChange={(event) => handleThresholdChange(index, event.target.value)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Loading preferences…</div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {modelSettings?.updated_at
                  ? `Last updated ${new Date(modelSettings.updated_at).toLocaleString()}`
                  : "No saved preferences yet."}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetModelSettings}
                  disabled={savingModelSettings || !modelSettings?.horizons?.length}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveModelSettings}
                  disabled={savingModelSettings || !modelSettingsDraft.length}
                >
                  {savingModelSettings ? "Saving…" : "Save preferences"}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isBulkRunning}
                onClick={async () => {
                  setBulkRunMessage(null);
                  setIsBulkRunning(true);
                  try {
                    const response = await postJson("/api/models/retrain/bulk", {
                      algorithm: "rf",
                      promote: false,
                      dry_run: true,
                    });
                    setBulkRunMessage(
                      `Dry-run scheduled (job ${response.job_id}). ${response.command_count} commands across ${response.symbol_count} symbol(s).`,
                    );
                    await mutateRetrainJobs();
                  } catch (error) {
                    setBulkRunMessage(error instanceof Error ? error.message : "Failed to schedule dry run.");
                  } finally {
                    setIsBulkRunning(false);
                  }
                }}
              >
                {isBulkRunning ? "Scheduling…" : "Dry-run retraining"}
              </Button>
              <Button
                size="sm"
                disabled={isBulkRunning}
                onClick={async () => {
                  setBulkRunMessage(null);
                  setIsBulkRunning(true);
                  try {
                    const response = await postJson("/api/models/retrain/bulk", {
                      algorithm: "rf",
                      promote: false,
                      dry_run: false,
                    });
                    setBulkRunMessage(
                      `Retraining scheduled (job ${response.job_id}) with ${response.command_count} commands queued.`,
                    );
                    await mutateRetrainJobs();
                  } catch (error) {
                    setBulkRunMessage(error instanceof Error ? error.message : "Failed to schedule retraining.");
                  } finally {
                    setIsBulkRunning(false);
                  }
                }}
              >
                {isBulkRunning ? "Scheduling…" : "Start retraining"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Jobs use the saved horizon preferences and default symbols; results appear below once queued.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>
              Retraining Jobs
              <TooltipExplainer 
                term="Retraining Jobs" 
                explanation="A log of recent model retraining operations. Each job represents a batch of models being retrained with updated market data. The status shows whether training completed successfully, is still running, or encountered errors. This helps you track when your models were last updated."
              />
            </CardTitle>
            <CardDescription>Recent bulk retraining runs. Updated automatically every 30 seconds.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {retrainJobs?.jobs?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Symbols</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Finished</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retrainJobs.jobs.map((job) => (
                    <TableRow key={job._id}>
                      <TableCell className="font-mono text-xs">{job._id.slice(-8).toUpperCase()}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            job.status === "succeeded"
                              ? "success"
                              : job.status === "failed"
                              ? "destructive"
                              : job.status === "dry_run"
                              ? "secondary"
                              : "warning"
                          }
                        >
                          {job.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{job.symbols?.join(", ") ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {job.created_at ? new Date(job.created_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {job.finished_at ? new Date(job.finished_at).toLocaleString() : job.status === "scheduled" ? "Running…" : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No retraining jobs scheduled yet.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>
              System Status
              <TooltipExplainer 
                term="System Status" 
                explanation="Overview of platform health and data pipeline status. Shows the current state of your trading system including tracked pairs, latest market data, and recent reports."
              />
            </CardTitle>
            <CardDescription>Current platform health and data pipeline status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Platform Status</p>
                <p className="text-xs text-muted-foreground">Overall system health</p>
              </div>
              <Badge variant={systemStatus?.status === "ok" ? "default" : "destructive"}>
                {systemStatus ? (systemStatus.status === "ok" ? "Healthy" : systemStatus.status) : "Loading"}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Tracked Pairs</p>
                <p className="text-lg font-semibold text-foreground">{uniqueSymbolsCount}</p>
                <p className="text-xs text-muted-foreground">{inventory.length} datasets ingested</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Latest Market Data</p>
                <p className="text-lg font-semibold text-foreground">
                  {latestCandleDisplay ?? "Awaiting sync"}
                </p>
                <p className="text-xs text-muted-foreground">Most recent candle timestamp</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Latest Report</p>
                <p className="text-lg font-semibold text-foreground">
                  {latestReport?.date ?? "No reports yet"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {latestReport?.summary ? latestReport.summary : "Generate a report to see insights"}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Available Symbols</p>
                <p className="text-lg font-semibold text-foreground">{overview?.available_symbols?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Configured for data ingestion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>
                API Endpoint Status
                <TooltipExplainer 
                  term="API Endpoint Status" 
                  explanation="Real-time health checks of the backend API services that power the trading system. Green (OK) means the service is responding correctly. Yellow (Check) means data is available but may need attention. Red (Error) indicates a service is down or failing. Use this to diagnose issues with data, reports, or trading functionality."
                />
              </CardTitle>
              <CardDescription>Live snapshot of key backend services queried directly from FastAPI.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {refreshIntervalMs > 0 ? (
                <Badge variant="secondary">{`Auto-refresh: ${Math.round(refreshIntervalMs / 1000)}s`}</Badge>
              ) : (
                <Badge variant="secondary">Manual refresh</Badge>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void mutateStatuses();
                }}
              >
                Refresh now
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusesLoading && !statuses ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking endpoints&hellip;
              </div>
            ) : null}

            {statusError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
                Failed to load endpoint statuses. {statusError instanceof Error ? statusError.message : "Unknown error"}
              </div>
            ) : null}

            {statuses?.length ? (
              <ul className="space-y-3">
                {statuses.map((endpoint) => (
                  <li
                    key={endpoint.key}
                    className={cn(
                      "flex flex-col gap-2 rounded-lg border bg-muted/30 p-4 transition-colors md:flex-row md:items-center md:justify-between",
                      endpoint.state === "error" && "border-destructive/60 bg-destructive/10",
                      endpoint.state === "ok" && "border-emerald-200/80 bg-emerald-100/10 dark:border-emerald-900/40",
                    )}
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{endpoint.label}</p>
                      <p className="text-xs text-muted-foreground">{endpoint.message}</p>
                    </div>
                    {renderEndpointBadge(endpoint.state)}
                  </li>
                ))}
              </ul>
            ) : null}

            {lastChecked ? (
              <p className="text-xs text-muted-foreground">Last checked: {lastChecked.toLocaleString()}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

