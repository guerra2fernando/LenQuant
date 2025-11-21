/* eslint-disable */
// @ts-nocheck
import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, Plus, DollarSign, AlertCircle } from "lucide-react";
import { fetcher } from "@/lib/api";

const iconMap: Record<string, any> = {
  no_data: DollarSign,
  no_funds: Plus,
  ready_to_trade: TrendingUp,
  high_signal: Sparkles,
  portfolio_good: TrendingUp,
};

export function RecommendedActionCard() {
  const { data: recommendationData } = useSWR("/api/assistant/recommendations/context-aware", fetcher);

  if (!recommendationData?.recommendation) {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Recommended Next Step
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading recommendations...</p>
        </CardContent>
      </Card>
    );
  }

  const recommendation = recommendationData.recommendation;
  const IconComponent = iconMap[recommendation.type] || TrendingUp;

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconComponent className="h-5 w-5" />
          Recommended Next Step
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="font-semibold mb-1">{recommendation.title}</div>
          <p className="text-sm text-muted-foreground">{recommendation.description}</p>
        </div>
        
        {recommendation.actions && recommendation.actions.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {recommendation.actions.map((action: any, idx: number) => (
              <Link key={idx} href={action.url}>
                <Button 
                  variant={action.variant === "primary" ? "default" : "outline"}
                  className={idx === 0 ? "flex-1" : ""}
                >
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

