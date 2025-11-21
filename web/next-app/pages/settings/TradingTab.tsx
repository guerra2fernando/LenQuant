/* eslint-disable */
// @ts-nocheck
import useSWR from "swr";

import { TooltipExplainer } from "@/components/TooltipExplainer";
import { AccountSelector } from "@/components/AccountSelector";
import { SettingsTradingForm } from "@/components/SettingsTradingForm";
import { ExchangeConnectionCard } from "@/components/ExchangeConnectionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetcher, postJson, putJson } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";

export default function TradingTab(): JSX.Element {
  const { data, mutate } = useSWR("/api/settings/trading", fetcher);
  const [isTestingAlert, setIsTestingAlert] = useState(false);

  const settings = data ?? {
    modes: {},
    risk: { max_trade_usd: 0, max_daily_loss_usd: 0, max_open_exposure_usd: 0 },
    auto_mode: { enabled: false, confidence_threshold: 0.65, max_trade_usd: 0, default_mode: "paper" },
    alerts: { channels: [] },
  };

  const handleSave = async (payload: unknown) => {
    await putJson("/api/settings/trading", payload);
    toast.success("Settings saved");
    await mutate();
  };

  const handleTestAlert = async () => {
    setIsTestingAlert(true);
    try {
      await postJson("/api/settings/trading/test-alert", {});
      toast.success("Test alert sent");
    } finally {
      setIsTestingAlert(false);
    }
  };

  const accounts = Object.entries(settings.modes ?? {}).map(([key, config]: [string, any]) => ({
    key,
    label: `${key.toUpperCase()} ${config.enabled ? "" : "(disabled)"}`,
    description: `Max notional $${config.max_notional_usd ?? 0}`,
  }));

  return (
    <div className="space-y-6">
      <ExchangeConnectionCard />
      
      <Card>
        <CardHeader>
          <CardTitle>
            Account Modes
            <TooltipExplainer 
              term="Account Modes" 
              explanation="Choose which trading environment to use. 'Paper' mode simulates trades with fake money for testing strategies safely. 'Live' mode executes real trades with real money. Always test strategies in paper mode before going live. The default mode is used when the system makes autonomous trading decisions."
            />
          </CardTitle>
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

    </div>
  );
}

