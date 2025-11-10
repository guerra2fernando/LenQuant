import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Experiment = {
  experiment_id: string;
  status: string;
  score?: number;
  metrics?: Record<string, number>;
  candidate?: {
    genome?: {
      family?: string;
      strategy_id?: string;
    };
    metadata?: {
      horizon?: string;
      model_type?: string;
      features?: string[];
    };
    operations?: string[];
  };
};

type ExperimentCardProps = {
  experiment: Experiment;
  onSelect?: (experiment: Experiment) => void;
  active?: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "outline",
  running: "default",
  completed: "secondary",
  promoted: "default",
  rejected: "destructive",
  failed: "destructive",
};

export function ExperimentCard({ experiment, onSelect, active }: ExperimentCardProps) {
  const metadata = experiment.candidate?.metadata ?? {};
  const statusVariant = STATUS_COLORS[experiment.status] ?? "secondary";
  const handleClick = () => {
    onSelect?.(experiment);
  };
  return (
    <Card
      onClick={handleClick}
      className={`cursor-pointer transition hover:border-primary ${active ? "border-primary shadow-lg" : ""}`}
    >
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">
            {experiment.candidate?.genome?.strategy_id ?? experiment.experiment_id}
          </CardTitle>
          <Badge variant={statusVariant}>{experiment.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {metadata.model_type ?? "Unknown model"} · {metadata.horizon ?? "—"} horizon
        </p>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-2">
          {(metadata.features ?? []).slice(0, 4).map((feature) => (
            <Badge key={feature} variant="outline">
              {feature}
            </Badge>
          ))}
          {(metadata.features?.length ?? 0) > 4 ? <Badge variant="outline">+{metadata.features!.length - 4}</Badge> : null}
        </div>
        <p>Score: {typeof experiment.score === "number" ? experiment.score.toFixed(3) : "—"}</p>
        <p>
          ROI:{" "}
          {typeof experiment.metrics?.roi === "number" ? `${(experiment.metrics.roi * 100).toFixed(2)}%` : "—"} · Sharpe:{" "}
          {typeof experiment.metrics?.sharpe === "number" ? experiment.metrics.sharpe.toFixed(2) : "—"}
        </p>
        {Array.isArray(experiment.candidate?.operations) && experiment.candidate?.operations?.length ? (
          <p>Ops: {experiment.candidate?.operations?.join(", ")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

