/* eslint-disable */
// @ts-nocheck

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  alertId: string;
  onConfirm: (alertId: string) => Promise<void> | void;
  label?: string;
  disabled?: boolean;
};

export function AcknowledgeDialog({ alertId, onConfirm, label = "Acknowledge", disabled = false }: Props) {
  const [isPending, setIsPending] = useState(false);

  const handleClick = useCallback(async () => {
    if (disabled || isPending) {
      return;
    }
    const confirmed = window.confirm("Mark this overfitting alert as acknowledged?");
    if (!confirmed) {
      return;
    }
    setIsPending(true);
    try {
      await onConfirm(alertId);
    } finally {
      setIsPending(false);
    }
  }, [alertId, disabled, isPending, onConfirm]);

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={disabled || isPending}>
      {isPending ? "Acknowledging..." : label}
    </Button>
  );
}

