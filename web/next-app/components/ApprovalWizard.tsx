/* eslint-disable */
// @ts-nocheck
import { FormEvent, useEffect, useMemo, useState } from "react";

import { SymbolDisplay } from "@/components/CryptoSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipExplainer } from "@/components/TooltipExplainer";
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
  symbolOptions?: string[];
};

const MODES = [
  { key: "paper", label: "Paper" },
  { key: "testnet", label: "Testnet" },
  { key: "live", label: "Live" },
];

function normalizeSymbol(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function ApprovalWizard({
  onSubmit,
  defaultSymbol = "BTC/USD",
  defaultMode = "paper",
  symbolOptions,
}: ApprovalWizardProps) {
  const [mode, setMode] = useState(defaultMode);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [side, setSide] = useState("buy");
  const [orderType, setOrderType] = useState("limit");
  const [quantity, setQuantity] = useState("0.01");
  const [quoteNotional, setQuoteNotional] = useState("");
  const quickPickSymbols = useMemo(() => {
    if (!symbolOptions?.length) {
      return [];
    }
    return symbolOptions.slice(0, 8);
  }, [symbolOptions]);

  const [quantityMode, setQuantityMode] = useState<"base" | "quote">("base");
  const [price, setPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    setSymbol(defaultSymbol);
  }, [defaultSymbol]);

  const { baseCurrency, quoteCurrency } = useMemo(() => {
    const parts = normalizeSymbol(symbol).split("/");
    return {
      baseCurrency: parts[0] ?? "",
      quoteCurrency: parts[1] ?? "USD",
    };
  }, [symbol]);

  const modeLabel = useMemo(() => MODES.find((item) => item.key === mode)?.label ?? mode, [mode]);

  const effectivePrice = useMemo(() => {
    const parsed = parseFloat(price);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [price]);

  const parsedBaseQuantity = useMemo(() => {
    const parsed = parseFloat(quantity);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [quantity]);

  const parsedQuoteNotional = useMemo(() => {
    const parsed = parseFloat(quoteNotional);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [quoteNotional]);

  const derivedBaseQuantity = useMemo(() => {
    if (quantityMode === "base") {
      return parsedBaseQuantity;
    }
    if (!effectivePrice) {
      return 0;
    }
    return parsedQuoteNotional / effectivePrice;
  }, [effectivePrice, parsedBaseQuantity, parsedQuoteNotional, quantityMode]);

  const notionalUsd = useMemo(() => {
    if (!effectivePrice) {
      return 0;
    }
    return derivedBaseQuantity * effectivePrice;
  }, [derivedBaseQuantity, effectivePrice]);

  const quoteValueDisplay = useMemo(() => {
    if (effectivePrice && derivedBaseQuantity) {
      return `$${formatNumber(notionalUsd, 2)}`;
    }
    if (quantityMode === "quote" && parsedQuoteNotional) {
      return `${formatNumber(parsedQuoteNotional, 2)} ${quoteCurrency}`;
    }
    return "Add a price to see USD value";
  }, [derivedBaseQuantity, effectivePrice, notionalUsd, parsedQuoteNotional, quantityMode, quoteCurrency]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedSymbol = normalizeSymbol(symbol);
    const submissionQuantity = derivedBaseQuantity;
    const parsedPrice = price ? parseFloat(price) : null;
    const requiresPrice = orderType !== "market" || quantityMode === "quote";

    if (!normalizedSymbol || Number.isNaN(submissionQuantity) || submissionQuantity <= 0) {
      return;
    }
    if (
      requiresPrice &&
      (parsedPrice === null || Number.isNaN(parsedPrice) || parsedPrice <= 0)
    ) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        mode,
        symbol: normalizedSymbol,
        side,
        type: orderType,
        quantity: submissionQuantity,
        price: orderType === "market" ? null : parsedPrice,
      });
      setQuantity("0.01");
      setQuoteNotional("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>
              Approval Wizard
              <TooltipExplainer 
                term="Approval Wizard" 
                explanation="This form helps you place trading orders with proper validation and safety checks. It guides you through entering all required information (symbol, side, size, price) and automatically calculates order values. All fields respect your configured risk limits and trading guardrails to prevent mistakes."
              />
            </CardTitle>
            <CardDescription>
              Convert an approved idea into an order. Fields respect trading guard rails.
            </CardDescription>
          </div>
          <Badge variant="outline" className="uppercase tracking-wide">
            Mode: {modeLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>
                Mode
                <TooltipExplainer 
                  term="Trading Mode" 
                  explanation="Where this order will execute: Paper (virtual/simulation), Testnet (exchange sandbox with test funds), or Live (real money on real exchanges). Choose Paper first to practice safely."
                  size="sm"
                />
              </Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>
                Symbol
                <TooltipExplainer 
                  term="Trading Symbol" 
                  explanation="The cryptocurrency trading pair, like BTC/USD (Bitcoin priced in USDT) or ETH/USD (Ethereum in US Dollars). The format is always BASE/QUOTE where you're buying/selling the BASE currency using the QUOTE currency."
                  size="sm"
                />
              </Label>
              <Input
                value={symbol}
                placeholder="e.g., BTC/USD"
                onChange={(event) => setSymbol(normalizeSymbol(event.target.value))}
              />
              {quickPickSymbols.length ? (
                <div className="flex flex-wrap gap-2">
                  {quickPickSymbols.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      size="sm"
                      variant={normalizeSymbol(option) === symbol ? "default" : "outline"}
                      className="text-xs flex items-center gap-1.5 px-3 py-1.5"
                      onClick={() => setSymbol(normalizeSymbol(option))}
                    >
                      <SymbolDisplay symbol={normalizeSymbol(option)} logoSize={12} showText={true} />
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>
                Side
                <TooltipExplainer 
                  term="Order Side" 
                  explanation="Buy means you're purchasing the cryptocurrency (expecting price to go up). Sell means you're selling it (expecting price to go down or taking profit). You can only sell what you already own or have a short position on."
                  size="sm"
                />
              </Label>
              <Select value={side} onValueChange={setSide}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>
                Type
                <TooltipExplainer 
                  term="Order Type" 
                  explanation="Market orders execute immediately at the current price. Limit orders wait until your specified price is reached before executing (may not fill if price doesn't reach your limit). Stop orders trigger when price crosses a threshold, useful for stop-losses or breakout entries."
                  size="sm"
                />
              </Label>
              <Select value={orderType} onValueChange={setOrderType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="limit">Limit</SelectItem>
                  <SelectItem value="market">Market</SelectItem>
                  <SelectItem value="stop">Stop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>
                Order Size
                <TooltipExplainer 
                  term="Order Size" 
                  explanation="Choose whether to specify your order size in base currency units (e.g., 0.5 BTC) or in quote currency value (e.g., $25,000 worth). Base units give you exact cryptocurrency amounts; quote value lets you think in dollar terms."
                  size="sm"
                />
              </Label>
              <div className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 p-1 text-xs">
                <Button
                  type="button"
                  variant={quantityMode === "base" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setQuantityMode("base")}
                >
                  {baseCurrency || "Base"} Units
                </Button>
                <Button
                  type="button"
                  variant={quantityMode === "quote" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setQuantityMode("quote")}
                >
                  {quoteCurrency} Value
                </Button>
              </div>
              {quantityMode === "base" ? (
                <Input
                  value={quantity}
                  placeholder={`e.g., 0.05 ${baseCurrency}`}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              ) : (
                <Input
                  value={quoteNotional}
                  placeholder={`e.g., 2500 ${quoteCurrency}`}
                  onChange={(event) => setQuoteNotional(event.target.value)}
                />
              )}
            </div>
          </div>
          {(orderType !== "market" || quantityMode === "quote") && (
            <div className="grid gap-1.5">
              <Label>
                {orderType === "market" ? "Reference Price (USD)" : "Limit / Stop Price (USD)"}
              </Label>
              <Input
                value={price}
                placeholder="e.g., 48250"
                onChange={(event) => setPrice(event.target.value)}
              />
              {orderType === "market" ? (
                <p className="text-xs text-muted-foreground">
                  Used as an estimated fill price to translate the order value into units.
                </p>
              ) : null}
            </div>
          )}
          <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Base units</span>
              <span className="font-semibold text-foreground">
                {formatNumber(derivedBaseQuantity || 0, 6)} {baseCurrency || "UNIT"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Quote value</span>
              <span className="font-semibold text-foreground">{quoteValueDisplay}</span>
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting} className={cn("justify-self-start")}>
            {isSubmitting ? "Submitting..." : "Submit Order"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

