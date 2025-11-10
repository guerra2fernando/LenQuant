import { useEffect, useState } from "react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetcher, putJson } from "@/lib/api";

type LearningSettings = {
  meta_model: {
    n_estimators: number;
    min_samples: number;
    train_window_runs: number;
    max_depth: number | null;
    min_samples_leaf: number;
  };
  optimizer: {
    trials: number;
    top_k: number;
    exploration_weight: number;
  };
  allocator: {
    risk_penalty: number;
    max_risk: number;
    min_weight: number;
    diversification_floor?: number;
  };
  overfit: {
    window: number;
    decay_threshold: number;
    min_runs: number;
  };
  knowledge?: {
    summary_horizon_days?: number;
  };
  updated_at?: string | null;
};

type LearningSettingsResponse = LearningSettings & {
  updated_at?: string | null;
};

const numberFromEvent = (value: string, fallback: number, min?: number, max?: number) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  let result = parsed;
  if (typeof min === "number") {
    result = Math.max(min, result);
  }
  if (typeof max === "number") {
    result = Math.min(max, result);
  }
  return result;
};

export default function LearningSettingsPage() {
  const { data, isLoading, error, mutate } = useSWR<LearningSettingsResponse>("/api/settings/learning", fetcher);
  const [draft, setDraft] = useState<LearningSettings | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setDraft({
        meta_model: { ...data.meta_model },
        optimizer: { ...data.optimizer },
        allocator: { ...data.allocator },
        overfit: { ...data.overfit },
        knowledge: { ...data.knowledge },
        updated_at: data.updated_at,
      });
    }
  }, [data]);

  const updateField = <Section extends keyof LearningSettings, Key extends keyof LearningSettings[Section]>(
    section: Section,
    key: Key,
    value: LearningSettings[Section][Key],
  ) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [key]: value,
        },
      };
    });
  };

  const handleSave = async () => {
    if (!draft) {
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      await putJson("/api/settings/learning", draft);
      setMessage("Learning settings saved.");
      await mutate();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save learning settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Learning Engine Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure Phase 3 parameters governing the meta-model, Bayesian optimiser, allocator, and overfitting monitor.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading learning settings…</p>}
      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load settings</CardTitle>
            <CardDescription className="text-destructive/80">
              {error instanceof Error ? error.message : "Unknown error"}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {message && (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="py-3 text-sm text-emerald-900 dark:text-emerald-100">{message}</CardContent>
        </Card>
      )}

      {draft && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Meta-model</CardTitle>
              <CardDescription>Controls how the learning engine fits strategy fitness predictors.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Estimators"
                value={draft.meta_model.n_estimators}
                onChange={(value) => updateField("meta_model", "n_estimators", numberFromEvent(value, 200, 50, 1000))}
              />
              <Field
                label="Train window (runs)"
                value={draft.meta_model.train_window_runs}
                onChange={(value) => updateField("meta_model", "train_window_runs", numberFromEvent(value, 400, 100, 2000))}
              />
              <Field
                label="Min samples"
                value={draft.meta_model.min_samples}
                onChange={(value) => updateField("meta_model", "min_samples", numberFromEvent(value, 60, 10, 500))}
              />
              <Field
                label="Min samples per leaf"
                value={draft.meta_model.min_samples_leaf}
                onChange={(value) => updateField("meta_model", "min_samples_leaf", numberFromEvent(value, 2, 1, 50))}
              />
              <Field
                label="Max depth (0 = auto)"
                value={draft.meta_model.max_depth ?? 0}
                onChange={(value) => {
                  const parsed = numberFromEvent(value, 0, 0, 200);
                  updateField("meta_model", "max_depth", parsed === 0 ? null : parsed);
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bayesian optimiser</CardTitle>
              <CardDescription>Search controls for generating new genomes.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Field
                label="Trials per cycle"
                value={draft.optimizer.trials}
                onChange={(value) => updateField("optimizer", "trials", numberFromEvent(value, 40, 10, 200))}
              />
              <Field
                label="Top candidates"
                value={draft.optimizer.top_k}
                onChange={(value) => updateField("optimizer", "top_k", numberFromEvent(value, 5, 1, 20))}
              />
              <Field
                label="Exploration weight"
                value={draft.optimizer.exploration_weight}
                step="0.05"
                onChange={(value) => updateField("optimizer", "exploration_weight", numberFromEvent(value, 0.3, 0.05, 1))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Allocator</CardTitle>
              <CardDescription>Risk/return preferences for capital deployment.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <Field
                label="Risk penalty"
                value={draft.allocator.risk_penalty}
                step="0.05"
                onChange={(value) => updateField("allocator", "risk_penalty", numberFromEvent(value, 0.45, 0.1, 2))}
              />
              <Field
                label="Max risk"
                value={draft.allocator.max_risk}
                step="0.05"
                onChange={(value) => updateField("allocator", "max_risk", numberFromEvent(value, 0.25, 0.05, 1))}
              />
              <Field
                label="Min weight"
                value={draft.allocator.min_weight}
                step="0.01"
                onChange={(value) => updateField("allocator", "min_weight", numberFromEvent(value, 0, 0, 0.5))}
              />
              <Field
                label="Diversification floor"
                value={draft.allocator.diversification_floor ?? 0}
                step="0.05"
                onChange={(value) =>
                  updateField("allocator", "diversification_floor", numberFromEvent(value, 0, 0, 0.9))
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overfitting monitor</CardTitle>
              <CardDescription>Flags strategies whose post-promotion ROI tails off.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Field
                label="Window (runs)"
                value={draft.overfit.window}
                onChange={(value) => updateField("overfit", "window", numberFromEvent(value, 6, 3, 20))}
              />
              <Field
                label="Decay threshold (%)"
                value={draft.overfit.decay_threshold * 100}
                step="0.1"
                onChange={(value) =>
                  updateField("overfit", "decay_threshold", numberFromEvent(value, 35, 5, 90) / 100)
                }
              />
              <Field
                label="Minimum runs"
                value={draft.overfit.min_runs}
                onChange={(value) => updateField("overfit", "min_runs", numberFromEvent(value, 6, 3, 20))}
              />
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {draft?.updated_at ? `Last updated ${new Date(draft.updated_at).toLocaleString()}` : "No saved settings yet."}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => mutate()} disabled={isSaving}>
            Reset
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !draft}>
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: number;
  onChange: (value: string) => void;
  step?: string;
};

function Field({ label, value, onChange, step }: FieldProps) {
  const displayValue = Number.isFinite(value) ? value : 0;
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Input type="number" value={displayValue} step={step} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

