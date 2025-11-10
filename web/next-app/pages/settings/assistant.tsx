/* eslint-disable */
// @ts-nocheck
import { useEffect, useState } from "react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ToastProvider";
import { fetcher, postJson, putJson } from "@/lib/api";

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

export default function AssistantSettingsPage() {
  const { data, mutate } = useSWR<AssistantSettings>("/api/settings/assistant", fetcher);
  const [draft, setDraft] = useState<AssistantSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const { pushToast } = useToast();

  useEffect(() => {
    if (data) {
      setDraft(data);
    }
  }, [data]);

  const handleFieldChange = (field: keyof AssistantSettings, value: any) => {
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
      pushToast({ title: "Assistant settings saved", variant: "success" });
      await mutate();
    } catch (error) {
      pushToast({
        title: "Failed to save assistant settings",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
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
      pushToast({
        title: "LLM connection succeeded",
        description: `${result.provider ?? ""} (${result.model ?? "n/a"})`,
        variant: "success",
      });
    } catch (error) {
      pushToast({
        title: "LLM connection failed",
        description: error?.message ?? "Unable to reach provider",
        variant: "destructive",
      });
      setTestResult(error?.message ?? "LLM provider connection failed.");
    }
  };

  if (!draft) {
    return <p className="text-sm text-muted-foreground">Loading assistant settings…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Assistant Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure how the conversational assistant connects to LLM providers, grounds responses, and enforces approvals.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>LLM provider</CardTitle>
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
              <Label htmlFor="assistant-model">Model override</Label>
              <Input
                id="assistant-model"
                value={draft.model ?? ""}
                onChange={(event) => handleFieldChange("model", event.target.value)}
                placeholder="gpt-4o-mini"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assistant-redactions">Redaction rules (comma separated)</Label>
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
          <CardTitle>Grounding rules</CardTitle>
          <CardDescription>Control how much evidence is retrieved for each query.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="assistant-max-evidence">Max evidence items</Label>
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
            <Label htmlFor="assistant-lookback">Lookback window (days)</Label>
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
          <CardTitle>Trade approvals</CardTitle>
          <CardDescription>Configure how recommendation approvals behave.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Auto-execute after approval</p>
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
              <p className="text-sm font-medium text-foreground">Require MFA / PIN</p>
              <p className="text-xs text-muted-foreground">Prompts for MFA code before approval is recorded.</p>
            </div>
            <Checkbox
              checked={draft.require_mfa}
              onCheckedChange={(value) => handleFieldChange("require_mfa", value === true)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assistant-threshold">Approval threshold (USD)</Label>
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
            <Label htmlFor="assistant-auto-approve">Auto-approve below (USD)</Label>
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
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Choose which channels receive assistant alerts and approvals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="assistant-notifications">Channels (comma separated)</Label>
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

