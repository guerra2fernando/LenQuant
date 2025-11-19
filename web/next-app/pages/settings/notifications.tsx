/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from "react";
import { Bell, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetcher, postJson } from "@/lib/api";
import { useSession } from "next-auth/react";

const NOTIFICATION_TYPES = [
  {
    id: "trade_execution",
    label: "Trade Executions",
    description: "Order fills, rejections, and execution updates",
  },
  {
    id: "risk_alert",
    label: "Risk Alerts",
    description: "Position limits, drawdowns, and risk breaches",
  },
  {
    id: "strategy_performance",
    label: "Strategy Performance",
    description: "Strategy promotions and performance milestones",
  },
  {
    id: "system_event",
    label: "System Events",
    description: "System status, maintenance, and updates",
  },
  {
    id: "insight",
    label: "AI Insights",
    description: "Automated insights and recommendations",
  },
  {
    id: "experiment_completion",
    label: "Experiment Completion",
    description: "Evolution and learning cycle completions",
  },
];

const SEVERITY_LEVELS = [
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "critical", label: "Critical" },
];

const FREQUENCY_OPTIONS = [
  { value: "immediate", label: "Immediate" },
  { value: "hourly_digest", label: "Hourly Digest" },
  { value: "daily_digest", label: "Daily Digest" },
];

export default function NotificationSettingsPage() {
  const { data: session } = useSession();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session) {
      loadPreferences();
    }
  }, [session]);

  const loadPreferences = async () => {
    try {
      const data = await fetcher("/api/notifications/preferences");
      setPreferences(data);
    } catch (error) {
      console.error("Failed to load preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = (type: string, field: string, value: any) => {
    setPreferences((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [type]: {
          ...prev.preferences[type],
          [field]: value,
        },
      },
    }));
  };

  const updateQuietHours = (field: string, value: any) => {
    setPreferences((prev) => ({
      ...prev,
      quiet_hours: {
        ...prev.quiet_hours,
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await postJson("/api/notifications/preferences", preferences);
      alert("Preferences saved successfully!");
    } catch (error) {
      console.error("Failed to save preferences:", error);
      alert("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !preferences) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" />
          Notification Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure how and when you receive notifications
        </p>
      </div>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {NOTIFICATION_TYPES.map((type) => {
            const typePrefs = preferences.preferences[type.id] || {};
            return (
              <div key={type.id} className="space-y-4 border-b pb-4 last:border-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Label className="text-base font-semibold">{type.label}</Label>
                    <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                  </div>
                  <Switch
                    checked={typePrefs.enabled !== false}
                    onCheckedChange={(checked) => updatePreference(type.id, "enabled", checked)}
                  />
                </div>

                {typePrefs.enabled !== false && (
                  <div className="ml-6 space-y-3">
                    <div>
                      <Label className="text-sm">Minimum Severity</Label>
                      <Select
                        value={typePrefs.min_severity || "info"}
                        onValueChange={(value) => updatePreference(type.id, "min_severity", value)}
                      >
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SEVERITY_LEVELS.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {type.id === "insight" && (
                      <div>
                        <Label className="text-sm">Frequency</Label>
                        <Select
                          value={typePrefs.frequency || "immediate"}
                          onValueChange={(value) => updatePreference(type.id, "frequency", value)}
                        >
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FREQUENCY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Quiet Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Quiet Hours</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Suppress non-critical notifications during specified hours
              </p>
            </div>
            <Switch
              checked={preferences.quiet_hours?.enabled || false}
              onCheckedChange={(checked) => updateQuietHours("enabled", checked)}
            />
          </div>

          {preferences.quiet_hours?.enabled && (
            <div className="grid grid-cols-2 gap-4 ml-6">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={preferences.quiet_hours?.start || "22:00"}
                  onChange={(e) => updateQuietHours("start", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={preferences.quiet_hours?.end || "08:00"}
                  onChange={(e) => updateQuietHours("end", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}

