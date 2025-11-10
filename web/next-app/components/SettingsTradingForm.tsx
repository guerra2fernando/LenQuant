/* eslint-disable */
// @ts-nocheck
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TradingSettings = {
  modes: Record<string, { enabled: boolean; max_notional_usd: number }>;
  risk: { max_trade_usd: number; max_daily_loss_usd: number; max_open_exposure_usd: number };
  auto_mode: { enabled: boolean; confidence_threshold: number; max_trade_usd: number; default_mode: string };
  alerts: { channels: string[] };
};

type SettingsTradingFormProps = {
  settings: TradingSettings;
  onSubmit: (payload: Partial<TradingSettings>) => Promise<void>;
  isSaving?: boolean;
};

export function SettingsTradingForm({ settings, onSubmit, isSaving = false }: SettingsTradingFormProps) {
  const [draft, setDraft] = useState(settings);
  const channelsText = draft.alerts.channels.join(", ");

  const handleNumberChange = (path: string[], value: string) => {
    setDraft((prev) => updateNested(prev, path, parseFloat(value) || 0));
  };

  const handleToggle = (path: string[], value: boolean) => {
    setDraft((prev) => updateNested(prev, path, value));
  };

  const handleChannelsChange = (value: string) => {
    const segments = value.split(",").map((item) => item.trim()).filter(Boolean);
    setDraft((prev) => updateNested(prev, ["alerts", "channels"], segments));
  };

  const handleSubmit = async () => {
    await onSubmit({
      risk: draft.risk,
      auto_mode: draft.auto_mode,
      alerts: draft.alerts,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Risk Limits</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field
              label="Max Trade (USD)"
              value={String(draft.risk.max_trade_usd)}
              onChange={(value) => handleNumberChange(["risk", "max_trade_usd"], value)}
            />
            <Field
              label="Max Daily Loss (USD)"
              value={String(draft.risk.max_daily_loss_usd)}
              onChange={(value) => handleNumberChange(["risk", "max_daily_loss_usd"], value)}
            />
            <Field
              label="Max Open Exposure (USD)"
              value={String(draft.risk.max_open_exposure_usd)}
              onChange={(value) => handleNumberChange(["risk", "max_open_exposure_usd"], value)}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Auto Mode</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <ToggleField
              label="Auto Mode Enabled"
              checked={draft.auto_mode.enabled}
              onChange={(checked) => handleToggle(["auto_mode", "enabled"], checked)}
            />
            <Field
              label="Confidence Threshold"
              value={String(draft.auto_mode.confidence_threshold)}
              onChange={(value) => handleNumberChange(["auto_mode", "confidence_threshold"], value)}
            />
            <Field
              label="Auto Max Trade (USD)"
              value={String(draft.auto_mode.max_trade_usd)}
              onChange={(value) => handleNumberChange(["auto_mode", "max_trade_usd"], value)}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Alert Channels</h3>
          <div className="grid gap-2">
            <Label>Channels (comma separated)</Label>
            <Input value={channelsText} onChange={(event) => handleChannelsChange(event.target.value)} />
          </div>
        </section>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        className={`h-6 w-12 rounded-full transition ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
        onClick={() => onChange(!checked)}
      >
        <span
          className={`m-1 block h-4 w-4 rounded-full bg-background transition ${checked ? "translate-x-6" : ""}`}
        />
      </button>
    </div>
  );
}

function updateNested<T extends Record<string, any>>(object: T, path: string[], value: unknown): T {
  const clone = structuredClone(object);
  let cursor: any = clone;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    cursor[key] = cursor[key] ?? {};
    cursor = cursor[key];
  }
  cursor[path[path.length - 1]] = value;
  return clone;
}

