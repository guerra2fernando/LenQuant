/* eslint-disable */
// @ts-nocheck
import React from "react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { Sparkles, TrendingUp, AlertCircle, RefreshCw, Target, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/api";
import { useMode } from "@/lib/mode-context";

export function ProactiveSuggestions() {
  const router = useRouter();
  const { isEasyMode } = useMode();
  
  // Use consolidated suggestions endpoint (Phase 2 UX Conciliation)
  const userMode = isEasyMode ? "easy" : "advanced";
  const { data: suggestionsData } = useSWR(`/api/assistant/suggestions?user_mode=${userMode}`, fetcher, {
    refreshInterval: 60000, // Refresh every minute
  });

  const suggestions = suggestionsData?.suggestions || [];

  // Icon mapping based on suggestion type
  const iconMap: { [key: string]: any } = {
    model_stale: RefreshCw,
    high_signal: Target,
    take_profits: TrendingUp,
    ready_to_trade: Sparkles,
    add_funds: AlertCircle,
    explore_insights: Sparkles,
  };

  const iconColorMap: { [key: string]: string } = {
    model_stale: "text-yellow-600",
    high_signal: "text-green-600",
    take_profits: "text-green-600",
    ready_to_trade: "text-blue-600",
    add_funds: "text-yellow-600",
    explore_insights: "text-purple-600",
  };

  // Convert backend suggestions to display format
  const displaySuggestions = suggestions.slice(0, 2).map((suggestion: any) => {
    const firstAction = suggestion.actions?.[0];
    return {
      id: suggestion.id,
      icon: iconMap[suggestion.type] || Sparkles,
      iconColor: iconColorMap[suggestion.type] || "text-primary",
      title: suggestion.title,
      description: suggestion.description,
      reasoning: suggestion.reasoning,
      cta: firstAction?.label || "View",
      ctaVariant: firstAction?.url?.includes("terminal") ? "default" : "outline",
      action: () => router.push(firstAction?.url || "/"),
    };
  });

  if (displaySuggestions.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {displaySuggestions.map((suggestion) => {
          const Icon = suggestion.icon;
          return (
            <div
              key={suggestion.id}
              className="rounded-lg border bg-card p-4 space-y-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg bg-background ${suggestion.iconColor}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="text-sm font-semibold">{suggestion.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {suggestion.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={suggestion.ctaVariant as any}
                  onClick={suggestion.action}
                  className="text-xs"
                >
                  {suggestion.cta}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

