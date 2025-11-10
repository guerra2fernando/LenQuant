import { useEffect, useState } from "react";
import useSWR from "swr";

import { AutomationToggle } from "@/components/AutomationToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SafetyGuardSummary } from "@/components/SafetyGuardSummary";
import { fetcher, putJson } from "@/lib/api";

type AutonomySettings = {
  auto_promote: boolean;
  auto_promote_threshold: number;
  safety_limits: Record<string, number | string>;
  knowledge_retention_weeks: number;
  llm_provider: string;
  llm_model?: string;
};

const PROVIDERS = ["disabled", "openai", "google", "gemini"];

export default function AutonomySettingsPage() {
  const { data, mutate } = useSWR<AutonomySettings>("/api/settings/autonomy", fetcher);
  const [form, setForm] = useState<AutonomySettings>({
    auto_promote: false,
    auto_promote_threshold: 0.05,
    safety_limits: { max_leverage: 5, max_drawdown: 0.2 },
    knowledge_retention_weeks: 12,
    llm_provider: "disabled",
    llm_model: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        auto_promote: data.auto_promote ?? false,
        auto_promote_threshold: data.auto_promote_threshold ?? 0.05,
        safety_limits: data.safety_limits ?? {},
        knowledge_retention_weeks: data.knowledge_retention_weeks ?? 12,
        llm_provider: data.llm_provider ?? "disabled",
        llm_model: data.llm_model ?? "",
      });
    }
  }, [data]);

  const updateField = <K extends keyof AutonomySettings>(key: K, value: AutonomySettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await putJson("/api/settings/autonomy", form);
      await mutate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Autonomy Settings</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure auto-promotion thresholds, safety guard rails, and knowledge retention windows.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <AutomationToggle enabled={form.auto_promote} onChange={(value) => updateField("auto_promote", value)} />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="threshold">Auto-Promote Threshold</Label>
              <Input
                id="threshold"
                type="number"
                step="0.01"
                value={form.auto_promote_threshold}
                onChange={(event) => updateField("auto_promote_threshold", Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retention">Knowledge Retention (weeks)</Label>
              <Input
                id="retention"
                type="number"
                value={form.knowledge_retention_weeks}
                onChange={(event) => updateField("knowledge_retention_weeks", Number(event.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider">Hypothesis Provider</Label>
              <select
                id="provider"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={form.llm_provider}
                onChange={(event) => updateField("llm_provider", event.target.value)}
              >
                {PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input id="model" value={form.llm_model ?? ""} onChange={(event) => updateField("llm_model", event.target.value)} />
            </div>
          </div>

          <SafetyGuardSummary safetyLimits={form.safety_limits} />

          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

