/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Settings, TrendingUp, MessageSquare, Shield, FlaskConical, Brain, Database, HardDrive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMode } from "@/lib/mode-context";
import GeneralTab from "./settings/GeneralTab";
import TradingTab from "./settings/TradingTab";
import AssistantTab from "./settings/AssistantTab";
import AutonomyTab from "./settings/AutonomyTab";
import ExperimentsTab from "./settings/ExperimentsTab";
import LearningTab from "./settings/LearningTab";
import DataRetentionTab from "./settings/DataRetentionTab";
import DataIngestionTab from "./settings/DataIngestionTab";

import { Bell } from "lucide-react";
import NotificationTab from "./settings/NotificationTab";

// Easy Mode tabs - only essential settings
const EASY_MODE_TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "trading", label: "Trading", icon: TrendingUp },
  { id: "assistant", label: "Assistant", icon: MessageSquare },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "data-ingestion", label: "Data", icon: HardDrive },
] as const;

// Advanced Mode tabs - all settings
const ADVANCED_MODE_TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "trading", label: "Trading", icon: TrendingUp },
  { id: "assistant", label: "Assistant", icon: MessageSquare },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "data-ingestion", label: "Data Ingestion", icon: HardDrive },
  { id: "autonomy", label: "Autonomy", icon: Shield },
  { id: "experiments", label: "Experiments", icon: FlaskConical },
  { id: "learning", label: "Learning", icon: Brain },
  { id: "data-retention", label: "Data Retention", icon: Database },
] as const;

type EasyTabId = (typeof EASY_MODE_TABS)[number]["id"];
type AdvancedTabId = (typeof ADVANCED_MODE_TABS)[number]["id"];

export default function SettingsPage(): JSX.Element {
  const router = useRouter();
  const { isEasyMode } = useMode();
  const tabs = isEasyMode ? EASY_MODE_TABS : ADVANCED_MODE_TABS;
  const [activeTab, setActiveTab] = useState<EasyTabId | AdvancedTabId>("general");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Set active tab from URL query parameter - prioritize 'section' for backwards compatibility
    const sectionParam = router.query.section as string;
    const tabParam = router.query.tab as string;
    const activeParam = sectionParam || tabParam;
    
    if (activeParam && tabs.some((t) => t.id === activeParam)) {
      setActiveTab(activeParam as EasyTabId | AdvancedTabId);
    }
  }, [router, tabs]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEasyMode
            ? "Configure essential settings for your trading experience."
            : "Configure all system settings including advanced options."}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant={isActive ? "default" : "ghost"}
              onClick={() => {
                setActiveTab(tab.id);
                // Update URL without navigation
                router.replace({ pathname: router.pathname, query: { tab: tab.id } }, undefined, { shallow: true });
              }}
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
        {activeTab === "general" && <GeneralTab />}
        {activeTab === "trading" && <TradingTab />}
        {activeTab === "assistant" && <AssistantTab />}
        {activeTab === "notifications" && <NotificationTab />}
        {activeTab === "data-ingestion" && <DataIngestionTab />}
        {!isEasyMode && activeTab === "autonomy" && <AutonomyTab />}
        {!isEasyMode && activeTab === "experiments" && <ExperimentsTab />}
        {!isEasyMode && activeTab === "learning" && <LearningTab />}
        {!isEasyMode && activeTab === "data-retention" && <DataRetentionTab />}
      </div>
    </div>
  );
}

export async function getStaticProps() {
  return {
    props: {
      title: "Settings - LenQuant",
      description: "Configure your trading preferences, system settings, and platform options for an optimized experience.",
    },
  };
}