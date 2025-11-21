/* eslint-disable */
// @ts-nocheck
import { useEffect, useState } from "react";
import useSWR from "swr";

import { TooltipExplainer } from "@/components/TooltipExplainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { fetcher, postJson, putJson } from "@/lib/api";
import { toast } from "sonner";

type AssistantSettings = {
  provider: string;
  model?: string | null;
  redaction_rules: string[];
  max_evidence: number;
  lookback_days: number;
  auto_execute: boolean;
  auto_approve_below_usd: number;
  approval_threshold_usd: number;
  require_mfa: boolean;
  notification_channels: string[];
  updated_at?: string;
};

const PROVIDERS = [
  { value: "disabled", label: "Disabled" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google / Gemini" },
] as const;

export default function AssistantTab(): JSX.Element {
  const { data, mutate } = useSWR<AssistantSettings>("/api/settings/assistant", fetcher);
  const [draft, setDraft] = useState<AssistantSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setDraft(data);
    }
  }, [data]);

  const handleFieldChange = (field: keyof AssistantSettings, value: unknown) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return { ...prev, [field]: value };
    });
  };

  const handleArrayChange = (field: keyof AssistantSettings, value: string) => {
    const items = value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    handleFieldChange(field, items);
  };

  const handleSave = async () => {
    if (!draft) {
      return;
    }
    setIsSaving(true);
    try {
      await putJson("/api/settings/assistant", {
        provider: draft.provider,
        model: draft.model,
        redaction_rules: draft.redaction_rules,
        max_evidence: draft.max_evidence,
        lookback_days: draft.lookback_days,
        auto_execute: draft.auto_execute,
        auto_approve_below_usd: draft.auto_approve_below_usd,
        approval_threshold_usd: draft.approval_threshold_usd,
        require_mfa: draft.require_mfa,
        notification_channels: draft.notification_channels,
      });
      toast.success("Assistant settings saved");
      await mutate();
    } catch (error) {
      toast.error("Failed to save assistant settings", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestResult(null);
    try {
      const result = await postJson("/api/settings/assistant/test-connection", {});
      setTestResult(JSON.stringify(result, null, 2));
      toast.success("LLM connection succeeded", {
        description: `${result.provider ?? ""} (${result.model ?? "n/a"})`,
      });
    } catch (error) {
      toast.error("LLM connection failed", {
        description: error instanceof Error ? error.message : "Unable to reach provider",
      });
      setTestResult(error instanceof Error ? error.message : "LLM provider connection failed.");
    }
  };

  if (!draft) {
    return <p className="text-sm text-muted-foreground">Loading assistant settings…</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            LLM provider
            <TooltipExplainer 
              term="LLM provider" 
              explanation="Choose which AI language model powers the assistant's explanations and recommendations. OpenAI (GPT) and Google (Gemini) offer different capabilities and costs. Select 'Disabled' to run the system without AI assistance, relying only on algorithmic strategies."
            />
          </CardTitle>
          <CardDescription>Select which model powers explanations. Keep disabled for fully offline mode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.value}
                type="button"
                className={`rounded-md border px-3 py-2 text-sm transition ${
                  draft.provider === provider.value ? "border-primary text-primary" : "border-border text-muted-foreground"
                }`}
                onClick={() => handleFieldChange("provider", provider.value)}
              >
                {provider.label}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="assistant-model">
                Model override
                <TooltipExplainer 
                  term="Model override" 
                  explanation="Optionally specify a particular AI model version to use (e.g., 'gpt-4o-mini' or 'gemini-pro'). Leave blank to use the provider's default recommended model. Different models have different capabilities, speeds, and costs. Smaller models are faster and cheaper, larger models are more capable."
                />
              </Label>
              <Input
                id="assistant-model"
                value={draft.model ?? ""}
                onChange={(event) => handleFieldChange("model", event.target.value)}
                placeholder="gpt-4o-mini"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assistant-redactions">
                Redaction rules (comma separated)
                <TooltipExplainer 
                  term="Redaction rules" 
                  explanation="Sensitive field names to automatically remove from logs and AI prompts for security (e.g., 'api_key', 'wallet_address', 'private_key'). This prevents accidentally exposing secrets in logs or to the AI provider. Enter multiple rules separated by commas."
                />
              </Label>
              <Input
                id="assistant-redactions"
                value={draft.redaction_rules.join(", ")}
                onChange={(event) => handleArrayChange("redaction_rules", event.target.value)}
                placeholder="api_key, wallet_address"
              />
            </div>
          </div>
          <Button type="button" variant="outline" onClick={handleTestConnection}>
            Test connection
          </Button>
          {testResult && (
            <pre className="max-h-40 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              {testResult}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Grounding rules
            <TooltipExplainer 
              term="Grounding rules" 
              explanation="Controls how the AI assistant finds and uses relevant information to answer questions. 'Grounding' means providing the AI with specific facts and data from your system rather than letting it rely solely on general knowledge. This makes responses more accurate and trustworthy."
            />
          </CardTitle>
          <CardDescription>Control how much evidence is retrieved for each query.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="assistant-max-evidence">
              Max evidence items
              <TooltipExplainer 
                term="Max evidence items" 
                explanation="How many pieces of supporting data (trades, reports, performance metrics) to fetch when answering a question. More evidence gives the AI more context for better answers but takes longer to process. For example, 10 means the AI will review up to 10 relevant data points before responding."
              />
            </Label>
            <Input
              id="assistant-max-evidence"
              type="number"
              min={1}
              max={20}
              value={draft.max_evidence}
              onChange={(event) => handleFieldChange("max_evidence", Number(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">Higher values provide more context at the cost of latency.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assistant-lookback">
              Lookback window (days)
              <TooltipExplainer 
                term="Lookback window" 
                explanation="How far back in time to search for relevant data when answering questions. For example, 30 days means the assistant will only consider trades, strategies, and reports from the last month. Shorter windows give more recent data, longer windows provide more historical context."
              />
            </Label>
            <Input
              id="assistant-lookback"
              type="number"
              min={1}
              max={90}
              value={draft.lookback_days}
              onChange={(event) => handleFieldChange("lookback_days", Number(event.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Trade approvals
            <TooltipExplainer 
              term="Trade approvals" 
              explanation="Controls how the system handles trade recommendations from the AI assistant. You can require manual approval for each trade, automatically approve small trades, and add security layers like multi-factor authentication. These settings help balance automation convenience with safety and control."
            />
          </CardTitle>
          <CardDescription>Configure how recommendation approvals behave.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Auto-execute after approval
                <TooltipExplainer 
                  term="Auto-execute after approval" 
                  explanation="When enabled, approved trades are immediately executed without requiring a second confirmation. When disabled, you'll need to confirm again after approving. This is useful for high-trust scenarios where you want quick execution."
                />
              </p>
              <p className="text-xs text-muted-foreground">
                If enabled, approvals trigger immediate execution (Phase 5) without extra confirmation.
              </p>
            </div>
            <Checkbox
              checked={draft.auto_execute}
              onCheckedChange={(value) => handleFieldChange("auto_execute", value === true)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Require MFA / PIN
                <TooltipExplainer 
                  term="Require MFA / PIN" 
                  explanation="Adds an extra security layer by requiring a multi-factor authentication code or PIN before any trade can be approved. This protects against unauthorized access or accidental approvals. Recommended for live trading accounts."
                />
              </p>
              <p className="text-xs text-muted-foreground">Prompts for MFA code before approval is recorded.</p>
            </div>
            <Checkbox
              checked={draft.require_mfa}
              onCheckedChange={(value) => handleFieldChange("require_mfa", value === true)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assistant-threshold">
              Approval threshold (USD)
              <TooltipExplainer 
                term="Approval threshold" 
                explanation="The maximum dollar amount that can be traded with a single approval. Trades larger than this will require additional manual confirmation even if auto-execute is enabled. For example, $1000 means trades over $1000 need extra scrutiny. Set to 0 for no limit."
              />
            </Label>
            <Input
              id="assistant-threshold"
              type="number"
              min={0}
              value={draft.approval_threshold_usd}
              onChange={(event) => handleFieldChange("approval_threshold_usd", Number(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">Approvals above this amount require manual confirmation.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assistant-auto-approve">
              Auto-approve below (USD)
              <TooltipExplainer 
                term="Auto-approve below" 
                explanation="Trades smaller than this amount are automatically approved without your manual confirmation. For example, $50 means any trade under $50 will execute automatically if auto-execute is enabled. This is useful for small test trades or high-frequency strategies. Set to 0 to require approval for all trades."
              />
            </Label>
            <Input
              id="assistant-auto-approve"
              type="number"
              min={0}
              value={draft.auto_approve_below_usd}
              onChange={(event) => handleFieldChange("auto_approve_below_usd", Number(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">Recommendations below this size auto-approve when auto-execute is enabled.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Notifications
            <TooltipExplainer 
              term="Notifications" 
              explanation="Choose how and where you want to receive alerts about trades, approvals, and system events. Multiple channels can be enabled simultaneously to ensure you never miss important notifications. Different channels are useful for different urgency levels (e.g., Slack for urgent alerts, email for daily summaries)."
            />
          </CardTitle>
          <CardDescription>Choose which channels receive assistant alerts and approvals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="assistant-notifications">
              Channels (comma separated)
              <TooltipExplainer 
                term="Notification channels" 
                explanation="Where to send notifications. 'in_app' shows alerts in the dashboard, 'email' sends to your registered email, 'slack' posts to a Slack webhook. Separate multiple channels with commas. Note: External channels like email and Slack require additional webhook or API configuration to work."
              />
            </Label>
            <Textarea
              id="assistant-notifications"
              rows={2}
              value={draft.notification_channels.join(", ")}
              onChange={(event) => handleArrayChange("notification_channels", event.target.value)}
              placeholder="in_app, email, slack"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Supported channels today: `in_app`, `email`, `slack`. External integrations require corresponding webhook configuration.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {draft.updated_at && <span className="text-xs text-muted-foreground">Last updated {new Date(draft.updated_at).toLocaleString()}</span>}
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}


