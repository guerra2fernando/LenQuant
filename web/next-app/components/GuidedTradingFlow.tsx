import React, { useState, useEffect } from "react";
import { ArrowRight, CheckCircle2, TrendingUp, TrendingDown, Eye } from "lucide-react";
import useSWR from "swr";

import { SymbolDisplay, CryptoSelector } from "@/components/CryptoSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { useMode } from "@/lib/mode-context";
import { toast } from "sonner";
import { fetcher } from "@/lib/api";
import { cn, formatNumber } from "@/lib/utils";

type TradingAction = "buy" | "sell" | "positions" | "recommendations";

type GuidedTradingFlowProps = {
  onActionSelect?: (action: TradingAction) => void;
  onSubmitOrder?: (order: { symbol: string; side: "buy" | "sell"; size: number }) => Promise<void>;
};

type OrderData = {
  symbol: string;
  side: "buy" | "sell";
  size: string;
};

export function GuidedTradingFlow({ onActionSelect, onSubmitOrder }: GuidedTradingFlowProps) {
  const { isEasyMode } = useMode();
  const [selectedAction, setSelectedAction] = useState<TradingAction | null>(null);
  const [step, setStep] = useState<number>(1);
  const [orderData, setOrderData] = useState<OrderData>({ symbol: "BTC/USD", side: "buy", size: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dollarAmount, setDollarAmount] = useState<string>("");
  const [coinAmount, setCoinAmount] = useState<string>("");
  const [availableSymbols, setAvailableSymbols] = useState<string[]>(["BTC/USD", "ETH/USD"]);

  // Fetch available symbols
  const { data: symbolsData } = useSWR<{ symbols: string[] }>(
    "/api/market/symbols",
    fetcher
  );

  // Fetch current price for selected symbol
  const { data: priceData } = useSWR<{ price: number; symbol: string; timestamp: string }>(
    orderData.symbol ? `/api/market/latest-price?symbol=${encodeURIComponent(orderData.symbol)}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const currentPrice = priceData?.price ?? 0;

  // Update available symbols when data loads
  useEffect(() => {
    if (symbolsData?.symbols) {
      setAvailableSymbols(symbolsData.symbols);
    }
  }, [symbolsData]);

  // Handle symbol change from CryptoSelector
  const handleSymbolChange = (symbol: string) => {
    setOrderData({ ...orderData, symbol });
    // Reset amounts when symbol changes
    setDollarAmount("");
    setCoinAmount("");
  };

  // Handle dollar amount change - convert to coin amount
  const handleDollarAmountChange = (value: string) => {
    setDollarAmount(value);
    if (currentPrice > 0 && value) {
      const coinValue = parseFloat(value) / currentPrice;
      setCoinAmount(coinValue.toFixed(8));
    } else {
      setCoinAmount("");
    }
  };

  // Handle coin amount change - convert to dollar amount
  const handleCoinAmountChange = (value: string) => {
    setCoinAmount(value);
    if (currentPrice > 0 && value) {
      const dollarValue = parseFloat(value) * currentPrice;
      setDollarAmount(dollarValue.toFixed(2));
    } else {
      setDollarAmount("");
    }
  };


  // Only show in Easy Mode
  if (!isEasyMode) {
    return null;
  }

  const handleActionSelect = (action: TradingAction) => {
    setSelectedAction(action);
    setStep(1);
    onActionSelect?.(action);
  };

  const handleSubmitOrder = async () => {
    if (!orderData.symbol || !coinAmount || !dollarAmount) {
      toast.error("Validation Error", {
        description: "Please fill in all required fields",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitOrder?.({
        symbol: orderData.symbol,
        side: orderData.side,
        size: parseFloat(coinAmount), // Use coin amount for the order
      });

      toast.success("Order Submitted Successfully!", {
        description: `${orderData.side.toUpperCase()} ${coinAmount} ${orderData.symbol}`,
      });

      setStep(2); // Show success
    } catch (error: any) {
      console.error("Order submission error:", error);
      toast.error("Order Failed", {
        description: error.message || "Failed to submit order",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selectedAction) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>
            What would you like to do?
            <TooltipExplainer 
              term="Guided Trading" 
              explanation="This step-by-step guide makes trading simple, especially if you're new to cryptocurrency. It walks you through each decision with plain language explanations, helping you understand what you're doing and why. Choose an action to get started with easy-to-follow instructions."
            />
          </CardTitle>
          <CardDescription>Choose an action to get step-by-step guidance</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="outline"
            className="h-auto flex-col items-start gap-2 p-4 text-left"
            onClick={() => handleActionSelect("buy")}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <span className="font-semibold">Buy Cryptocurrency</span>
              <TooltipExplainer
                term="Buy Cryptocurrency"
                explanation="This guides you through buying crypto step by step.

You'll enter which cryptocurrency you want (like BTC or ETH) and how much money you want to spend. The system will walk you through confirming the details before placing the order."
                size="sm"
              />
            </div>
            <span className="text-xs text-muted-foreground">Purchase crypto with step-by-step guidance</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto flex-col items-start gap-2 p-4 text-left"
            onClick={() => handleActionSelect("sell")}
          >
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <span className="font-semibold">Sell Cryptocurrency</span>
              <TooltipExplainer
                term="Sell Cryptocurrency"
                explanation="This guides you through selling crypto you already own.

You'll specify what you want to sell and how much. Selling converts your cryptocurrency back to cash (or stablecoin), locking in any profit or loss."
                size="sm"
              />
            </div>
            <span className="text-xs text-muted-foreground">Sell your crypto holdings</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto flex-col items-start gap-2 p-4 text-left"
            onClick={() => handleActionSelect("positions")}
          >
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-500" />
              <span className="font-semibold">Check My Positions</span>
              <TooltipExplainer
                term="Check Positions"
                explanation="View all the cryptocurrencies you currently own, how much you paid for them, and what they're worth now.

This shows your profit/loss and helps you decide what to do next."
                size="sm"
              />
            </div>
            <span className="text-xs text-muted-foreground">View your current holdings and their value</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto flex-col items-start gap-2 p-4 text-left"
            onClick={() => handleActionSelect("recommendations")}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="font-semibold">See Recommendations</span>
              <TooltipExplainer
                term="Trading Recommendations"
                explanation="Get AI-powered suggestions based on current market conditions and the system's predictions.

The assistant analyzes data from all your strategies and forecasts to suggest the best trading opportunities right now."
                size="sm"
              />
            </div>
            <span className="text-xs text-muted-foreground">Get AI-powered trading suggestions</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (selectedAction === "buy" || selectedAction === "sell") {
    if (step === 2) {
      return (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Order Submitted Successfully!
            </CardTitle>
            <CardDescription>Your {selectedAction} order has been submitted and is being processed.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Symbol:</span>
                <SymbolDisplay symbol={orderData.symbol} logoSize={16} />
              </div>
              <div>
                <span className="font-semibold">Side:</span> {orderData.side === "buy" ? "Buy" : "Sell"}
              </div>
              <div>
                <span className="font-semibold">Dollar Amount:</span> ${formatNumber(parseFloat(dollarAmount), 2)} USD
              </div>
              <div>
                <span className="font-semibold">Coin Amount:</span> {formatNumber(parseFloat(coinAmount), 8)} {orderData.symbol.split('/')[0]}
              </div>
            </div>
            <Button className="mt-4" onClick={() => {
              setSelectedAction(null);
              setStep(1);
              setOrderData({ symbol: "BTC/USD", side: "buy", size: "" });
              setDollarAmount("");
              setCoinAmount("");
            }}>
              Place Another Order
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>
            {selectedAction === "buy" ? "Buy" : "Sell"} Cryptocurrency - Step {step} of 2
          </CardTitle>
          <CardDescription>
            {step === 1
              ? "Let's set up your order. First, choose what you want to trade."
              : "Review your order details and submit when ready."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 ? (
            <>
              <div className="space-y-2">
                <Label>What cryptocurrency do you want to {selectedAction}?</Label>
                <CryptoSelector
                  availableSymbols={availableSymbols}
                  selectedSymbols={[orderData.symbol]}
                  onSelectionChange={(symbols) => handleSymbolChange(symbols[0] || "")}
                  placeholder="Select a cryptocurrency..."
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Choose the trading pair you want to {selectedAction}
                </p>
              </div>

              {/* Current Price Display */}
              {orderData.symbol && currentPrice > 0 && (
                <div className="rounded-lg border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Current Price:</span>
                    <span className="font-semibold">${formatNumber(currentPrice, 2)}</span>
                  </div>
                </div>
              )}

              {/* Amount Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dollar-amount">Dollar Amount (USD)</Label>
                  <Input
                    id="dollar-amount"
                    type="number"
                    placeholder="e.g., 100"
                    value={dollarAmount}
                    onChange={(e) => handleDollarAmountChange(e.target.value)}
                    step="0.01"
                  />
                  <p className="text-xs text-muted-foreground">
                    How much money to {selectedAction === "buy" ? "spend" : "receive"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coin-amount">Coin Amount</Label>
                  <Input
                    id="coin-amount"
                    type="number"
                    placeholder="e.g., 0.001"
                    value={coinAmount}
                    onChange={(e) => handleCoinAmountChange(e.target.value)}
                    step="0.00000001"
                  />
                  <p className="text-xs text-muted-foreground">
                    Equivalent {orderData.symbol.split('/')[0]} amount
                  </p>
                </div>
              </div>

              <Button onClick={() => setStep(2)} disabled={!orderData.symbol || !dollarAmount || !coinAmount} className="w-full">
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-lg border bg-background p-4">
                <h4 className="mb-3 font-semibold">Review Your Order</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Action:</span>
                    <span className="font-medium">{selectedAction === "buy" ? "Buy" : "Sell"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Symbol:</span>
                    <SymbolDisplay symbol={orderData.symbol} logoSize={16} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dollar Amount:</span>
                    <span className="font-medium">${formatNumber(parseFloat(dollarAmount), 2)} USD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coin Amount:</span>
                    <span className="font-medium">{formatNumber(parseFloat(coinAmount), 8)} {orderData.symbol.split('/')[0]}</span>
                  </div>
                  {currentPrice > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price per Coin:</span>
                      <span className="font-medium">${formatNumber(currentPrice, 2)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleSubmitOrder} disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? "Submitting..." : `Submit ${selectedAction === "buy" ? "Buy" : "Sell"} Order`}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  if (selectedAction === "positions") {
    return (
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader>
          <CardTitle>Your Positions</CardTitle>
          <CardDescription>View your current cryptocurrency holdings below</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your positions will appear in the table below. This shows what cryptocurrencies you currently own and their
            current value.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setSelectedAction(null)}>
            Choose Another Action
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (selectedAction === "recommendations") {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>Get Recommendations</CardTitle>
          <CardDescription>Visit the Assistant page to get AI-powered trading recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The Assistant uses advanced AI to analyze market conditions and suggest the best trading opportunities for
            you.
          </p>
          <Button className="mt-4" onClick={() => (window.location.href = "/assistant")}>
            Go to Assistant
          </Button>
          <Button variant="outline" className="ml-2 mt-4" onClick={() => setSelectedAction(null)}>
            Choose Another Action
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}

