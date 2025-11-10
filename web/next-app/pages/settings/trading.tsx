/* eslint-disable */
// @ts-nocheck
import useSWR from "swr";

import { AccountSelector } from "@/components/AccountSelector";
import { SettingsTradingForm } from "@/components/SettingsTradingForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetcher, postJson, putJson } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { useState } from "react";

export default function TradingSettingsPage() {
  const { data, mutate } = useSWR("/api/settings/trading", fetcher);
  const { pushToast } = useToast();
  const [isTestingAlert, setIsTestingAlert] = useState(false);

  const settings = data ?? {
    modes: {},
    risk: { max_trade_usd: 0, max_daily_loss_usd: 0, max_open_exposure_usd: 0 },
    auto_mode: { enabled: false, confidence_threshold: 0.65, max_trade_usd: 0, default_mode: "paper" },
    alerts: { channels: [] },
  };

  const handleSave = async (payload) => {
    await putJson("/api/settings/trading", payload);
    pushToast({ title: "Settings saved", variant: "success" });
    await mutate();
  };

  const handleTestAlert = async () => {
    setIsTestingAlert(true);
    try {
      await postJson("/api/settings/trading/test-alert", {});
      pushToast({ title: "Test alert sent", variant: "success" });
    } finally {
      setIsTestingAlert(false);
    }
  };

  const accounts = Object.entries(settings.modes ?? {}).map(([key, config]) => ({
    key,
    label: `${key.toUpperCase()} ${config.enabled ? "" : "(disabled)"}`,
    description: `Max notional $${config.max_notional_usd ?? 0}`,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account Modes</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountSelector
            value={settings.auto_mode?.default_mode ?? "paper"}
            onChange={async (value) => {
              await handleSave({ auto_mode: { ...settings.auto_mode, default_mode: value } });
            }}
            accounts={accounts}
          />
        </CardContent>
      </Card>

      <SettingsTradingForm settings={settings} onSubmit={handleSave} />

      <Card>
        <CardHeader>
          <CardTitle>Alert Test</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Send a test alert to the configured channels to verify connectivity.
          </p>
          <Button onClick={handleTestAlert} disabled={isTestingAlert}>
            {isTestingAlert ? "Sending..." : "Send Test Alert"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

