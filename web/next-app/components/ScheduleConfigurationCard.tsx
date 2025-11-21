/* eslint-disable */
// @ts-nocheck
import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar, Clock, PlayCircle, PauseCircle, Save, RefreshCw } from "lucide-react";
import { fetcher, postJson } from "@/lib/api";
import { toast } from "sonner";

type ScheduleConfig = {
  enabled: boolean;
  frequency: "hourly" | "daily" | "weekly";
  time_of_day?: string; // HH:MM format
  day_of_week?: number; // 0-6 for weekly
  last_run?: string;
  next_run?: string;
};

type ScheduleStatus = {
  learning_cycle?: ScheduleConfig;
  evolution?: ScheduleConfig;
  knowledge_generation?: ScheduleConfig;
};

export function ScheduleConfigurationCard() {
  const { data, mutate, isLoading } = useSWR<ScheduleStatus>("/api/schedules/status", fetcher, {
    refreshInterval: 30000,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [learningConfig, setLearningConfig] = useState<Partial<ScheduleConfig>>({});
  const [evolutionConfig, setEvolutionConfig] = useState<Partial<ScheduleConfig>>({});
  const [knowledgeConfig, setKnowledgeConfig] = useState<Partial<ScheduleConfig>>({});

  const handleSave = async (type: "learning_cycle" | "evolution" | "knowledge_generation") => {
    setIsSaving(true);
    try {
      const config =
        type === "learning_cycle"
          ? learningConfig
          : type === "evolution"
            ? evolutionConfig
            : knowledgeConfig;

      await postJson(`/api/schedules/${type}`, config);
      await mutate();
      toast.success(`${type.replace("_", " ")} schedule updated`);
    } catch (error) {
      toast.error("Failed to update schedule");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatNextRun = (nextRun?: string) => {
    if (!nextRun) return "Not scheduled";
    const date = new Date(nextRun);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 0) return "Overdue";
    if (diffMins < 60) return `In ${diffMins} minutes`;
    if (diffMins < 1440) return `In ${Math.round(diffMins / 60)} hours`;
    return `In ${Math.round(diffMins / 1440)} days`;
  };

  const renderScheduleSection = (
    title: string,
    description: string,
    type: "learning_cycle" | "evolution" | "knowledge_generation",
    config?: ScheduleConfig,
    localConfig?: Partial<ScheduleConfig>,
    setLocalConfig?: (config: Partial<ScheduleConfig>) => void,
  ) => {
    const currentConfig = { ...config, ...localConfig };

    return (
      <div className="space-y-4 pb-4 border-b last:border-b-0 last:pb-0">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2">
              {title}
              {config?.enabled && (
                <Badge variant="outline" className="border-green-500 text-green-600">
                  Active
                </Badge>
              )}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <Switch
            checked={currentConfig.enabled || false}
            onCheckedChange={(enabled) => setLocalConfig?.({ ...currentConfig, enabled })}
          />
        </div>

        {currentConfig.enabled && (
          <div className="space-y-3 pl-4 border-l-2">
            <div className="space-y-2">
              <Label className="text-xs">Frequency</Label>
              <Select
                value={currentConfig.frequency || "daily"}
                onValueChange={(frequency: "hourly" | "daily" | "weekly") =>
                  setLocalConfig?.({ ...currentConfig, frequency })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Every Hour</SelectItem>
                  <SelectItem value="daily">Every Day</SelectItem>
                  <SelectItem value="weekly">Every Week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(currentConfig.frequency === "daily" || currentConfig.frequency === "weekly") && (
              <div className="space-y-2">
                <Label className="text-xs">Time of Day</Label>
                <input
                  type="time"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={currentConfig.time_of_day || "02:00"}
                  onChange={(e) =>
                    setLocalConfig?.({ ...currentConfig, time_of_day: e.target.value })
                  }
                />
              </div>
            )}

            {currentConfig.frequency === "weekly" && (
              <div className="space-y-2">
                <Label className="text-xs">Day of Week</Label>
                <Select
                  value={String(currentConfig.day_of_week || 0)}
                  onValueChange={(day) =>
                    setLocalConfig?.({ ...currentConfig, day_of_week: parseInt(day) })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                Last run: {config?.last_run ? new Date(config.last_run).toLocaleString() : "Never"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Next run: {formatNextRun(config?.next_run)}</span>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSave(type)}
              disabled={isSaving}
            >
              <Save className="mr-2 h-3 w-3" />
              Save Schedule
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Automated Schedules
            </CardTitle>
            <CardDescription>Configure automatic learning and evolution cycles</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => mutate()}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderScheduleSection(
          "Learning Cycle",
          "Automatically train models and generate forecasts",
          "learning_cycle",
          data?.learning_cycle,
          learningConfig,
          setLearningConfig,
        )}

        {renderScheduleSection(
          "Evolution",
          "Run strategy evolution experiments on a schedule",
          "evolution",
          data?.evolution,
          evolutionConfig,
          setEvolutionConfig,
        )}

        {renderScheduleSection(
          "Knowledge Generation",
          "Generate insights from trading performance",
          "knowledge_generation",
          data?.knowledge_generation,
          knowledgeConfig,
          setKnowledgeConfig,
        )}

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> Scheduled tasks run in the background using Celery Beat. Make sure
            your Celery workers are running to execute scheduled tasks.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

