/* eslint-disable */
// @ts-nocheck
import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { AlertCircle, CheckCircle } from "lucide-react";

export function PortfolioQuickStatusCard() {
  const { data: portfolio } = useSWR("/api/trading/portfolio/summary/cached", fetcher);
  const { data: exchangeStatus } = useSWR("/api/exchange/status", fetcher);

  const paperBalance = portfolio?.modes?.paper?.wallet_balance ?? 0;
  const liveConnected = exchangeStatus?.live_trading_enabled ?? false;
  
  // Get the primary connected exchange
  const connectedExchange = Object.entries(exchangeStatus?.exchanges || {}).find(
    ([_, status]: [string, any]) => status?.connected
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Portfolio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Paper Mode */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <div className="font-semibold">Paper Trading</div>
            <div className="text-sm text-muted-foreground">
              {paperBalance > 0 ? `$${formatNumber(paperBalance, 2)}` : "No funds"}
            </div>
          </div>
          {paperBalance === 0 ? (
            <Link href="/portfolio">
              <Button size="sm">Add Funds</Button>
            </Link>
          ) : (
            <Link href="/terminal">
              <Button size="sm" variant="outline">Trade Now</Button>
            </Link>
          )}
        </div>
        
        {/* Live Mode */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <div className="font-semibold">Live Trading</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              {liveConnected ? (
                <>
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Connected{connectedExchange ? ` (${connectedExchange[0]})` : ""}
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 text-muted-foreground" />
                  Not connected
                </>
              )}
            </div>
          </div>
          {!liveConnected && (
            <Link href="/settings?tab=trading">
              <Button size="sm" variant="outline">Connect Exchange</Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

