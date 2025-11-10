/* eslint-disable */
// @ts-nocheck
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OrderAmendFormProps = {
  defaultPrice?: number | null;
  onSubmit: (updates: { price: number }) => Promise<void>;
  onCancel: () => void;
};

export function OrderAmendForm({ defaultPrice, onSubmit, onCancel }: OrderAmendFormProps) {
  const [price, setPrice] = useState(defaultPrice ? String(defaultPrice) : "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const parsed = parseFloat(price);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ price: parsed });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Label>New Price</Label>
        <Input value={price} onChange={(event) => setPrice(event.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          Apply
        </Button>
      </div>
    </div>
  );
}

