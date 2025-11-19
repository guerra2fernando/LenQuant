/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { BarChart3, TrendingUp, Sparkles, Brain } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMode } from "@/lib/mode-context";
import ForecastsTab from "./analytics/ForecastsTab";
import StrategiesTab from "./analytics/StrategiesTab";
import EvolutionTab from "./analytics/EvolutionTab";
import LearningInsightsTab from "./analytics/LearningInsightsTab";

const TABS = [
  { id: "forecasts", label: "Forecasts", icon: TrendingUp },
  { id: "strategies", label: "Strategies", icon: BarChart3 },
  { id: "evolution", label: "Evolution", icon: Sparkles },
  { id: "insights", label: "Learning Insights", icon: Brain },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AnalyticsPage(): JSX.Element {
  const router = useRouter();
  const { isAdvancedMode } = useMode();
  const [activeTab, setActiveTab] = useState<TabId>("forecasts");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Only show in Advanced Mode - redirect if in Easy Mode
    if (!isAdvancedMode) {
      router.push("/insights");
      return;
    }
    // Set active tab from URL query parameter
    const tabParam = router.query.tab as string;
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam as TabId);
    }
  }, [isAdvancedMode, router]);

  if (!mounted || !isAdvancedMode) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Comprehensive view of forecasts, strategies, evolution, and learning insights.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant={isActive ? "default" : "ghost"}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "forecasts" && <ForecastsTab />}
        {activeTab === "strategies" && <StrategiesTab />}
        {activeTab === "evolution" && <EvolutionTab />}
        {activeTab === "insights" && <LearningInsightsTab />}
      </div>
    </div>
  );
}

export async function getStaticProps() {
  return {
    props: {
      title: "Analytics Dashboard - LenQuant",
      description: "Deep dive into market analytics, performance metrics, and trading data with advanced visualization tools.",
    },
  };
}

