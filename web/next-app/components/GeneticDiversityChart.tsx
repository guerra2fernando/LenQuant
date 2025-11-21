/* eslint-disable */
// @ts-nocheck
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TooltipExplainer } from "./TooltipExplainer";
import { Activity, TrendingUp, TrendingDown } from "lucide-react";

interface DiversityMetrics {
  uniqueGenomes: number;
  totalStrategies: number;
  diversityScore: number; // 0-1
  mutationRate: number;
  convergenceRisk: "low" | "medium" | "high";
}

interface GeneticDiversityChartProps {
  metrics?: DiversityMetrics;
}

export function GeneticDiversityChart({ metrics }: GeneticDiversityChartProps) {
  if (!metrics) {
    return null;
  }

  const diversityPercent = metrics.diversityScore * 100;
  const convergenceColors = {
    low: "text-green-600",
    medium: "text-yellow-600",
    high: "text-red-600",
  };
  const convergenceColor = convergenceColors[metrics.convergenceRisk];

  const diversityCategories = [
    {
      label: "Very Diverse",
      min: 80,
      color: "bg-green-600",
      description: "Excellent variety in strategy population",
    },
    {
      label: "Healthy",
      min: 60,
      color: "bg-blue-600",
      description: "Good genetic diversity",
    },
    {
      label: "Moderate",
      min: 40,
      color: "bg-yellow-600",
      description: "Some convergence occurring",
    },
    {
      label: "Low",
      min: 0,
      color: "bg-red-600",
      description: "Population converging, consider more mutations",
    },
  ];

  const currentCategory = diversityCategories.find(cat => diversityPercent >= cat.min) || diversityCategories[diversityCategories.length - 1];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Genetic Diversity
          <TooltipExplainer
            term="Genetic Diversity"
            explanation="Measures how different your strategies are from each other. High diversity means the system is exploring many different approaches. Low diversity (convergence) means strategies are becoming similar, which can limit discovery. The system needs balance - enough diversity to explore, but some convergence toward good solutions."
          />
        </CardTitle>
        <CardDescription>
          Population variety and convergence risk assessment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Diversity Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Diversity Score</p>
            <Badge className={currentCategory.color}>
              {currentCategory.label}
            </Badge>
          </div>
          
          {/* Progress bar */}
          <div className="relative h-8 rounded-lg overflow-hidden bg-muted">
            <div 
              className={`h-full transition-all duration-500 ${currentCategory.color}`}
              style={{ width: `${diversityPercent}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white mix-blend-difference">
                {diversityPercent.toFixed(1)}%
              </span>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2">
            {currentCategory.description}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Unique Genomes</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">
              {metrics.uniqueGenomes}
            </p>
            <p className="text-xs text-muted-foreground">
              of {metrics.totalStrategies} total
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Mutation Rate</p>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">
              {(metrics.mutationRate * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">
              variation per generation
            </p>
          </div>
        </div>

        {/* Convergence Risk */}
        <div className={`rounded-lg border p-4 ${
          metrics.convergenceRisk === 'high' ? 'border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800' :
          metrics.convergenceRisk === 'medium' ? 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800' :
          'border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {metrics.convergenceRisk === 'high' ? <TrendingDown className={`h-5 w-5 ${convergenceColor}`} /> :
             metrics.convergenceRisk === 'medium' ? <Activity className={`h-5 w-5 ${convergenceColor}`} /> :
             <TrendingUp className={`h-5 w-5 ${convergenceColor}`} />}
            <p className={`font-semibold ${convergenceColor}`}>
              {metrics.convergenceRisk === 'high' ? 'High Convergence Risk' :
               metrics.convergenceRisk === 'medium' ? 'Moderate Convergence' :
               'Low Convergence Risk'}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {metrics.convergenceRisk === 'high' && 
              "Consider increasing mutation rate or introducing new random strategies to maintain diversity."}
            {metrics.convergenceRisk === 'medium' && 
              "Diversity is adequate but watch for further convergence. Current mutation rate is appropriate."}
            {metrics.convergenceRisk === 'low' && 
              "Excellent diversity! The population is exploring many different strategy approaches."}
          </p>
        </div>

        {/* Recommendations */}
        <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
          <p className="font-semibold">Diversity Guidelines:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• High diversity (&gt;80%): Good for exploration, continue current settings</li>
            <li>• Moderate (40-80%): Balanced state, normal evolution</li>
            <li>• Low (&lt;40%): Increase mutations or inject random strategies</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

