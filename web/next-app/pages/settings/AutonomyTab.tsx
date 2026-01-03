import { useEffect, useState } from "react";
import useSWR from "swr";

import { TooltipExplainer } from "@/components/TooltipExplainer";
import { AutomationToggle } from "@/components/AutomationToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function AutonomyTab(): JSX.Element {
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
          <CardTitle>
            Autonomy Settings
            <TooltipExplainer 
              term="Autonomy Settings" 
              explanation="Controls how much the system can act on its own. This determines when successful trading strategies can be automatically deployed without your manual approval, how long the system remembers what it has learned, and whether AI is used to generate new strategy ideas (hypotheses)."
            />
          </CardTitle>
          <CardDescription>
            Explain when the evolution engine may act without review, how long knowledge stays fresh, and which LLM powers hypothesis
            generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AutomationToggle
            enabled={form.auto_promote}
            onChange={(value) => updateField("auto_promote", value)}
            label="Auto-promotion"
            description="Allow the system to promote successful experiments directly into trading without manual approval."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="threshold">
                Auto-Promote Threshold
                <TooltipExplainer 
                  term="Auto-Promote Threshold" 
                  explanation="How much better (as a percentage) a new strategy must perform compared to your current baseline strategy before it's automatically promoted to live trading. For example, 0.05 means the new strategy must be 5% more profitable. Higher thresholds mean only exceptional strategies get promoted automatically, reducing risk but potentially missing good opportunities."
                />
              </Label>
              <Input
                id="threshold"
                type="number"
                step="0.01"
                value={form.auto_promote_threshold}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateField("auto_promote_threshold", Number(event.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Percentage lift over the control strategy that a candidate must sustain before it is promoted automatically.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retention">
                Knowledge Retention (weeks)
                <TooltipExplainer 
                  term="Knowledge Retention" 
                  explanation="How many weeks the system remembers insights and learnings from experiments before archiving them. Longer retention (12+ weeks) helps the system avoid repeating past mistakes, but very old lessons may become outdated as market conditions change. This affects how the AI assistant generates new strategy ideas."
                />
              </Label>
              <Input
                id="retention"
                type="number"
                value={form.knowledge_retention_weeks}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateField("knowledge_retention_weeks", Number(event.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Governs how long the assistant keeps experiment learnings in memory before rolling them off.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider">
                Hypothesis Provider
                <TooltipExplainer 
                  term="Hypothesis Provider" 
                  explanation="Which AI model to use for generating new trading strategy ideas (hypotheses) based on past performance. OpenAI and Google models can suggest creative new approaches. Choose 'disabled' to use only rule-based evolution (genetic algorithms) without AI creativity. AI-powered hypothesis generation can discover novel strategies but requires API access and costs."
                />
              </Label>
              <select
                id="provider"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={form.llm_provider}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateField("llm_provider", event.target.value)}
              >
                {PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Select the model used for autonomy reasoning. Choose `disabled` to keep hypothesis generation fully rule-based.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">
                Model
                <TooltipExplainer 
                  term="Model (Autonomy)" 
                  explanation="The specific AI model version to use for generating strategy hypotheses (e.g., ' GPT-5o-mini' for faster/cheaper, ' GPT-5' for more capable). Leave blank to use the provider's recommended default. Different models balance cost, speed, and creativity differently."
                />
              </Label>
              <Input id="model" value={form.llm_model ?? ""} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateField("llm_model", event.target.value)} />
              <p className="text-xs text-muted-foreground">
                Optional model identifier (e.g., ` GPT-5o-mini`). Leave blank to use the provider&rsquo;s default recommendation.
              </p>
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






