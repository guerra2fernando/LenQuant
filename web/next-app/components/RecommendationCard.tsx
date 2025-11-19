/* eslint-disable */
// @ts-nocheck
import { useState } from "react";

import { ApprovalModal } from "@/components/ApprovalModal";
import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import { SymbolDisplay } from "@/components/CryptoSelector";
import { useMode } from "@/lib/mode-context";

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
  const { isEasyMode } = useMode();
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

  // Simplify language for Easy Mode
  const getPlainLanguageSummary = (): string => {
    const pred = recommendation.pred_return * 100;
    const conf = recommendation.confidence * 100;
    const symbol = recommendation.symbol;

    if (pred > 5 && conf > 70) {
      return `Strong recommendation to buy ${symbol}. The system predicts a ${pred.toFixed(1)}% price increase with ${conf.toFixed(0)}% confidence.`;
    } else if (pred > 2 && conf > 50) {
      return `Moderate recommendation to buy ${symbol}. The system predicts a ${pred.toFixed(1)}% price increase with ${conf.toFixed(0)}% confidence.`;
    } else if (pred < -5 && conf > 70) {
      return `Strong recommendation to avoid or sell ${symbol}. The system predicts a ${Math.abs(pred).toFixed(1)}% price decrease with ${conf.toFixed(0)}% confidence.`;
    } else {
      return `The system suggests ${symbol} with ${conf.toFixed(0)}% confidence. ${recommendation.rationale_summary}`;
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card/80 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <SymbolDisplay symbol={recommendation.symbol} logoSize={18} />
            {isEasyMode ? "" : `· ${recommendation.horizon}`}
          </h3>
          <p className="text-xs text-muted-foreground">
            {isEasyMode ? (
              <>
                Confidence: {(recommendation.confidence * 100).toFixed(0)}% · Expected change:{" "}
                {(recommendation.pred_return * 100).toFixed(1)}%
              </>
            ) : (
              <>
                Confidence {(recommendation.confidence * 100).toFixed(1)}% · Predicted return{" "}
                {(recommendation.pred_return * 100).toFixed(2)}%
              </>
            )}
          </p>
        </div>
        <span className="text-xs uppercase tracking-wide text-primary">{recommendation.status ?? "pending"}</span>
      </div>
      {isEasyMode ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-foreground">{getPlainLanguageSummary()}</p>
          <CardDescription className="text-xs">
            <div className="mt-2 space-y-1">
              <div>Recommended amount: ${recommendation.recommended_size_usd.toFixed(2)}</div>
              <div>
                Stop loss: {(recommendation.stop_loss_pct * 100).toFixed(1)}% (sells automatically if price drops
                this much)
              </div>
              <div>
                Take profit: {(recommendation.take_profit_pct * 100).toFixed(1)}% (sells automatically if price
                rises this much)
              </div>
            </div>
          </CardDescription>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm text-foreground">{recommendation.rationale_summary}</p>
          <div className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
            <div>Size: ${recommendation.recommended_size_usd.toFixed(2)}</div>
            <div>Stop loss: {(recommendation.stop_loss_pct * 100).toFixed(2)}%</div>
            <div>Take profit: {(recommendation.take_profit_pct * 100).toFixed(2)}%</div>
            <div>Evidence: {recommendation.evidence_refs?.length ?? 0}</div>
          </div>
        </>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="default" size="sm" onClick={() => setModalOpen(true)}>
          {isEasyMode ? "Accept Recommendation" : "Approve"}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => handleDecision("reject")}>
          {isEasyMode ? "Decline" : "Reject"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleDecision("snooze")}>
          {isEasyMode ? "Maybe Later" : "Snooze"}
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

