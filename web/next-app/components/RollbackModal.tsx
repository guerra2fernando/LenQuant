/* eslint-disable */
// @ts-nocheck

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

type RollbackModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategyId: string | null;
  onConfirm: (targetStrategyId: string | null) => Promise<void> | void;
};

export function RollbackModal({ open, onOpenChange, strategyId, onConfirm }: RollbackModalProps) {
  const [target, setTarget] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(target || null);
      setTarget("");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rollback Strategy</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Archive {strategyId ?? "selected strategy"} and optionally promote a prior champion.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <label className="text-xs uppercase text-muted-foreground" htmlFor="rollback-target">
            Promote Strategy ID (optional)
          </label>
          <Input
            id="rollback-target"
            placeholder="champion-strategy-id"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? "Rolling back…" : "Confirm Rollback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

