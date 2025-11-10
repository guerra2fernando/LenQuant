/* eslint-disable */
// @ts-nocheck
import { useState } from "react";

import { ApprovalModal } from "@/components/ApprovalModal";
import { Button } from "@/components/ui/button";

type Recommendation = {
  rec_id: string;
  symbol: string;
  horizon: string;
  pred_return: number;
  confidence: number;
  recommended_size_usd: number;
  stop_loss_pct: number;
  take_profit_pct: number;
  rationale_summary: string;
  evidence_refs?: string[];
  status?: string;
  created_at?: string;
};

type RecommendationCardProps = {
  recommendation: Recommendation;
  onDecision: (
    rec_id: string,
    decision: "approve" | "reject" | "modify" | "snooze",
    extra?: { user_notes?: string; modified_params?: Record<string, any>; pin?: string },
  ) => Promise<void>;
};

export function RecommendationCard({ recommendation, onDecision }: RecommendationCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDecision = async (decision: "approve" | "reject" | "modify" | "snooze", extra?: any) => {
    setIsSubmitting(true);
    try {
      await onDecision(recommendation.rec_id, decision, extra);
      setModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card/80 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {recommendation.symbol} &middot; {recommendation.horizon}
          </h3>
          <p className="text-xs text-muted-foreground">
            Confidence {(recommendation.confidence * 100).toFixed(1)}% · Predicted return {(recommendation.pred_return * 100).toFixed(2)}%
          </p>
        </div>
        <span className="text-xs uppercase tracking-wide text-primary">{recommendation.status ?? "pending"}</span>
      </div>
      <p className="mt-3 text-sm text-foreground">{recommendation.rationale_summary}</p>
      <div className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
        <div>Size: ${recommendation.recommended_size_usd.toFixed(2)}</div>
        <div>Stop loss: {(recommendation.stop_loss_pct * 100).toFixed(2)}%</div>
        <div>Take profit: {(recommendation.take_profit_pct * 100).toFixed(2)}%</div>
        <div>Evidence: {recommendation.evidence_refs?.length ?? 0}</div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="default" size="sm" onClick={() => setModalOpen(true)}>
          Approve
        </Button>
        <Button variant="secondary" size="sm" onClick={() => handleDecision("reject")}>
          Reject
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleDecision("snooze")}>
          Snooze
        </Button>
      </div>
      <ApprovalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={(pin) => handleDecision("approve", { pin })}
        isLoading={isSubmitting}
        recommendation={recommendation}
      />
    </div>
  );
}

