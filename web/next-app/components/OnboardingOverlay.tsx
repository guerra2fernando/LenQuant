// @ts-nocheck
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { postJson } from "@/lib/api";
import { toast } from "sonner";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target: string; // Element selector or position description
  position: "top" | "bottom" | "left" | "right";
}

const TERMINAL_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to the Trading Terminal! 🚀",
    description:
      "This quick tour will show you the key features. You can skip anytime or restart from settings.",
    target: "welcome",
    position: "top",
  },
  {
    id: "chart",
    title: "📈 Interactive Chart",
    description:
      "View real-time price data with AI predictions overlaid. Toggle predictions on/off to compare accuracy.",
    target: "chart",
    position: "bottom",
  },
  {
    id: "smart-signals",
    title: "🎯 Smart Signals",
    description:
      "AI-powered trading signals with confidence scores. Hover over signals to see why they were generated.",
    target: "smart-signals",
    position: "left",
  },
  {
    id: "order-panel",
    title: "⚡ Quick Order Panel",
    description:
      "Execute trades instantly. Switch between Buy/Sell, set amounts, and see estimated outcomes before submitting.",
    target: "order-panel",
    position: "left",
  },
  {
    id: "positions",
    title: "💼 Position Tracking",
    description:
      "Monitor your open positions, track profit/loss in real-time, and manage stop-losses. All your active trades in one place.",
    target: "positions",
    position: "top",
  },
  {
    id: "complete",
    title: "You're All Set! 🎉",
    description:
      "You now know the basics. Start trading or explore the AI Assistant for personalized guidance.",
    target: "complete",
    position: "top",
  },
];

interface OnboardingOverlayProps {
  page: "terminal" | "analytics";
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingOverlay({ page, onComplete, onSkip }: OnboardingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const steps = page === "terminal" ? TERMINAL_STEPS : TERMINAL_STEPS;
  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsVisible(false);
    
    // Mark tour as completed in backend
    try {
      await postJson("/api/user/tour-complete", { page });
    } catch (error) {
      console.error("Failed to save tour completion:", error);
      // Don't block user flow if API fails
    }
    
    onComplete();
  };

  const handleSkipClick = () => {
    setIsVisible(false);
    onSkip();
  };

  if (!isVisible) return null;

  // Calculate position styles based on step
  const getPositionStyles = () => {
    if (step.id === "welcome" || step.id === "complete") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "500px",
      };
    }

    // For other steps, position relative to their targets
    // In a production app, you'd calculate this dynamically based on target element
    switch (step.id) {
      case "chart":
        return {
          top: "25%",
          left: "50%",
          transform: "translateX(-50%)",
          maxWidth: "400px",
        };
      case "smart-signals":
        return {
          top: "30%",
          right: "420px",
          maxWidth: "350px",
        };
      case "order-panel":
        return {
          top: "50%",
          right: "420px",
          maxWidth: "350px",
        };
      case "positions":
        return {
          bottom: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          maxWidth: "400px",
        };
      default:
        return {
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          maxWidth: "500px",
        };
    }
  };

  return (
    <>
      {/* Dark Overlay */}
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" />

      {/* Tour Card */}
      <div
        className="fixed z-[101] animate-in fade-in-0 zoom-in-95 duration-200"
        style={getPositionStyles()}
      >
        <Card className="border-2 border-primary/50 shadow-2xl">
          <div className="p-6">
            {/* Header */}
            <div className="mb-4 flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkipClick}
                className="ml-2 h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Progress Indicator */}
            <div className="mb-4 flex gap-1">
              {steps.map((s, idx) => (
                <div
                  key={s.id}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    idx === currentStep
                      ? "bg-primary"
                      : idx < currentStep
                      ? "bg-primary/50"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <span className="text-xs text-muted-foreground">
                {currentStep + 1} of {steps.length}
              </span>

              {currentStep === steps.length - 1 ? (
                <Button size="sm" onClick={handleComplete} className="gap-2">
                  <Check className="h-4 w-4" />
                  Finish Tour
                </Button>
              ) : (
                <Button size="sm" onClick={handleNext} className="gap-2">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Skip Link */}
            {currentStep !== steps.length - 1 && (
              <div className="mt-3 text-center">
                <button
                  onClick={handleSkipClick}
                  className="text-xs text-muted-foreground hover:text-foreground transition"
                >
                  Skip tour (you can restart from settings)
                </button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Highlight Targets (optional visual aids) */}
      {step.id !== "welcome" && step.id !== "complete" && (
        <div className="fixed z-[99] pointer-events-none">
          {/* This would highlight the target element in a production implementation */}
        </div>
      )}
    </>
  );
}

