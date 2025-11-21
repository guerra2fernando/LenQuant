/* eslint-disable */
// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";

import { AccountSelector } from "@/components/AccountSelector";
import { AlertStream } from "@/components/AlertStream";
import { ApprovalWizard } from "@/components/ApprovalWizard";
import { DayThreePromotionModal } from "@/components/DayThreePromotionModal";
import { ExecutionLatencyChart } from "@/components/ExecutionLatencyChart";
import { FillsFeed } from "@/components/FillsFeed";
import { GuidedTradingFlow } from "@/components/GuidedTradingFlow";
import { KillSwitchPanel } from "@/components/KillSwitchPanel";
import { OrderAmendForm } from "@/components/OrderAmendForm";
import { OrderBlotter } from "@/components/OrderBlotter";
import { PositionsTable } from "@/components/PositionsTable";
import { RiskGaugeCard } from "@/components/RiskGaugeCard";
import { TradingTabs } from "@/components/TradingTabs";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMode } from "@/lib/mode-context";
import { fetcher, postJson } from "@/lib/api";
import { useWebSocket } from "@/lib/hooks";
import { formatNumber, formatPercent } from "@/lib/utils";
import type { CohortListItem } from "@/types/cohorts";

const MODES = [
  { key: "paper", label: "Paper", description: "Virtual ledger and fills — safest place to start." },
  { key: "testnet", label: "Testnet", description: "Exchange sandbox mirroring live order flow." },
  { key: "live", label: "Live", description: "Guarded live trading. MFA + permissions required." },
];

type CohortListResponse = {
  cohorts: CohortListItem[];
  pagination?: {
    page: number;
    page_size: number;
    total_pages: number;
    total: number;
  };
};

export default function TradingControlCenterPage() {
  const { isEasyMode } = useMode();
  const router = useRouter();
  const [mode, setMode] = useState("paper");
  const [editingOrder, setEditingOrder] = useState(null);
  const [promotionModalOpen, setPromotionModalOpen] = useState(false);
  const [promotionCohortId, setPromotionCohortId] = useState<string | null>(null);

  // Use WebSocket for real-time updates, fallback to polling
  const { data: wsData, isConnected: wsConnected } = useWebSocket("/ws/trading");
  const {
    data: summary,
    mutate: refreshSummary,
    isValidating,
  } = useSWR("/api/trading/summary", fetcher, { 
    refreshInterval: wsConnected ? 0 : 15_000, // Disable polling if WebSocket is connected
  });

  const {
    data: cohortsData,
    mutate: mutateCohorts,
  } = useSWR<CohortListResponse>("/api/experiments/cohorts?page=1&page_size=5", fetcher, {
    refreshInterval: 20_000,
  });

  const cohortsList = cohortsData?.cohorts ?? [];
  const latestCohort = cohortsList.length ? cohortsList[0] : null;

  useEffect(() => {
    if (promotionCohortId || !latestCohort) {
      return;
    }
    setPromotionCohortId(latestCohort.cohort_id);
  }, [latestCohort, promotionCohortId]);

  useEffect(() => {
    const promoParamRaw = router.query?.promo;
    if (!promoParamRaw) {
      return;
    }
    const promoParam = Array.isArray(promoParamRaw) ? promoParamRaw[0] : promoParamRaw;
    let targetId: string | null = null;
    if (promoParam === "latest") {
      targetId = latestCohort?.cohort_id ?? null;
    } else if (typeof promoParam === "string") {
      targetId = promoParam;
    }
    if (targetId) {
      setPromotionCohortId(targetId);
      setPromotionModalOpen(true);
    }
    if (promoParam) {
      const { promo, ...rest } = router.query;
      void router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    }
  }, [router, latestCohort]);

  const selectedPromotionCohort =
    cohortsList.find((cohort) => cohort.cohort_id === (promotionCohortId ?? latestCohort?.cohort_id)) ?? latestCohort;

  const promotionConfidence = selectedPromotionCohort?.summary?.confidence_score ?? 0;
  const promotionRoi = selectedPromotionCohort?.summary?.total_roi ?? 0;
  const promotionPnl = selectedPromotionCohort?.summary?.total_pnl ?? 0;

  const formatCurrency = useCallback(
    (value?: number | null) => `$${formatNumber(value ?? 0, 2)}`,
    [],
  );

  const handleOpenPromotionModal = useCallback(
    (cohortId?: string | null) => {
      const targetId = cohortId ?? promotionCohortId ?? latestCohort?.cohort_id ?? null;
      if (targetId) {
        setPromotionCohortId(targetId);
        setPromotionModalOpen(true);
      }
    },
    [latestCohort?.cohort_id, promotionCohortId],
  );

  const handlePromotionSuccess = useCallback(async () => {
    await mutateCohorts();
    await refreshSummary();
  }, [mutateCohorts, refreshSummary]);

  // Merge WebSocket data with summary data
  const mergedSummary = useMemo(() => {
    if (wsData && wsData.type === "trading_update") {
      // Use WebSocket data if available
      return {
        orders: wsData.orders || [],
        fills: wsData.fills || [],
        positions: wsData.positions || [],
        risk: summary?.risk || { open_exposure: {}, kill_switch: { armed: false } },
      };
    }
    return summary;
  }, [wsData, summary]);

  const orders = useMemo(
    () => (mergedSummary?.orders ?? []).filter((order) => order.mode === mode),
    [mergedSummary, mode],
  );
  const positions = useMemo(
    () => (mergedSummary?.positions ?? []).filter((position) => (position.mode ?? mode) === mode),
    [mergedSummary, mode],
  );
  const fills = useMemo(
    () => (mergedSummary?.fills ?? []).filter((fill) => (fill.mode ?? mode) === mode).slice(0, 8),
    [mergedSummary, mode],
  );
  const latencies = useMemo(() => {
    return orders
      .filter((order) => order.created_at && order.updated_at)
      .map((order) => {
        const start = new Date(order.created_at).getTime();
        const end = new Date(order.updated_at).getTime();
        return Math.max(0, end - start);
      })
      .slice(-12);
  }, [orders]);

  const risk = mergedSummary?.risk ?? summary?.risk ?? { open_exposure: {}, kill_switch: { armed: false } };

  const symbolShortlist = useMemo(() => {
    const unique = new Set<string>();
    (orders ?? []).forEach((order) => {
      if (order.symbol) {
        unique.add(order.symbol);
      }
    });
    (positions ?? []).forEach((position) => {
      if (position.symbol) {
        unique.add(position.symbol);
      }
    });
    (fills ?? []).forEach((fill) => {
      if (fill.symbol) {
        unique.add(fill.symbol);
      }
    });
    return Array.from(unique).sort();
  }, [orders, positions, fills]);

  const handleSubmitOrder = async (payload) => {
    await postJson("/api/trading/orders", payload);
    toast.success("Order submitted", { description: `${payload.side.toUpperCase()} ${payload.symbol}` });
    await refreshSummary();
  };

  const handleGuidedOrder = async (order: { symbol: string; side: "buy" | "sell"; size: number }) => {
    const payload = {
      symbol: order.symbol,
      side: order.side,
      quantity: order.size,
      mode: mode,
      type: "market",
    };
    await handleSubmitOrder(payload);
  };

  const handleCancel = async (order) => {
    await postJson(`/api/trading/orders/${order.order_id}/cancel`, { reason: "user" });
    toast.warning("Order canceled", { description: order.order_id });
    await refreshSummary();
  };

  const handleSync = async (order) => {
    await postJson(`/api/trading/orders/${order.order_id}/sync`, {});
    toast.info("Order synced", { description: order.order_id });
    await refreshSummary();
  };

  const handleAmend = (order) => setEditingOrder(order);

  const handleAmendSubmit = async (updates) => {
    if (!editingOrder) return;
    await postJson(`/api/trading/orders/${editingOrder.order_id}/amend`, updates);
    toast.success("Order amended", { description: editingOrder.order_id });
    setEditingOrder(null);
    await refreshSummary();
  };

  const handleKillSwitchArm = async (reason) => {
    await postJson("/api/admin/kill-switch", { action: "arm", reason, mode });
    toast.error("Kill switch armed", { description: reason });
    await refreshSummary();
  };

  const handleKillSwitchRelease = async () => {
    await postJson("/api/admin/kill-switch", { action: "release" });
    toast.success("Kill switch released", { description: "Trading resumes." });
    await refreshSummary();
  };

  const alerts = useMemo(() => {
    return fills.slice(0, 5).map((fill) => ({
      title: `${fill.symbol} ${fill.side.toUpperCase()} fill`,
      message: `${fill.quantity} @ $${fill.price}`,
      severity: fill.pnl >= 0 ? "success" : "warning",
      timestamp: fill.executed_at,
    }));
  }, [fills]);

  const exposureEntries = Object.entries(risk.open_exposure ?? {}).map(([key, value]) => ({
    mode: key,
    value,
    limit: mergedSummary?.risk?.settings?.risk?.max_open_exposure_usd ?? summary?.risk?.settings?.risk?.max_open_exposure_usd ?? 1,
  }));

  return (
    <>
      <div className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-4">
          <TradingTabs mode={mode} onModeChange={setMode} modes={MODES} />
          {isEasyMode ? (
            <GuidedTradingFlow onSubmitOrder={handleGuidedOrder} />
          ) : (
            <ApprovalWizard onSubmit={handleSubmitOrder} defaultMode={mode} symbolOptions={symbolShortlist} />
          )}
          {editingOrder ? (
            <Card className="p-4">
              <OrderAmendForm
                defaultPrice={editingOrder.price}
                onSubmit={handleAmendSubmit}
                onCancel={() => setEditingOrder(null)}
              />
            </Card>
          ) : null}
          <OrderBlotter orders={orders} onCancel={handleCancel} onSync={handleSync} onAmend={handleAmend} />
          <PositionsTable positions={positions} mode={mode} />
        </div>
        <div className="w-full space-y-4 lg:w-80">
          <KillSwitchPanel
            killSwitch={risk.kill_switch}
            onArm={handleKillSwitchArm}
            onRelease={handleKillSwitchRelease}
          />
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Day-3 Promotion
                  <TooltipExplainer 
                    term="Day-3 Promotion" 
                    explanation="This is the final stage of strategy validation. After strategies pass Day-1 (basic tests) and Day-2 (extended validation), Day-3 evaluates intraday cohorts for potential promotion to live trading. Only strategies with high confidence and strong performance metrics can be promoted to real trading."
                    size="sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Review intraday cohorts before enabling live promotion.
                </p>
              </div>
              <Badge variant={promotionConfidence >= 0.6 ? "success" : "secondary"}>
                {selectedPromotionCohort ? `Confidence ${formatPercent(promotionConfidence ?? 0)}` : "No cohort"}
              </Badge>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Cohort
                <select
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground shadow-sm"
                  value={promotionCohortId ?? latestCohort?.cohort_id ?? ""}
                  onChange={(event) => setPromotionCohortId(event.target.value || null)}
                >
                  {cohortsList.length ? (
                    cohortsList.map((cohort) => (
                      <option key={cohort.cohort_id} value={cohort.cohort_id}>
                        {cohort.cohort_id}
                      </option>
                    ))
                  ) : (
                    <option value="">No intraday cohorts</option>
                  )}
                </select>
              </label>
              {selectedPromotionCohort ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    ROI{" "}
                    <span className="font-semibold text-foreground">
                      {formatPercent(promotionRoi ?? 0)}
                    </span>
                  </div>
                  <div>
                    PnL{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(promotionPnl ?? 0)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
            <Button
              size="sm"
              onClick={() => handleOpenPromotionModal(promotionCohortId ?? latestCohort?.cohort_id ?? null)}
              disabled={!cohortsList.length}
            >
              Review Day-3 Promotion
            </Button>
          </Card>
          <ExecutionLatencyChart samples={latencies} />
          <AlertStream alerts={alerts} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RiskGaugeCard
          title="Open Exposure"
          current={risk.open_exposure?.[mode] ?? 0}
          limit={mergedSummary?.risk?.settings?.risk?.max_open_exposure_usd ?? summary?.risk?.settings?.risk?.max_open_exposure_usd ?? 1}
          tooltip="Open Exposure measures the total value of all your active positions combined. This limit prevents you from having too much money tied up in trades at once, protecting you from overexposure to market risk. If you hit this limit, you'll need to close some positions before opening new ones."
        />
        <RiskGaugeCard
          title="Daily Loss"
          current={Math.abs(mergedSummary?.risk?.daily_loss_usd ?? summary?.risk?.daily_loss_usd ?? 0)}
          limit={mergedSummary?.risk?.settings?.risk?.max_daily_loss_usd ?? summary?.risk?.settings?.risk?.max_daily_loss_usd ?? 1}
          tone={(mergedSummary?.risk?.daily_loss_usd ?? summary?.risk?.daily_loss_usd ?? 0) < 0 ? "warning" : "ok"}
          tooltip="Daily Loss tracks how much money you've lost today across all trades. This limit acts as a circuit breaker - if you lose too much in one day, trading stops automatically to prevent emotional decision-making and further losses. The limit resets at midnight."
        />
        <RiskGaugeCard
          title="Max Trade Cap"
          current={0}
          limit={mergedSummary?.risk?.settings?.risk?.max_trade_usd ?? summary?.risk?.settings?.risk?.max_trade_usd ?? 1}
          description="Auto-calculated per order."
          tooltip="Max Trade Cap limits the size of any single trade. This prevents accidentally placing orders that are too large relative to your account size. The system calculates this automatically based on your account balance and risk tolerance to ensure proper position sizing."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FillsFeed fills={fills} />
        <ExecutionLatencyChart samples={latencies} />
      </div>
      </div>
      <DayThreePromotionModal
        open={promotionModalOpen}
        cohortId={promotionCohortId}
        onClose={() => setPromotionModalOpen(false)}
        onPromoted={handlePromotionSuccess}
      />
    </>
  );
}

export async function getStaticProps() {
  return {
    props: {
      title: "Trading Dashboard - LenQuant",
      description: "Execute cryptocurrency trades with AI-powered insights. Monitor positions, manage orders, and optimize your trading strategy in real-time.",
    },
  };
}

