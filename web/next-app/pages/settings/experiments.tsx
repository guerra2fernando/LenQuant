/* eslint-disable */
// @ts-nocheck
import { useEffect, useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetcher, postJson } from "@/lib/api";

type ExperimentSettings = {
  symbol: string;
  interval: string;
  accounts: number;
  mutations_per_parent: number;
  champion_limit: number;
  families: string[];
  auto_promote_threshold: number;
  min_confidence: number;
  min_return: number;
  max_queue: number;
  updated_at?: string | null;
};

const DEFAULT_SETTINGS: ExperimentSettings = {
  symbol: "BTC/USDT",
  interval: "1m",
  accounts: 20,
  mutations_per_parent: 4,
  champion_limit: 5,
  families: ["ema-cross"],
  auto_promote_threshold: 2.0,
  min_confidence: 0.6,
  min_return: 0.001,
  max_queue: 50,
};

export default function ExperimentSettingsPage() {
  const { data, mutate } = useSWR<ExperimentSettings>("/api/settings/experiments", fetcher);
  const [form, setForm] = useState<ExperimentSettings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        ...DEFAULT_SETTINGS,
        ...data,
        families: Array.isArray(data.families) ? data.families : DEFAULT_SETTINGS.families,
      });
    }
  }, [data?.symbol, data?.interval, data?.accounts]);

  const updateField = (field: keyof ExperimentSettings, value: unknown) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await postJson("/api/settings/experiments", {
        ...form,
        families: form.families.map((item) => item.trim()).filter(Boolean),
      });
      setMessage("Experiment preferences saved.");
      await mutate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update experiment settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-foreground">Experiment Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the Phase 2 evolution engine defaults — mutation cadence, concurrency, and promotion thresholds.
        </p>
      </section>

      {message ? (
        <div className="rounded-lg border border-muted bg-muted/20 p-3 text-sm text-muted-foreground">{message}</div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Experiment Defaults</CardTitle>
          <CardDescription>Used by `/api/experiments/run` when parameters are omitted.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Symbol" value={form.symbol} onChange={(value) => updateField("symbol", value)} />
          <Field label="Interval" value={form.interval} onChange={(value) => updateField("interval", value)} />
          <Field
            type="number"
            label="Accounts"
            value={form.accounts}
            min={1}
            max={200}
            onChange={(value) => updateField("accounts", Number(value))}
          />
          <Field
            type="number"
            label="Mutations per parent"
            value={form.mutations_per_parent}
            min={1}
            max={20}
            onChange={(value) => updateField("mutations_per_parent", Number(value))}
          />
          <Field
            type="number"
            label="Champion limit"
            value={form.champion_limit}
            min={1}
            max={20}
            onChange={(value) => updateField("champion_limit", Number(value))}
          />
          <Field
            type="number"
            label="Auto-promote threshold"
            value={form.auto_promote_threshold}
            step={0.1}
            min={0}
            max={10}
            onChange={(value) => updateField("auto_promote_threshold", Number(value))}
          />
          <Field
            type="number"
            label="Min confidence"
            value={form.min_confidence}
            step={0.01}
            min={0}
            max={1}
            onChange={(value) => updateField("min_confidence", Number(value))}
          />
          <Field
            type="number"
            label="Min return"
            value={form.min_return}
            step={0.0001}
            min={0}
            max={0.5}
            onChange={(value) => updateField("min_return", Number(value))}
          />
          <Field
            type="number"
            label="Max queue size"
            value={form.max_queue}
            min={1}
            max={500}
            onChange={(value) => updateField("max_queue", Number(value))}
          />

          <div className="md:col-span-2 lg:col-span-3 space-y-2">
            <Label htmlFor="families">Strategy families</Label>
            <Textarea
              id="families"
              rows={3}
              value={form.families.join("\n")}
              onChange={(event) => updateField("families", event.target.value.split("\n"))}
            />
            <p className="text-xs text-muted-foreground">One family per line. Default seeds: {DEFAULT_SETTINGS.families.join(", ")}.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {form.updated_at ? `Last updated ${new Date(form.updated_at).toLocaleString()}` : "Never saved."}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setForm(DEFAULT_SETTINGS);
            }}
            disabled={saving}
          >
            Reset defaults
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Defaults</CardTitle>
          <CardDescription>Snapshot of values used for experiment orchestration.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2 md:grid-cols-3">
          <Snapshot label="Symbol" value={form.symbol} />
          <Snapshot label="Interval" value={form.interval} />
          <Snapshot label="Accounts" value={String(form.accounts)} />
          <Snapshot label="Mutations" value={String(form.mutations_per_parent)} />
          <Snapshot label="Champion limit" value={String(form.champion_limit)} />
          <Snapshot label="Families" value={form.families.join(", ")} />
          <Snapshot label="Auto-promote threshold" value={form.auto_promote_threshold.toFixed(2)} />
          <Snapshot label="Min confidence" value={form.min_confidence.toFixed(2)} />
          <Snapshot label="Min return" value={form.min_return.toFixed(4)} />
          <Snapshot label="Max queue" value={String(form.max_queue)} />
        </CardContent>
      </Card>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
};

function Field({ label, value, onChange, type = "text", min, max, step }: FieldProps) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

type SnapshotProps = {
  label: string;
  value: string;
};

function Snapshot({ label, value }: SnapshotProps) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}


