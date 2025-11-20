/* eslint-disable */
// @ts-nocheck
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ToastProvider";
import { postJson } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { Wallet, Plus, Minus, RotateCcw } from "lucide-react";

type PaperWalletControlsProps = {
  currentBalance: number;
  onBalanceChanged: () => void;
  mode?: string;
};

export function PaperWalletControls({ 
  currentBalance, 
  onBalanceChanged,
  mode = "paper"
}: PaperWalletControlsProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const { pushToast } = useToast();

  const handleAdjust = async (operation: "add" | "remove" | "reset") => {
    setLoading(true);
    try {
      const payload: any = {
        mode,
        operation,
        reason: "manual adjustment via portfolio page",
      };
      
      if (operation !== "reset") {
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
          pushToast({
            title: "Invalid amount",
            description: "Please enter a positive number",
            variant: "error",
          });
          setLoading(false);
          return;
        }
        payload.amount = amountNum;
      }
      
      const result = await postJson("/api/trading/wallet/adjust", payload);
      
      pushToast({
        title: "Wallet adjusted",
        description: `New balance: $${formatNumber(result.new_balance, 2)}`,
        variant: "success",
      });
      
      setAmount("");
      onBalanceChanged();
    } catch (error: any) {
      pushToast({
        title: "Adjustment failed",
        description: error.message || "Failed to adjust wallet",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          {mode === "paper" ? "Paper" : "Testnet"} Wallet Controls
          <TooltipExplainer
            term="Wallet Controls"
            explanation="Manage your virtual trading capital. Add funds to increase buying power, remove funds to simulate withdrawals, or reset to default balance. These adjustments are for simulation purposes only and help you test different capital scenarios."
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4">
          <div className="text-sm text-muted-foreground">Current Balance</div>
          <div className="text-2xl font-bold">${formatNumber(currentBalance, 2)}</div>
        </div>

        <div>
          <Label htmlFor="amount">Amount (USD)</Label>
          <Input
            id="amount"
            type="number"
            placeholder="1000.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading}
            className="mt-1"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => handleAdjust("add")}
            disabled={loading || !amount}
            className="flex-1"
            variant="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Funds
          </Button>
          
          <Button
            onClick={() => handleAdjust("remove")}
            disabled={loading || !amount}
            variant="outline"
            className="flex-1"
          >
            <Minus className="h-4 w-4 mr-2" />
            Remove
          </Button>
        </div>
        
        <Button
          onClick={() => handleAdjust("reset")}
          disabled={loading}
          variant="secondary"
          className="w-full"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Default
        </Button>
        
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          All adjustments are logged in the ledger with full audit trail
        </div>
      </CardContent>
    </Card>
  );
}

