/* eslint-disable */
// @ts-nocheck
import { useState } from "react";

import { SymbolDisplay } from "@/components/CryptoSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ApprovalModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => Promise<void> | void;
  isLoading?: boolean;
  recommendation: {
    rec_id: string;
    symbol: string;
    recommended_size_usd: number;
  };
};

export function ApprovalModal({ open, onClose, onConfirm, isLoading, recommendation }: ApprovalModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const handleConfirm = async () => {
    try {
      setError(null);
      await onConfirm(pin);
      setPin("");
    } catch (err) {
      setError(err?.message ?? "Failed to approve recommendation.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-foreground">Approve recommendation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm approval for <SymbolDisplay symbol={recommendation.symbol} logoSize={14} showText={true} /> sized{" "}
          <span className="font-semibold text-foreground">${recommendation.recommended_size_usd.toFixed(2)}</span>.
        </p>
        <div className="mt-4 space-y-2">
          <Label htmlFor="assistant-approval-pin" className="text-xs uppercase tracking-wide text-muted-foreground">
            PIN / MFA
          </Label>
          <Input
            id="assistant-approval-pin"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="Enter approval PIN"
            className="text-sm"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || !pin}>
            {isLoading ? "Approving…" : "Approve"}
          </Button>
        </div>
      </div>
    </div>
  );
}

