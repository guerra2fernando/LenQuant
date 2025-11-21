/* eslint-disable */
// @ts-nocheck
import Link from "next/link";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, MessageSquare, Zap, BarChart3, AlertCircle } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { ExchangeConnectionPrompt } from "./ExchangeConnectionPrompt";

type PortfolioActionsCardProps = {
  mode: string;
  balance: number;
  hasPositions: boolean;
  isExchangeConnected?: boolean;
};

export function PortfolioActionsCard({ 
  mode, 
  balance, 
  hasPositions,
  isExchangeConnected = false 
}: PortfolioActionsCardProps) {
  const router = useRouter();

  // For live mode without exchange connection
  if (mode === "live" && !isExchangeConnected) {
    return <ExchangeConnectionPrompt context="portfolio" />;
  }

  // For modes with balance
  if (balance > 0) {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle>What would you like to do?</CardTitle>
          <CardDescription>
            You have ${formatNumber(balance, 2)} available
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Manual Trade */}
          <Link href="/terminal">
            <Button 
              variant="outline" 
              className="h-auto flex-col items-start gap-2 p-4 w-full"
            >
              <TrendingUp className="h-5 w-5 text-primary" />
              <div className="font-semibold">Trade Manually</div>
              <div className="text-xs text-muted-foreground text-left">
                Place your own trades on the Terminal
              </div>
            </Button>
          </Link>
          
          {/* Get Recommendations */}
          <Link href="/assistant?prompt=What should I trade right now?">
            <Button 
              variant="outline" 
              className="h-auto flex-col items-start gap-2 p-4 w-full"
            >
              <MessageSquare className="h-5 w-5 text-primary" />
              <div className="font-semibold">Get AI Recommendation</div>
              <div className="text-xs text-muted-foreground text-left">
                Ask the assistant what to trade
              </div>
            </Button>
          </Link>
          
          {/* Auto-trade */}
          <Link href="/settings?tab=autonomy">
            <Button 
              variant="outline" 
              className="h-auto flex-col items-start gap-2 p-4 w-full"
            >
              <Zap className="h-5 w-5 text-primary" />
              <div className="font-semibold">Enable Auto-Trading</div>
              <div className="text-xs text-muted-foreground text-left">
                Let the system trade for you
              </div>
            </Button>
          </Link>
          
          {/* View Insights */}
          <Link href="/insights">
            <Button 
              variant="outline" 
              className="h-auto flex-col items-start gap-2 p-4 w-full"
            >
              <BarChart3 className="h-5 w-5 text-primary" />
              <div className="font-semibold">View Market Insights</div>
              <div className="text-xs text-muted-foreground text-left">
                See forecasts and strategies
              </div>
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return null;
}

