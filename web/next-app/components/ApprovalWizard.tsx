/* eslint-disable */
// @ts-nocheck
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn, formatNumber } from "@/lib/utils";

type ApprovalWizardProps = {
  onSubmit: (payload: {
    mode: string;
    symbol: string;
    side: string;
    type: string;
    quantity: number;
    price?: number | null;
  }) => Promise<void>;
  defaultSymbol?: string;
  defaultMode?: string;
};

const MODES = [
  { key: "paper", label: "Paper" },
  { key: "testnet", label: "Testnet" },
  { key: "live", label: "Live" },
];

export function ApprovalWizard({ onSubmit, defaultSymbol = "BTC/USDT", defaultMode = "paper" }: ApprovalWizardProps) {
  const [mode, setMode] = useState(defaultMode);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [side, setSide] = useState("buy");
  const [orderType, setOrderType] = useState("limit");
  const [quantity, setQuantity] = useState("0.01");
  const [price, setPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsedQty = parseFloat(quantity);
    const parsedPrice = price ? parseFloat(price) : null;
    if (!symbol || Number.isNaN(parsedQty) || parsedQty <= 0) {
      return;
    }
    if (orderType !== "market" && (parsedPrice === null || Number.isNaN(parsedPrice) || parsedPrice <= 0)) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        mode,
        symbol,
        side,
        type: orderType,
        quantity: parsedQty,
        price: orderType === "market" ? null : parsedPrice,
      });
      setQuantity("0.01");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval Wizard</CardTitle>
        <CardDescription>Convert an approved idea into an order. Fields respect trading guard rails.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                {MODES.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Symbol</Label>
              <Input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Side</Label>
              <Select value={side} onValueChange={setSide}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={orderType} onValueChange={setOrderType}>
                <option value="limit">Limit</option>
                <option value="market">Market</option>
                <option value="stop">Stop</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Quantity</Label>
              <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </div>
          </div>
          {orderType !== "market" ? (
            <div className="grid gap-2">
              <Label>Price</Label>
              <Input value={price} onChange={(event) => setPrice(event.target.value)} />
            </div>
          ) : null}
          <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            Estimated notional $
            {formatNumber(
              parseFloat(quantity || "0") * (orderType === "market" ? 0 : parseFloat(price || "0")),
              2,
            )}
          </div>
          <Button type="submit" disabled={isSubmitting} className={cn("justify-self-start")}>
            {isSubmitting ? "Submitting..." : "Submit Order"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

