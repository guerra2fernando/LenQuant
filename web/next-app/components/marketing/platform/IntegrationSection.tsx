"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Chrome, LayoutDashboard, ArrowRight, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function IntegrationSection() {
  return (
    <section className="section-padding bg-muted/20">
      <div className="container-marketing">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground">
            Better{" "}
            <span className="text-gradient">Together</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            The Chrome Extension and Web Platform work seamlessly together
            for the complete trading experience.
          </p>
        </motion.div>

        {/* Integration Diagram */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          <div className="grid md:grid-cols-3 gap-6 items-center">
            {/* Extension Card */}
            <div className="p-6 rounded-2xl border border-purple-500/30 bg-purple-500/5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
                <Chrome className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                Chrome Extension
              </h3>
              <p className="text-sm text-muted-foreground">
                Quick analysis while trading on Binance
              </p>
              <ul className="mt-4 text-sm text-left space-y-2">
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span className="text-muted-foreground">Real-time regime</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span className="text-muted-foreground">Leverage warnings</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span className="text-muted-foreground">AI explanations</span>
                </li>
              </ul>
            </div>

            {/* Sync Arrow */}
            <div className="hidden md:flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center mb-2">
                <RefreshCw className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowRight className="w-4 h-4" />
                <span>Synced</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </div>
            </div>

            {/* Platform Card */}
            <div className="p-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                <LayoutDashboard className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                Web Platform
              </h3>
              <p className="text-sm text-muted-foreground">
                Deep analytics and review sessions
              </p>
              <ul className="mt-4 text-sm text-left space-y-2">
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span className="text-muted-foreground">Full analytics</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span className="text-muted-foreground">Trade journal</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span className="text-muted-foreground">AI assistant</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Workflow Description */}
          <div className="mt-12 p-6 rounded-2xl border border-border/50 bg-card/50">
            <h3 className="text-lg font-display font-semibold text-foreground mb-4 text-center">
              The Complete Workflow
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400 mb-2">1</div>
                <h4 className="font-medium text-foreground mb-1">Trade</h4>
                <p className="text-sm text-muted-foreground">
                  Use the extension on Binance for real-time analysis and
                  disciplined entry decisions.
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-400 mb-2">2</div>
                <h4 className="font-medium text-foreground mb-1">Sync</h4>
                <p className="text-sm text-muted-foreground">
                  Your journal entries, analyses, and trades automatically sync
                  to the platform.
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-2">3</div>
                <h4 className="font-medium text-foreground mb-1">Review</h4>
                <p className="text-sm text-muted-foreground">
                  Analyze your performance, identify patterns, and improve your
                  trading with AI insights.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
