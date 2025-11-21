/* eslint-disable */
// @ts-nocheck
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Brain, BarChart3, Target, TrendingUp, MessageSquare, Settings as SettingsIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function SetupCompletePage() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: Brain,
      label: "Training AI models",
      duration: 2000,
      description: "Building predictive models from your data",
    },
    {
      icon: BarChart3,
      label: "Generating forecasts",
      duration: 1500,
      description: "Creating price predictions",
    },
    {
      icon: Target,
      label: "Finding best strategies",
      duration: 2500,
      description: "Analyzing trading patterns",
    },
  ];

  useEffect(() => {
    let totalDuration = 0;
    let elapsed = 0;
    
    const interval = setInterval(() => {
      elapsed += 100;
      const currentStepData = steps[currentStep];
      const stepProgress = (elapsed / currentStepData.duration) * 100;
      
      setProgress(Math.min(stepProgress, 100));
      
      if (elapsed >= currentStepData.duration) {
        if (currentStep < steps.length - 1) {
          setCurrentStep(prev => prev + 1);
          elapsed = 0;
          setProgress(0);
        } else {
          clearInterval(interval);
          setProgress(100);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [currentStep]);

  const isComplete = currentStep === steps.length - 1 && progress === 100;

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-12">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Your Data is Ready!</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          We're now setting up your trading platform
        </p>
      </div>

      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Progress</CardTitle>
          <CardDescription>
            This takes about 6 minutes. You can track detailed progress in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCurrentStep = idx === currentStep;
            const isCompleted = idx < currentStep || (idx === currentStep && progress === 100);

            return (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-3">
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : isCurrentStep ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
                  ) : (
                    <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${isCompleted ? "text-green-700" : isCurrentStep ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                      {isCompleted && (
                        <Badge variant="success">Complete</Badge>
                      )}
                      {isCurrentStep && !isCompleted && (
                        <Badge variant="default">In Progress</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                    {isCurrentStep && (
                      <Progress value={progress} className="h-1 mt-2" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* What You Can Do Now */}
      <Card>
        <CardHeader>
          <CardTitle>What you can do now:</CardTitle>
          <CardDescription>
            Your trading platform is ready to use
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Link href="/portfolio">
            <Button 
              variant="outline" 
              className="h-auto flex-col items-start gap-2 p-4 w-full"
            >
              <TrendingUp className="h-6 w-6 text-primary" />
              <div className="font-semibold">Add Paper Money</div>
              <div className="text-xs text-muted-foreground text-left">
                Start with virtual funds to test strategies
              </div>
            </Button>
          </Link>

          <Link href="/insights">
            <Button 
              variant="outline" 
              className="h-auto flex-col items-start gap-2 p-4 w-full"
            >
              <BarChart3 className="h-6 w-6 text-primary" />
              <div className="font-semibold">Explore Market Insights</div>
              <div className="text-xs text-muted-foreground text-left">
                View AI predictions and forecasts
              </div>
            </Button>
          </Link>

          <Link href="/assistant">
            <Button 
              variant="outline" 
              className="h-auto flex-col items-start gap-2 p-4 w-full"
            >
              <MessageSquare className="h-6 w-6 text-primary" />
              <div className="font-semibold">Ask the AI Assistant</div>
              <div className="text-xs text-muted-foreground text-left">
                Get personalized trading recommendations
              </div>
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">💡 Quick Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              <span><strong>Start with paper trading:</strong> Test strategies risk-free before using real money</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              <span><strong>Check the insights page:</strong> See what the AI predicts about market movements</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              <span><strong>Use the assistant:</strong> Ask questions anytime - it knows everything about your account</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">4.</span>
              <span><strong>Monitor the risk dashboard:</strong> Keep track of exposure and safety limits</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Link href="/" className="flex-1">
          <Button variant="default" size="lg" className="w-full">
            Go to Dashboard
          </Button>
        </Link>
        <Link href="/settings?tab=data-ingestion">
          <Button variant="outline" size="lg">
            <SettingsIcon className="mr-2 h-4 w-4" />
            Track Progress
          </Button>
        </Link>
      </div>
    </div>
  );
}

export async function getStaticProps() {
  return {
    props: {
      title: "Setup Complete - LenQuant",
      description: "Your trading platform is ready to use",
    },
  };
}

