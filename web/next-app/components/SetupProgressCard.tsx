/* eslint-disable */
// @ts-nocheck
import { useEffect } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { fetcher } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/router";

type SetupStep = {
  id: string;
  label: string;
  completed: boolean;
  current?: boolean;
  action?: string;
  actionLabel?: string;
};

export function SetupProgressCard() {
  const router = useRouter();
  const { data: setupProgress, mutate: mutateProgress } = useSWR("/api/user/setup-progress", fetcher);
  const { data: portfolio } = useSWR("/api/trading/portfolio/summary/cached", fetcher);
  const { data: overview } = useSWR("/api/admin/overview", fetcher);
  const { data: reports } = useSWR("/api/reports?limit=1", fetcher);

  // Determine actual state
  const hasData = overview?.inventory?.some((row: any) => row.ohlcv_count > 0) ?? false;
  const hasPaperMoney = (portfolio?.modes?.paper?.wallet_balance ?? 0) > 0;
  const hasPositions = (portfolio?.modes?.paper?.positions?.length ?? 0) > 0;
  const hasReports = (reports?.reports?.length ?? 0) > 0;

  // Update backend progress when state changes
  useEffect(() => {
    const updateStep = async (step: string) => {
      try {
        await fetch("/api/user/setup-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step }),
        });
        mutateProgress();
      } catch (err) {
        console.error(`Failed to update step ${step}:`, err);
      }
    };

    if (hasData && !setupProgress?.steps_completed?.data_ingested) {
      updateStep("data_ingested");
    }
    if (hasReports && !setupProgress?.steps_completed?.models_trained) {
      updateStep("models_trained");
    }
    if (hasPaperMoney && !setupProgress?.steps_completed?.paper_money_added) {
      updateStep("paper_money_added");
    }
    if (hasPositions && !setupProgress?.steps_completed?.first_trade_placed) {
      updateStep("first_trade_placed");
    }
  }, [hasData, hasReports, hasPaperMoney, hasPositions, setupProgress, mutateProgress]);

  // Use backend progress if available, fallback to computed
  const stepsCompleted = setupProgress?.steps_completed || {
    data_ingested: hasData,
    models_trained: hasReports,
    paper_money_added: hasPaperMoney,
    first_trade_placed: hasPositions,
  };

  const steps: SetupStep[] = [
    {
      id: "data",
      label: "Data ingested",
      completed: stepsCompleted.data_ingested,
      action: !stepsCompleted.data_ingested ? "/get-started" : undefined,
      actionLabel: !stepsCompleted.data_ingested ? "Get Started" : undefined,
    },
    {
      id: "reports",
      label: "Models trained",
      completed: stepsCompleted.models_trained,
    },
    {
      id: "paper-money",
      label: "Paper money added",
      completed: stepsCompleted.paper_money_added,
      current: stepsCompleted.data_ingested && !stepsCompleted.paper_money_added,
      action: !stepsCompleted.paper_money_added ? "/portfolio" : undefined,
      actionLabel: !stepsCompleted.paper_money_added ? "Add Paper Money" : undefined,
    },
    {
      id: "first-trade",
      label: "First trade placed",
      completed: stepsCompleted.first_trade_placed,
      current: stepsCompleted.paper_money_added && !stepsCompleted.first_trade_placed,
      action: !stepsCompleted.first_trade_placed && stepsCompleted.paper_money_added ? "/terminal" : undefined,
      actionLabel: !stepsCompleted.first_trade_placed && stepsCompleted.paper_money_added ? "Start Trading" : undefined,
    },
  ];

  const completedStepCount = steps.filter(s => s.completed).length;
  const totalSteps = steps.length;
  const progress = (completedStepCount / totalSteps) * 100;
  const isComplete = setupProgress?.onboarding_completed || completedStepCount === totalSteps;

  // Find current step
  const currentStep = steps.find(s => s.current) || steps.find(s => !s.completed);

  if (isComplete) {
    return null; // Don't show if setup is complete
  }

  return (
    <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader>
        <CardTitle>Setup Progress</CardTitle>
        <CardDescription>
          {completedStepCount} of {totalSteps} steps complete
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progress} className="h-2" />
        
        <div className="space-y-2">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {step.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : step.current ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={`text-sm ${step.completed ? "text-muted-foreground" : step.current ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {currentStep?.action && (
          <Link href={currentStep.action}>
            <Button className="w-full mt-2">
              {currentStep.actionLabel || "Continue Setup"}
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

