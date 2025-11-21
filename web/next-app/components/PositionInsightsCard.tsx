/* eslint-disable */
// @ts-nocheck
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { formatNumber } from "@/lib/utils";

type Position = {
  symbol: string;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
};

type PositionInsightsCardProps = {
  positions: Position[];
};

export function PositionInsightsCard({ positions }: PositionInsightsCardProps) {
  if (!positions || positions.length === 0) {
    return null;
  }

  const profitablePositions = positions.filter(p => p.unrealized_pnl > 0);
  const losingPositions = positions.filter(p => p.unrealized_pnl < 0);
  const bigWinners = profitablePositions.filter(p => p.unrealized_pnl_pct > 0.05); // >5% profit
  const bigLosers = losingPositions.filter(p => p.unrealized_pnl_pct < -0.03); // >3% loss

  return (
    <Card>
      <CardHeader>
        <CardTitle>Position Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Show profitable positions */}
        {bigWinners.length > 0 && (
          <div className="p-3 border border-green-500/20 bg-green-500/5 rounded-lg">
            <div className="font-semibold text-green-700 flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4" />
              {bigWinners.length} profitable {bigWinners.length === 1 ? "position" : "positions"}!
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              You have {bigWinners.length} {bigWinners.length === 1 ? "position" : "positions"} up more than 5%. 
              Consider taking profits or setting trailing stops.
            </p>
            <Link href="/assistant?prompt=Should I take profits on my winning positions?">
              <Button size="sm" variant="outline" className="w-full">
                Ask Assistant for Advice
              </Button>
            </Link>
          </div>
        )}
        
        {/* Show losing positions */}
        {bigLosers.length > 0 && (
          <div className="p-3 border border-red-500/20 bg-red-500/5 rounded-lg">
            <div className="font-semibold text-red-700 flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4" />
              {bigLosers.length} {bigLosers.length === 1 ? "position" : "positions"} at a loss
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {bigLosers.length} {bigLosers.length === 1 ? "position is" : "positions are"} down more than 3%. 
              Review your stop-losses or consider cutting losses.
            </p>
            <Link href="/terminal">
              <Button size="sm" variant="outline" className="w-full">
                Review Positions
              </Button>
            </Link>
          </div>
        )}

        {/* Neutral message if no extreme positions */}
        {bigWinners.length === 0 && bigLosers.length === 0 && (
          <div className="p-3 border rounded-lg">
            <div className="font-semibold flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-blue-500" />
              Positions in Range
            </div>
            <p className="text-sm text-muted-foreground">
              All {positions.length} {positions.length === 1 ? "position is" : "positions are"} within normal profit/loss ranges. 
              Monitor them regularly and adjust as needed.
            </p>
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          <div>
            <div className="text-xs text-muted-foreground">Profitable</div>
            <div className="text-lg font-semibold text-green-600">
              {profitablePositions.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">At Loss</div>
            <div className="text-lg font-semibold text-red-600">
              {losingPositions.length}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

