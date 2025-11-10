import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ScatterPoint = {
  strategy_id: string;
  roi: number;
  max_drawdown: number;
  sharpe: number;
};

type Props = {
  points?: ScatterPoint[];
};

function normalise(value: number, min: number, max: number) {
  if (max - min === 0) {
    return 0.5;
  }
  return (value - min) / (max - min);
}

export function FitnessScatterChart({ points }: Props) {
  const data = points ?? [];
  const roiValues = data.map((point) => point.roi);
  const ddValues = data.map((point) => point.max_drawdown);
  const minRoi = Math.min(...roiValues, 0);
  const maxRoi = Math.max(...roiValues, 0.01);
  const minDd = Math.min(...ddValues, 0);
  const maxDd = Math.max(...ddValues, 0.2);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">ROI vs Drawdown</CardTitle>
        <CardDescription>Higher-right indicates stronger reward with controlled risk.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No points plotted yet.</p>
        ) : (
          <div className="relative h-64 overflow-hidden rounded-lg border border-border bg-muted/30">
            {data.map((point) => {
              const x = normalise(point.max_drawdown, minDd, maxDd) * 100;
              const y = 100 - normalise(point.roi, minRoi, maxRoi) * 100;
              return (
                <div
                  key={point.strategy_id}
                  className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary bg-primary/20 text-[10px] font-semibold text-primary"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={`${point.strategy_id} • ROI ${(point.roi * 100).toFixed(2)}% • DD ${(point.max_drawdown * 100).toFixed(
                    1,
                  )}%`}
                >
                  {point.strategy_id.slice(-2)}
                </div>
              );
            })}
            <div className="absolute bottom-2 left-2 text-xs text-muted-foreground">Drawdown →</div>
            <div className="absolute right-2 top-2 rotate-90 text-xs text-muted-foreground">ROI ↑</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


