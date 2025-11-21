/* eslint-disable */
// @ts-nocheck
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Search, Shield, Sparkles } from "lucide-react";
import { TooltipExplainer } from "./TooltipExplainer";

interface Preset {
  id: string;
  name: string;
  description: string;
  icon: any;
  accounts: number;
  mutationsPerParent: number;
  championLimit: number;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline";
}

const presets: Preset[] = [
  {
    id: "quick",
    name: "Quick Test",
    description: "Fast iteration with fewer accounts for rapid experimentation",
    icon: Zap,
    accounts: 8,
    mutationsPerParent: 3,
    championLimit: 3,
    badge: "Fast",
    badgeVariant: "default",
  },
  {
    id: "deep",
    name: "Deep Search",
    description: "Thorough exploration with many accounts for robust results",
    icon: Search,
    accounts: 20,
    mutationsPerParent: 6,
    championLimit: 8,
    badge: "Thorough",
    badgeVariant: "secondary",
  },
  {
    id: "conservative",
    name: "Conservative",
    description: "Balanced approach with moderate accounts and mutations",
    icon: Shield,
    accounts: 12,
    mutationsPerParent: 4,
    championLimit: 5,
    badge: "Balanced",
    badgeVariant: "outline",
  },
];

interface EvolutionPresetsProps {
  symbol: string;
  interval: string;
  onSelectPreset: (preset: { accounts: number; mutationsPerParent: number; championLimit: number }) => void;
}

export function EvolutionPresets({ symbol, interval, onSelectPreset }: EvolutionPresetsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Experiment Presets
          <TooltipExplainer
            term="Experiment Presets"
            explanation="Pre-configured experiment settings optimized for different use cases. Quick Test for rapid iteration, Deep Search for comprehensive exploration, and Conservative for a balanced approach. Each preset adjusts the number of test accounts, mutations, and champions."
          />
        </CardTitle>
        <CardDescription>
          Choose a preset configuration for {symbol} @ {interval}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {presets.map((preset) => {
            const Icon = preset.icon;
            return (
              <div
                key={preset.id}
                className="relative rounded-lg border border-border bg-muted/20 p-4 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold text-sm">{preset.name}</h4>
                  </div>
                  {preset.badge && (
                    <Badge variant={preset.badgeVariant}>{preset.badge}</Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mb-4">
                  {preset.description}
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Accounts:</span>
                    <span className="font-medium">{preset.accounts}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Mutations/Parent:</span>
                    <span className="font-medium">{preset.mutationsPerParent}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Champions:</span>
                    <span className="font-medium">{preset.championLimit}</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => onSelectPreset({
                    accounts: preset.accounts,
                    mutationsPerParent: preset.mutationsPerParent,
                    championLimit: preset.championLimit,
                  })}
                >
                  Use This Preset
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

