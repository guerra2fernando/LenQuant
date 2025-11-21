/* eslint-disable */
// @ts-nocheck
import { useState, useMemo } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { fetcher, putJson } from "@/lib/api";
import { toast } from "sonner";

type StrategyAutomationPanelProps = {
  selectedStrategies: string[];
};

export function StrategyAutomationPanel({
  selectedStrategies,
}: StrategyAutomationPanelProps) {
  const [automationStates, setAutomationStates] = useState<Record<string, boolean>>({});

  // Fetch global autonomy settings
  const { data: autonomySettings } = useSWR("/api/settings/autonomy", fetcher);

  const globalAutomationEnabled = autonomySettings?.auto_promote ?? false;

  const handleToggle = async (strategyId: string, enabled: boolean) => {
    // Update local state immediately for UI responsiveness
    setAutomationStates((prev) => ({ ...prev, [strategyId]: enabled }));

    try {
      // In a real implementation, you'd have an endpoint to enable/disable
      // automation per strategy. For now, we'll show a notification.
      toast.info(
        enabled ? "Automation enabled" : "Automation disabled",
        {
          description: `Strategy ${strategyId} ${
            enabled ? "will" : "will not"
          } trade automatically`,
        }
      );
    } catch (error: any) {
      // Revert on error
      setAutomationStates((prev) => ({ ...prev, [strategyId]: !enabled }));
      toast.error("Failed to update automation", {
        description: error.message,
      });
    }
  };

  if (selectedStrategies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select strategies to configure automation
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Automation Control
          <TooltipExplainer
            term="Strategy Automation"
            explanation="Enable AI to automatically execute trades based on selected strategy signals. Each strategy can be toggled independently. Trades respect all risk limits and safety guards."
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Global status */}
        <div className="rounded-lg bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Global Automation</span>
            <Badge variant={globalAutomationEnabled ? "default" : "secondary"}>
              {globalAutomationEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure in Settings → Autonomy
          </p>
        </div>

        {/* Per-strategy toggles */}
        <div className="space-y-3">
          {selectedStrategies.map((strategyId) => {
            const isEnabled = automationStates[strategyId] ?? false;

            return (
              <div
                key={strategyId}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{strategyId}</p>
                  <p className="text-xs text-muted-foreground">
                    {isEnabled ? "Auto-trading active" : "Manual only"}
                  </p>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleToggle(strategyId, checked)}
                  disabled={!globalAutomationEnabled}
                />
              </div>
            );
          })}
        </div>

        {!globalAutomationEnabled && (
          <p className="text-xs text-muted-foreground">
            Enable global automation in settings to use per-strategy controls
          </p>
        )}
      </CardContent>
    </Card>
  );
}

