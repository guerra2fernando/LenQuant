import { useMemo, useState } from "react";
import useSWR from "swr";

import { AutonomyAlertDrawer } from "@/components/AutonomyAlertDrawer";
import { AutomationToggle } from "@/components/AutomationToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExperimentDetailPanel } from "@/components/ExperimentDetailPanel";
import { ExperimentKanbanBoard } from "@/components/ExperimentKanbanBoard";
import { RollbackModal } from "@/components/RollbackModal";
import { SchedulerStatusBadge } from "@/components/SchedulerStatusBadge";
import { SafetyGuardSummary } from "@/components/SafetyGuardSummary";
import { fetcher, postJson, putJson } from "@/lib/api";

type EvolutionResponse = {
  experiments: any[];
};

type SchedulerResponse = {
  schedulers: any[];
};

type AutonomySettings = {
  auto_promote: boolean;
  auto_promote_threshold: number;
  safety_limits?: Record<string, number | string>;
  knowledge_retention_weeks?: number;
  llm_provider?: string;
  llm_model?: string;
};

export default function EvolutionAutonomyPage() {
  const { data: experimentsData, mutate: refreshExperiments } = useSWR<EvolutionResponse>(
    "/api/evolution/experiments?limit=60",
    fetcher,
    { refreshInterval: 15000 },
  );
  const { data: schedulerData, mutate: refreshScheduler } = useSWR<SchedulerResponse>("/api/evolution/schedulers", fetcher);
  const { data: autonomyData, mutate: refreshAutonomy } = useSWR<AutonomySettings>("/api/settings/autonomy", fetcher);

  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackStrategyId, setRollbackStrategyId] = useState<string | null>(null);
  const [runningCycle, setRunningCycle] = useState(false);
  const experiments = experimentsData?.experiments ?? [];
  const selectedExperiment = experiments.find((experiment) => experiment.experiment_id === selectedExperimentId) ?? null;
  const schedulerState = schedulerData?.schedulers?.[0];
  const autonomySettings = autonomyData ?? {
    auto_promote: false,
    auto_promote_threshold: 0.05,
    safety_limits: {},
    knowledge_retention_weeks: 12,
    llm_provider: "disabled",
  };

  const alerts = useMemo(() => {
    return experiments
      .filter((experiment) => typeof experiment.metrics?.max_drawdown === "number" && experiment.metrics.max_drawdown > 0.2)
      .slice(0, 3)
      .map((experiment) => ({
        id: experiment.experiment_id,
        title: `High drawdown for ${experiment.experiment_id}`,
        message: `Max drawdown ${(experiment.metrics.max_drawdown * 100).toFixed(1)}% exceeds guardrails.`,
        severity: "warning" as const,
      }));
  }, [experiments]);

  const handleAutomationToggle = async (enabled: boolean) => {
    await putJson("/api/settings/autonomy", {
      ...autonomySettings,
      auto_promote: enabled,
    });
    refreshAutonomy();
  };

  const handleSchedulerToggle = async (enabled: boolean) => {
    await postJson("/api/evolution/schedulers/toggle", { enabled });
    refreshScheduler();
  };

  const handleRunCycle = async () => {
    try {
      setRunningCycle(true);
      await postJson("/api/evolution/run", {});
      await refreshExperiments();
    } finally {
      setRunningCycle(false);
    }
  };

  const handleRollback = (experimentId: string) => {
    setRollbackStrategyId(experimentId);
    setRollbackOpen(true);
  };

  const confirmRollback = async (targetStrategyId: string | null) => {
    if (!rollbackStrategyId) return;
    await postJson("/api/evolution/rollback", {
      strategy_id: rollbackStrategyId,
      target_strategy_id: targetStrategyId,
    });
    setRollbackOpen(false);
    setRollbackStrategyId(null);
    await refreshExperiments();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Autonomous Evolution Lab</CardTitle>
            <p className="text-sm text-muted-foreground">
              Monitor experiment throughput, schedule automation, and promote winning strategies with guardrails.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <SchedulerStatusBadge state={schedulerState} />
              <Button onClick={() => handleSchedulerToggle(!(schedulerState?.enabled ?? false))}>
                {schedulerState?.enabled ? "Pause Scheduler" : "Resume Scheduler"}
              </Button>
              <Button variant="outline" onClick={handleRunCycle} disabled={runningCycle}>
                {runningCycle ? "Running…" : "Run Cycle Now"}
              </Button>
            </div>
            <AutomationToggle enabled={autonomySettings.auto_promote} onChange={handleAutomationToggle} />
            <SafetyGuardSummary safetyLimits={autonomySettings.safety_limits} />
          </CardContent>
        </Card>
        <AutonomyAlertDrawer alerts={alerts} />
      </div>

      <ExperimentKanbanBoard
        experiments={experiments}
        onSelect={(experiment) => setSelectedExperimentId(experiment.experiment_id)}
        selectedId={selectedExperimentId}
      />

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <ExperimentDetailPanel experiment={selectedExperiment} />
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="secondary"
              disabled={!selectedExperiment}
              onClick={() => selectedExperiment && handleRollback(selectedExperiment.candidate?.genome?.strategy_id ?? selectedExperiment.experiment_id)}
            >
              Rollback Selected
            </Button>
          </CardContent>
        </Card>
      </div>

      <RollbackModal
        open={rollbackOpen}
        onOpenChange={setRollbackOpen}
        strategyId={rollbackStrategyId}
        onConfirm={confirmRollback}
      />
    </div>
  );
}

