/* eslint-disable */
// @ts-nocheck
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AssistantToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  symbol: string;
  onSymbolChange: (value: string) => void;
  strategyId: string;
  onStrategyIdChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  horizon: string;
  onHorizonChange: (value: string) => void;
  isLoading: boolean;
  onSubmit: () => void;
  disableSubmit?: boolean;
  actionsSlot?: React.ReactNode;
};

export function AssistantToolbar({
  query,
  onQueryChange,
  symbol,
  onSymbolChange,
  strategyId,
  onStrategyIdChange,
  date,
  onDateChange,
  horizon,
  onHorizonChange,
  isLoading,
  onSubmit,
  disableSubmit,
  actionsSlot,
}: AssistantToolbarProps) {
  const disabled = disableSubmit || !query?.trim() || isLoading;
  const summary = useMemo(() => {
    const fields = [
      symbol && `Symbol ${symbol}`,
      horizon && `Horizon ${horizon}`,
      date && `Date ${date}`,
      strategyId && `Strategy ${strategyId}`,
    ].filter(Boolean);
    return fields.length ? fields.join(" • ") : "No context selected";
  }, [symbol, horizon, date, strategyId]);

  return (
    <div className="rounded-lg border border-border bg-card/80 p-4 shadow-sm backdrop-blur">
      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <div className="space-y-2">
          <Label htmlFor="assistant-query" className="text-xs uppercase text-muted-foreground">
            Ask the assistant
          </Label>
          <Textarea
            id="assistant-query"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            rows={4}
            placeholder="Why did the ETH scalper underperform yesterday?"
            className="resize-none bg-background text-sm"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="assistant-symbol" className="text-xs uppercase text-muted-foreground">
              Symbol
            </Label>
            <Input
              id="assistant-symbol"
              value={symbol}
              onChange={(event) => onSymbolChange(event.target.value)}
              placeholder="BTC/USDT"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assistant-horizon" className="text-xs uppercase text-muted-foreground">
              Horizon
            </Label>
            <Input
              id="assistant-horizon"
              value={horizon}
              onChange={(event) => onHorizonChange(event.target.value)}
              placeholder="1h"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assistant-date" className="text-xs uppercase text-muted-foreground">
              Date
            </Label>
            <Input
              id="assistant-date"
              type="date"
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assistant-strategy" className="text-xs uppercase text-muted-foreground">
              Strategy ID
            </Label>
            <Input
              id="assistant-strategy"
              value={strategyId}
              onChange={(event) => onStrategyIdChange(event.target.value)}
              placeholder="ema-cross-gen1"
              className="text-sm"
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-xs text-muted-foreground">{summary}</div>
        <div className="flex items-center gap-2">
          {actionsSlot}
          <Button onClick={onSubmit} disabled={disabled}>
            {isLoading ? "Thinking…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

