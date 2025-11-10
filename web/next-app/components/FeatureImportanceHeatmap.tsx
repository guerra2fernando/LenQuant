/* eslint-disable */
// @ts-nocheck
import { memo } from "react";

type FeatureImportance = {
  feature: string;
  importance: number;
};

type Props = {
  data?: FeatureImportance[];
  isLoading?: boolean;
  caption?: string;
};

function normalize(value: number, max: number) {
  if (!Number.isFinite(value) || max <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, value / max));
}

export const FeatureImportanceHeatmap = memo(function FeatureImportanceHeatmap({
  data,
  isLoading = false,
  caption,
}: Props) {
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading feature importances...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="text-sm text-muted-foreground">No feature importance data available.</div>;
  }

  const sorted = [...data].sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
  const maxValue = sorted[0]?.importance ?? 1;

  return (
    <div className="space-y-4">
      {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
      <ul className="space-y-2">
        {sorted.map((item) => (
          <li key={item.feature} className="rounded-md border border-border/60 bg-muted/40 p-3">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>{item.feature}</span>
              <span className="text-muted-foreground">{item.importance.toFixed(3)}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
                style={{ width: `${normalize(item.importance, maxValue) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
});

