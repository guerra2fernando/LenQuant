/* eslint-disable */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { formatNumber, formatPercent } from "@/lib/utils";

type ParentWalletData = {
  name: string;
  balance: number;
  outstanding_capital: number;
  aggregate_exposure: number;
  utilization: number;
  cohort_allocations: Record<string, {
    allocated: number;
    outstanding: number;
    current_exposure: number;
    pnl?: number;
  }>;
};

type ParentWalletCardProps = {
  data: ParentWalletData;
};

export function ParentWalletCard({ data }: ParentWalletCardProps) {
  const utilizationPercent = data.utilization * 100;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Parent Wallet: {data.name}
          <TooltipExplainer
            term="Parent Wallet"
            explanation="The Parent Wallet manages capital allocation across multiple cohorts. It tracks how much capital is assigned to each experimental cohort and monitors aggregate exposure to enforce risk limits."
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Available Balance</div>
            <div className="text-xl font-bold">${formatNumber(data.balance, 2)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Outstanding Capital</div>
            <div className="text-xl font-bold">${formatNumber(data.outstanding_capital, 2)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Total Exposure</div>
            <div className="text-xl font-bold">${formatNumber(data.aggregate_exposure, 2)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Utilization</div>
            <div className="text-xl font-bold">{formatPercent(data.utilization)}</div>
          </div>
        </div>
        
        {/* Utilization Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Capital Deployed</span>
            <span className="text-muted-foreground">{formatPercent(data.utilization)}</span>
          </div>
          <Progress value={utilizationPercent} className="h-2" />
        </div>
        
        {/* Cohort Allocations */}
        {data.cohort_allocations && Object.keys(data.cohort_allocations).length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Cohort Allocations</div>
            <div className="space-y-1">
              {Object.entries(data.cohort_allocations).map(([cohortId, alloc]) => (
                <div key={cohortId} className="flex justify-between items-center text-sm p-2 border rounded">
                  <span className="font-mono text-xs">{cohortId.substring(0, 12)}...</span>
                  <div className="flex gap-4 text-right">
                    <span>${formatNumber(alloc.outstanding, 0)}</span>
                    {alloc.pnl !== undefined && (
                      <span className={alloc.pnl >= 0 ? "text-green-500" : "text-red-500"}>
                        {alloc.pnl >= 0 ? "+" : ""}${formatNumber(alloc.pnl, 2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

