import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetcher, postJson } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/utils";
import type {
  IntradayCohortDetail,
  PromotionGuardRailCheck,
} from "@/types/cohorts";
import { useToast } from "./ToastProvider";

type DayThreePromotionModalProps = {
  open: boolean;
  cohortId: string | null;
  onClose: () => void;
  onPromoted?: () => void;
};

function formatCurrency(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "$0.00";
  }
  return `$${formatNumber(value, digits)}`;
}

function describeGuardRail(check: PromotionGuardRailCheck): { current: string; threshold: string } {
  const { value, threshold } = check;
  if (threshold === undefined || threshold === null) {
    return {
      current: value === undefined || value === null ? "—" : formatNumber(value, 2),
      threshold: "—",
    };
  }
  if (threshold <= 1.5) {
    return {
      current: value === undefined || value === null ? "—" : formatPercent(value, 2),
      threshold: formatPercent(threshold, 2),
    };
  }
  const digits = Number.isInteger(threshold) ? 0 : 2;
  return {
    current: value === undefined || value === null ? "—" : formatNumber(value, digits),
    threshold: formatNumber(threshold, digits),
  };
}

export function DayThreePromotionModal({
  open,
  cohortId,
  onClose,
  onPromoted,
}: DayThreePromotionModalProps) {
  const { pushToast } = useToast();
  const { data, error, isValidating, mutate } = useSWR<IntradayCohortDetail>(
    open && cohortId ? `/api/experiments/cohorts/${cohortId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const promotion = data?.promotion ?? null;
  const summary = data?.summary ?? null;
  const parent = data?.parent ?? null;
  const bestCandidate = promotion?.best_candidate ?? null;

  const [slicePct, setSlicePct] = useState<string>("5");
  const [minAllocationUsd, setMinAllocationUsd] = useState<string>("50");
  const [minTradeCount, setMinTradeCount] = useState<string>("6");
  const [maxSlippagePct, setMaxSlippagePct] = useState<string>("1");
  const [maxParentDrawdownPct, setMaxParentDrawdownPct] = useState<string>("12");
  const [approvalNotes, setApprovalNotes] = useState<string>("");
  const [acknowledge, setAcknowledge] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!open || !promotion) {
      return;
    }
    setSlicePct(String(Math.round((promotion.recommended_bankroll_slice_pct ?? 0.05) * 100)));
    setMinAllocationUsd(String(Math.round(promotion.recommended_allocation ?? 50)));
    const minTradesThreshold = promotion.checks.find((check) => check.id === "min_trade_count")?.threshold ?? 6;
    setMinTradeCount(String(Math.round(minTradesThreshold)));
    const slippageThreshold = promotion.checks.find((check) => check.id === "max_slippage_pct")?.threshold ?? 0.01;
    setMaxSlippagePct(String(Math.round((slippageThreshold ?? 0.01) * 1000) / 10));
    const drawdownThreshold =
      promotion.checks.find((check) => check.id === "parent_drawdown")?.threshold ??
      promotion.checks.find((check) => check.id === "candidate_parent_drawdown")?.threshold ??
      0.12;
    setMaxParentDrawdownPct(String(Math.round((drawdownThreshold ?? 0.12) * 100)));
    setApprovalNotes("");
    setAcknowledge(false);
  }, [open, promotion]);

  const guardRails = promotion?.checks ?? [];
  const canPromote = acknowledge && (promotion?.ready ?? false) && !submitting;

  const guardRailSummary = useMemo(() => {
    if (!guardRails.length) {
      return "Guard rail readiness pending.";
    }
    const passed = guardRails.filter((check) => check.status).length;
    return `${passed}/${guardRails.length} guard rails passing`;
  }, [guardRails]);

  const handlePromote = async () => {
    if (!cohortId) {
      return;
    }
    const sliceValue = Number(slicePct) / 100;
    const minAllocValue = Number(minAllocationUsd);
    const minTradesValue = Number(minTradeCount);
    const maxSlipValue = Number(maxSlippagePct) / 100;
    const maxDrawdownValue = Number(maxParentDrawdownPct) / 100;

    setSubmitting(true);
    try {
      await postJson(`/api/experiments/cohorts/${cohortId}/promote`, {
        bankroll_slice_pct: Number.isFinite(sliceValue) && sliceValue > 0 ? sliceValue : 0.05,
        min_allocation_usd: Number.isFinite(minAllocValue) && minAllocValue > 0 ? minAllocValue : 50,
        min_trade_count: Number.isFinite(minTradesValue) && minTradesValue > 0 ? Math.round(minTradesValue) : 6,
        max_slippage_pct: Number.isFinite(maxSlipValue) && maxSlipValue > 0 ? maxSlipValue : 0.01,
        max_parent_drawdown: Number.isFinite(maxDrawdownValue) && maxDrawdownValue > 0 ? maxDrawdownValue : 0.12,
        approval_notes: approvalNotes?.trim() || undefined,
        acknowledge_risks: true,
      });
      pushToast({
        title: "Promotion request recorded",
        description: `Day-3 promotion queued for cohort ${cohortId}.`,
        variant: "success",
      });
      await mutate();
      onPromoted?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to promote candidate.";
      pushToast({
        title: "Promotion failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-3xl space-y-6">
        <DialogHeader>
          <DialogTitle>Day-3 Promotion Review</DialogTitle>
          <DialogDescription>
            Review guard rails, cohort performance, and risk controls before enabling live capital promotion.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load cohort detail: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        ) : null}

        {isValidating && !data ? (
          <div className="rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Loading cohort detail…
          </div>
        ) : null}

        {promotion ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-border/60 bg-muted/20 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase text-muted-foreground">Guard Rails</span>
                  <Badge variant={promotion.ready ? "success" : "warning"}>
                    {promotion.ready ? "Ready" : "Manual Review"}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-foreground">{guardRailSummary}</div>
                <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                  {guardRails.map((check) => {
                    const { current, threshold } = describeGuardRail(check);
                    return (
                      <li key={check.id} className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-foreground">{check.label}</div>
                          <div>
                            Observed: <span className="font-semibold text-foreground">{current}</span> · Threshold:{" "}
                            <span className="font-semibold text-foreground">{threshold}</span>
                          </div>
                        </div>
                        <Badge variant={check.status ? "success" : "destructive"}>
                          {check.status ? "Pass" : "Action"}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="rounded-md border border-border/60 bg-background p-4 text-sm">
                <div className="text-xs uppercase text-muted-foreground">Candidate</div>
                <div className="mt-2 text-sm font-semibold text-foreground">
                  {bestCandidate?.strategy_id ?? "No candidate selected"}
                </div>
                <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Allocation</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(bestCandidate?.allocation ?? promotion.recommended_allocation ?? 0, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>ROI</span>
                    <span className="font-semibold text-foreground">
                      {formatPercent(bestCandidate?.metrics?.roi ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Drawdown</span>
                    <span className="font-semibold text-foreground">
                      {formatPercent(bestCandidate?.metrics?.max_drawdown_parent ?? 0, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Trades</span>
                    <span className="font-semibold text-foreground">
                      {bestCandidate?.metrics?.trade_count ?? promotion.trade_count ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Recommended Slice</span>
                    <span className="font-semibold text-foreground">
                      {formatPercent(promotion.recommended_bankroll_slice_pct ?? 0.05, 2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-border/50 bg-muted/10 p-4 text-sm">
                <div className="text-xs uppercase text-muted-foreground">Cohort Summary</div>
                <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Total PnL</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(summary?.total_pnl ?? 0, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>ROI</span>
                    <span className="font-semibold text-foreground">
                      {formatPercent(summary?.total_roi ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Bankroll Utilisation</span>
                    <span className="font-semibold text-foreground">
                      {formatPercent(summary?.bankroll_utilization_pct ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Trade Count</span>
                    <span className="font-semibold text-foreground">{summary?.trade_count ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Confidence Score</span>
                    <span className="font-semibold text-foreground">
                      {formatPercent(summary?.confidence_score ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-border/50 bg-muted/10 p-4 text-sm">
                <div className="text-xs uppercase text-muted-foreground">Parent Wallet</div>
                <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Starting Bankroll</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(parent?.starting_balance ?? 0, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Drawdown</span>
                    <span className="font-semibold text-foreground">
                      {formatPercent(parent?.drawdown_pct ?? promotion?.parent_drawdown_pct ?? 0, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Realised PnL</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(parent?.realized_pnl ?? 0, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Aggregate Exposure</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(parent?.aggregate_exposure ?? 0, 2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="promotion-slice">Bankroll slice (%)</Label>
                <Input
                  id="promotion-slice"
                  type="number"
                  min={1}
                  max={100}
                  step={0.5}
                  value={slicePct}
                  onChange={(event) => setSlicePct(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promotion-min-allocation">Minimum allocation (USD)</Label>
                <Input
                  id="promotion-min-allocation"
                  type="number"
                  min={10}
                  step={10}
                  value={minAllocationUsd}
                  onChange={(event) => setMinAllocationUsd(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promotion-min-trades">Minimum trade count</Label>
                <Input
                  id="promotion-min-trades"
                  type="number"
                  min={1}
                  step={1}
                  value={minTradeCount}
                  onChange={(event) => setMinTradeCount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promotion-max-slippage">Max slippage (%)</Label>
                <Input
                  id="promotion-max-slippage"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={maxSlippagePct}
                  onChange={(event) => setMaxSlippagePct(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promotion-max-drawdown">Max parent drawdown (%)</Label>
                <Input
                  id="promotion-max-drawdown"
                  type="number"
                  min={1}
                  step={0.5}
                  value={maxParentDrawdownPct}
                  onChange={(event) => setMaxParentDrawdownPct(event.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="promotion-notes">Approval notes (optional)</Label>
                <Textarea
                  id="promotion-notes"
                  placeholder="Document any overrides or compliance considerations before enabling promotion."
                  value={approvalNotes}
                  onChange={(event) => setApprovalNotes(event.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Promotion analytics will appear once cohort detail has finished loading.
          </div>
        )}

        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/10 px-4 py-3 text-sm">
          <Checkbox
            id="promotion-acknowledge"
            checked={acknowledge}
            onCheckedChange={(checked) => setAcknowledge(Boolean(checked))}
          />
          <label htmlFor="promotion-acknowledge" className="cursor-pointer select-none">
            I acknowledge the guard rails and accept responsibility for the Day-3 promotion decision.
          </label>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Cohort ID: <span className="font-semibold text-foreground">{cohortId ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handlePromote} disabled={!canPromote}>
              {submitting ? "Promoting…" : "Promote"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


