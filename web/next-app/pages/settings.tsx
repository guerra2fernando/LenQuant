/* eslint-disable */
// @ts-nocheck
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { useTheme } from "next-themes";

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

const SETTINGS_STORAGE_KEY = "lenxys-settings-v1";

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

export default function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<LocalSettings>(DEFAULT_SETTINGS);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null);
  const [bulkRunMessage, setBulkRunMessage] = useState<string | null>(null);
  const [isBulkRunning, setIsBulkRunning] = useState(false);

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
    "lenxys.settings.endpoint-status",
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
      <section>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preferences are stored locally for now and will sync with backend settings in Phase 2.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/settings/experiments">Open experiment settings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings/learning">Learning engine settings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings/assistant">Assistant settings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings/autonomy">Autonomy guard rails</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Theme & Appearance</CardTitle>
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
            <CardTitle>Auto-refresh</CardTitle>
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
              <Label htmlFor="refresh-interval">Refresh interval (seconds)</Label>
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
            <CardTitle>Data Maintenance</CardTitle>
            <CardDescription>
              Trigger the Phase 0 bootstrap workflow (seed symbols, ingest candles, rebuild features, run baseline sim, and generate a report).
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
                      `Bootstrap complete (${ingested} ingest batches). Latest report: ${response?.report_path ?? "n/a"}.`,
                    );
                  } catch (error) {
                    setBootstrapMessage(error instanceof Error ? error.message : "Failed to run bootstrap.");
                  } finally {
                    setIsBootstrapping(false);
                  }
                }}
                disabled={isBootstrapping}
              >
                {isBootstrapping ? "Bootstrapping…" : "Run Bootstrap"}
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
            <CardTitle>Model Retraining Preferences</CardTitle>
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
                        <Label htmlFor={`train-${item.name}`}>Train window (days)</Label>
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
                        <Label htmlFor={`cadence-${item.name}`}>Retrain cadence</Label>
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
                        <Label htmlFor={`threshold-${item.name}`}>Activation threshold (%)</Label>
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
            <CardTitle>Retraining Jobs</CardTitle>
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
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>API Endpoint Status</CardTitle>
              <CardDescription>Live snapshot of key Phase 0 services queried directly from FastAPI.</CardDescription>
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


