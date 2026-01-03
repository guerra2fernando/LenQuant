"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  LineChart,
  Bot,
  BookOpen,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Overview of your trading activity and market conditions",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: LineChart,
    description: "Performance metrics, equity curves, and trade statistics",
  },
  {
    id: "assistant",
    label: "AI Assistant",
    icon: Bot,
    description: "Natural language interface for trading insights",
  },
  {
    id: "journal",
    label: "Journal",
    icon: BookOpen,
    description: "Trade history with notes and performance analysis",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    description: "Configure preferences, API keys, and notifications",
  },
];

export function DashboardPreview() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const activeTabData = tabs.find((t) => t.id === activeTab);

  return (
    <section className="section-padding">
      <div className="container-marketing">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground">
            Explore the{" "}
            <span className="text-gradient">Dashboard</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A powerful interface designed for serious traders.
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap justify-center gap-2 mb-8"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Preview Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative max-w-5xl mx-auto"
        >
          {/* Browser Chrome */}
          <div className="rounded-2xl overflow-hidden border border-border/50 bg-card/50 shadow-2xl">
            {/* Browser Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-lg bg-muted/80 text-xs text-muted-foreground">
                  app.lenquant.com/{activeTab}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="aspect-[16/10] bg-gradient-to-br from-background to-muted/50">
              {/* PLACEHOLDER: Replace with actual screenshots */}
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center p-8">
                  {activeTabData && (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
                        <activeTabData.icon className="w-8 h-8 text-purple-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        {activeTabData.label}
                      </h3>
                      <p className="text-muted-foreground max-w-md">
                        {activeTabData.description}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-4">
                        Screenshot placeholder — 1280 x 800 recommended
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Decorative glow */}
          <div className="absolute -inset-4 bg-purple-500/10 rounded-3xl blur-3xl -z-10" />
        </motion.div>
      </div>
    </section>
  );
}
