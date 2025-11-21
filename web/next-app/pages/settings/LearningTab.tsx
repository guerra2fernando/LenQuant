import { useEffect, useState } from "react";
import useSWR from "swr";

import { TooltipExplainer } from "@/components/TooltipExplainer";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScheduleConfigurationCard } from "@/components/ScheduleConfigurationCard";
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

export default function LearningTab(): JSX.Element {
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
      const sectionValue = prev[section];
      if (typeof sectionValue !== "object" || sectionValue === null) {
        return prev;
      }
      return {
        ...prev,
        [section]: {
          ...(sectionValue as Record<string, unknown>),
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
      {isLoading && <ProgressIndicator message="Loading learning settings..." variant="spinner" />}
      {error && (
        <ErrorMessage
          title="Unable to load settings"
          message={error instanceof Error ? error.message : "Unknown error"}
          error={error}
          onRetry={() => mutate()}
        />
      )}

      {message && (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="py-3 text-sm text-emerald-900 dark:text-emerald-100">{message}</CardContent>
        </Card>
      )}

      {/* Phase 6: Schedule Configuration */}
      <ScheduleConfigurationCard />

      {draft && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                Meta-model
                <TooltipExplainer 
                  term="Meta-model" 
                  explanation="A machine learning model that learns which strategy characteristics lead to good performance. It predicts how well a strategy will perform before actually testing it, helping focus resources on the most promising candidates. This is like having an AI coach that can spot winning strategies based on past winners."
                />
              </CardTitle>
              <CardDescription>Controls how the learning engine fits strategy fitness predictors.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Estimators"
                value={draft.meta_model.n_estimators}
                onChange={(value) => updateField("meta_model", "n_estimators", numberFromEvent(value, 200, 50, 1000))}
                explanation="The number of decision trees in the random forest model. More estimators make predictions more stable and accurate but take longer to train. Think of it like consulting more experts - 200 experts (trees) will generally give better advice than 50, but take longer to gather opinions."
              />
              <Field
                label="Train window (runs)"
                value={draft.meta_model.train_window_runs}
                onChange={(value) => updateField("meta_model", "train_window_runs", numberFromEvent(value, 400, 100, 2000))}
                explanation="How many past strategy test runs to use for training the meta-model. More runs provide more data for learning but older runs may be less relevant. For example, 400 means the model learns from the last 400 strategy evaluations to predict future performance."
              />
              <Field
                label="Min samples"
                value={draft.meta_model.min_samples}
                onChange={(value) => updateField("meta_model", "min_samples", numberFromEvent(value, 60, 10, 500))}
                explanation="The minimum number of strategy samples needed before the meta-model can make predictions. Higher values ensure the model has enough data to learn meaningful patterns but delay when predictions become available. 60 means at least 60 strategies must be evaluated first."
              />
              <Field
                label="Min samples per leaf"
                value={draft.meta_model.min_samples_leaf}
                onChange={(value) => updateField("meta_model", "min_samples_leaf", numberFromEvent(value, 2, 1, 50))}
                explanation="The minimum number of samples required in each leaf node of the decision trees. Higher values prevent overfitting by forcing broader generalizations but may miss subtle patterns. Lower values (2-5) allow the model to learn detailed patterns but risk memorizing noise."
              />
              <Field
                label="Max depth (0 = auto)"
                value={draft.meta_model.max_depth ?? 0}
                onChange={(value) => {
                  const parsed = numberFromEvent(value, 0, 0, 200);
                  updateField("meta_model", "max_depth", parsed === 0 ? null : parsed);
                }}
                explanation="How many levels deep each decision tree can grow. Deeper trees can capture complex patterns but risk overfitting. 0 (auto) lets the algorithm decide based on the data. Typical values are 10-30. Deeper trees (50+) are for very complex relationships but slow to train."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Bayesian optimiser
                <TooltipExplainer 
                  term="Bayesian optimiser" 
                  explanation="A smart search algorithm that efficiently finds the best strategy parameters. Unlike random search, it learns from each test to focus on promising areas of the search space. It's like having an intelligent assistant that remembers what worked before and makes educated guesses about where to look next."
                />
              </CardTitle>
              <CardDescription>Search controls for generating new genomes.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Field
                label="Trials per cycle"
                value={draft.optimizer.trials}
                onChange={(value) => updateField("optimizer", "trials", numberFromEvent(value, 40, 10, 200))}
                explanation="How many different strategy parameter combinations to try in each optimization cycle. More trials explore the solution space more thoroughly but take longer. 40 trials means testing 40 different parameter sets to find the best combination."
              />
              <Field
                label="Top candidates"
                value={draft.optimizer.top_k}
                onChange={(value) => updateField("optimizer", "top_k", numberFromEvent(value, 5, 1, 20))}
                explanation="How many of the best-performing strategies from trials to keep for the next generation. More candidates preserve diversity but dilute focus on the very best. For example, keeping the top 5 means only the 5 highest-performing strategies will be used to create new variations."
              />
              <Field
                label="Exploration weight"
                value={draft.optimizer.exploration_weight}
                step="0.05"
                onChange={(value) => updateField("optimizer", "exploration_weight", numberFromEvent(value, 0.3, 0.05, 1))}
                explanation="Balance between trying new areas (exploration) vs improving known good areas (exploitation). Higher values (0.5-1.0) encourage trying novel parameter combinations. Lower values (0.1-0.3) focus on refining already-good strategies. 0.3 is balanced - 30% exploring new possibilities, 70% exploiting known winners."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Allocator
                <TooltipExplainer 
                  term="Allocator" 
                  explanation="Controls how capital is distributed across different trading strategies. This balances maximizing returns with managing risk and maintaining diversification. Think of it as your portfolio manager deciding how much money to give each strategy based on their performance, risk, and correlation."
                />
              </CardTitle>
              <CardDescription>Risk/return preferences for capital deployment.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <Field
                label="Risk penalty"
                value={draft.allocator.risk_penalty}
                step="0.05"
                onChange={(value) => updateField("allocator", "risk_penalty", numberFromEvent(value, 0.45, 0.1, 2))}
                explanation="How much to penalize strategies with higher volatility when allocating capital. Higher values (0.5-2.0) strongly favor stable strategies, lower values (0.1-0.3) allow more capital to riskier but potentially higher-returning strategies. 0.45 means volatility is moderately important in allocation decisions."
              />
              <Field
                label="Max risk"
                value={draft.allocator.max_risk}
                step="0.05"
                onChange={(value) => updateField("allocator", "max_risk", numberFromEvent(value, 0.25, 0.05, 1))}
                explanation="The maximum portfolio volatility (standard deviation of returns) to target. 0.25 means aiming for at most 25% annualized volatility. Lower values (0.1-0.2) prioritize capital preservation, higher values (0.3-0.5) accept more risk for potentially higher returns. This acts as a hard cap on total portfolio risk."
              />
              <Field
                label="Min weight"
                value={draft.allocator.min_weight}
                step="0.01"
                onChange={(value) => updateField("allocator", "min_weight", numberFromEvent(value, 0, 0, 0.5))}
                explanation="The minimum percentage of capital to allocate to any strategy that's included in the portfolio. 0 allows strategies to have very small allocations. 0.05 means each active strategy gets at least 5% of capital, which prevents over-concentration but may force using weaker strategies. Useful for maintaining diversity."
              />
              <Field
                label="Diversification floor"
                value={draft.allocator.diversification_floor ?? 0}
                step="0.05"
                onChange={(value) =>
                  updateField("allocator", "diversification_floor", numberFromEvent(value, 0, 0, 0.9))
                }
                explanation="Ensures capital is spread across strategies rather than concentrated in one. 0 allows all capital to go to the best strategy. 0.3 means the top strategy can get at most 70% of capital (1 - 0.3), forcing at least 30% into other strategies. Higher values (0.5-0.7) ensure strong diversification but may dilute returns from the best strategy."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Overfitting monitor
                <TooltipExplainer 
                  term="Overfitting monitor" 
                  explanation="Detects when strategies that performed well in testing start failing in live trading. This happens when a strategy memorized patterns in historical data rather than learning general principles. Like a student who memorizes test answers but can't apply the concepts - they ace practice tests but fail the real exam."
                />
              </CardTitle>
              <CardDescription>Flags strategies whose post-promotion ROI tails off.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Field
                label="Window (runs)"
                value={draft.overfit.window}
                onChange={(value) => updateField("overfit", "window", numberFromEvent(value, 6, 3, 20))}
                explanation="How many recent trading runs to analyze when checking for performance decay. A window of 6 means comparing the last 6 runs to earlier performance. Smaller windows (3-5) detect problems faster but may trigger false alarms from normal variance. Larger windows (10-15) are more patient but slow to catch real issues."
              />
              <Field
                label="Decay threshold (%)"
                value={draft.overfit.decay_threshold * 100}
                step="0.1"
                onChange={(value) =>
                  updateField("overfit", "decay_threshold", numberFromEvent(value, 35, 5, 90) / 100)
                }
                explanation="How much worse (as a percentage) recent performance must be compared to testing results before flagging overfitting. 35% means if a strategy that returned 10% in testing now only returns 6.5% (35% worse), it gets flagged. Lower values (10-20%) are strict and catch problems early but may have false positives. Higher values (50-70%) are lenient and tolerate more variance."
              />
              <Field
                label="Minimum runs"
                value={draft.overfit.min_runs}
                onChange={(value) => updateField("overfit", "min_runs", numberFromEvent(value, 6, 3, 20))}
                explanation="How many runs a strategy must complete before checking for overfitting. This waiting period lets strategies prove themselves and filters out early noise. 6 runs means giving the strategy at least 6 trading cycles to stabilize before scrutinizing performance decay. Too low (2-3) leads to premature judgments, too high (15+) delays catching bad strategies."
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
  explanation?: string;
};

function Field({ label, value, onChange, step, explanation }: FieldProps) {
  const displayValue = Number.isFinite(value) ? value : 0;
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">
        {label}
        {explanation && <TooltipExplainer term={label} explanation={explanation} />}
      </Label>
      <Input
        type="number"
        value={displayValue}
        step={step}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    </div>
  );
}

