/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { ArrowRight, CheckCircle2, TrendingUp, Database, Sparkles, BarChart3, X, Plus } from "lucide-react";

import { ErrorMessage } from "@/components/ErrorMessage";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useMode } from "@/lib/mode-context";
import { fetcher } from "@/lib/api";

type Step = "intro" | "data" | "setup" | "complete";

type BootstrapResponse = {
  seeded_symbols: number;
  ingested: Array<{ symbol: string; interval: string; rows: number }>;
  features: Array<{ symbol: string; interval: string; rows: number }>;
  simulation_run_id: string | null;
  report_path: string | null;
  inventory: Array<{
    symbol: string;
    interval: string;
    ohlcv_count: number;
    features_count: number;
    latest_candle: string | null;
  }>;
  timestamp: string;
};

const DEFAULT_SYMBOLS = ["BTC/USD", "ETH/USD"];
const DEFAULT_INTERVALS = ["1m", "5m"];
const AVAILABLE_INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"];

export default function GetStarted(): JSX.Element {
  const router = useRouter();
  const { isEasyMode } = useMode();
  const [currentStep, setCurrentStep] = useState<Step>("intro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapResult, setBootstrapResult] = useState<BootstrapResponse | null>(null);

  // Symbol and interval management
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [selectedIntervals, setSelectedIntervals] = useState<string[]>(DEFAULT_INTERVALS);
  const [newSymbol, setNewSymbol] = useState<string>("");
  const [lookbackDays, setLookbackDays] = useState<number>(30);

  // Fetch available symbols from the API
  const { data: overview } = useSWR<{
    available_symbols: string[];
    default_symbols: string[];
    default_intervals: string[];
    default_lookback_days: number;
  }>("/api/admin/overview", fetcher);

  const availableSymbols = overview?.available_symbols ?? [];

  // Available for both Easy and Advanced modes
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const handleStartSetup = () => {
    setCurrentStep("data");
  };

  const handleAddSymbol = () => {
    const trimmed = newSymbol.trim().toUpperCase();
    if (!trimmed) return;
    
    // Add /USD suffix if not present
    const formatted = trimmed.includes("/") ? trimmed : `${trimmed}/USD`;
    
    if (!selectedSymbols.includes(formatted)) {
      setSelectedSymbols([...selectedSymbols, formatted]);
    }
    setNewSymbol("");
  };

  const handleRemoveSymbol = (symbol: string) => {
    setSelectedSymbols(selectedSymbols.filter(s => s !== symbol));
  };

  const handleToggleInterval = (interval: string) => {
    if (selectedIntervals.includes(interval)) {
      setSelectedIntervals(selectedIntervals.filter(i => i !== interval));
    } else {
      setSelectedIntervals([...selectedIntervals, interval]);
    }
  };

  const handleRunBootstrap = async () => {
    if (selectedSymbols.length === 0 || selectedIntervals.length === 0) {
      setError("Please select at least one symbol and one timeframe.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetcher<BootstrapResponse>("/api/admin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: selectedSymbols,
          intervals: selectedIntervals,
          lookback_days: lookbackDays,
        }),
      });
      setBootstrapResult(response);
      setCurrentStep("complete");
    } catch (err: any) {
      setError(err.message || "Failed to set up data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    router.push("/");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Welcome to LenQuant</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {isEasyMode 
            ? "Let's get you set up in just a few steps. We'll guide you through everything."
            : "Set up your market data pipeline to start trading and analyzing crypto markets."}
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4">
        {(["intro", "data", "setup", "complete"] as Step[]).map((step, index) => {
          const stepNames = { intro: 1, data: 2, setup: 3, complete: 4 };
          const currentIndex = stepNames[currentStep];
          const stepIndex = stepNames[step];
          const isActive = stepIndex === currentIndex;
          const isCompleted = stepIndex < currentIndex;

          return (
            <div key={step} className="flex items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  isCompleted
                    ? "border-primary bg-primary text-primary-foreground"
                    : isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted bg-muted/30 text-muted-foreground"
                }`}
              >
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : stepIndex}
              </div>
              {index < 3 && (
                <div
                  className={`h-1 w-16 ${
                    isCompleted ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {currentStep === "intro" && "What is LenQuant?"}
            {currentStep === "data" && "Understanding Your Data"}
            {currentStep === "setup" && "Setting Up Your Data"}
            {currentStep === "complete" && "You're All Set!"}
          </CardTitle>
          <CardDescription>
            {currentStep === "intro" && "Learn what this platform can do for you"}
            {currentStep === "data" && "We'll fetch historical market data to get started"}
            {currentStep === "setup" && "Running the initial setup process"}
            {currentStep === "complete" && "Your trading platform is ready to use"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep === "intro" && (
            <>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Automated Trading</h3>
                    <p className="text-sm text-muted-foreground">
                      {isEasyMode 
                        ? "The platform uses AI to analyze markets and make trading recommendations. You stay in control and can review everything before executing trades."
                        : "Execute sophisticated trading strategies with full control over models, data pipelines, and execution parameters."}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Market Analysis</h3>
                    <p className="text-sm text-muted-foreground">
                      {isEasyMode
                        ? "Get price forecasts, strategy performance insights, and risk assessments to help you make informed decisions."
                        : "Access advanced analytics, model training pipelines, evolutionary strategy optimization, and comprehensive backtesting."}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">AI Assistant</h3>
                    <p className="text-sm text-muted-foreground">
                      {isEasyMode
                        ? "Ask questions, get recommendations, and understand what the system is thinking. The assistant explains everything in plain language."
                        : "Query system metrics, analyze performance data, and get technical insights with full access to all platform capabilities."}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleStartSetup} size="lg">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {currentStep === "data" && (
            <>
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Configure which cryptocurrencies and timeframes you want to track. You can always change these later in Settings.
                </p>

                {/* Selected Cryptocurrencies */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Cryptocurrencies</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedSymbols.map(symbol => (
                      <Badge key={symbol} variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5">
                        {symbol}
                        <button
                          onClick={() => handleRemoveSymbol(symbol)}
                          className="ml-1 hover:text-destructive"
                          type="button"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>

                  {/* Add new symbol */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter symbol (e.g., BTC, ETH, SOL)"
                      value={newSymbol}
                      onChange={(e) => setNewSymbol(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSymbol();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button onClick={handleAddSymbol} variant="outline" size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {availableSymbols.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Available: {availableSymbols.slice(0, 10).join(", ")}
                      {availableSymbols.length > 10 && ` and ${availableSymbols.length - 10} more`}
                    </div>
                  )}
                </div>

                {/* Timeframes */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Timeframes</Label>
                  <div className="flex flex-wrap gap-3">
                    {AVAILABLE_INTERVALS.map(interval => (
                      <label key={interval} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectedIntervals.includes(interval)}
                          onCheckedChange={() => handleToggleInterval(interval)}
                        />
                        <span className="text-sm">{interval}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Lookback Period */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Historical Data Period</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="1"
                      max="365"
                      value={lookbackDays}
                      onChange={(e) => setLookbackDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 30)))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">days of historical data</span>
                  </div>
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-medium text-primary">What happens next:</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Fetch historical price data for your selected cryptocurrencies</li>
                    <li>• Calculate technical indicators and market features</li>
                    <li>• Run a {isEasyMode ? "test" : "baseline simulation"} to validate the setup</li>
                    <li>• Generate your first performance report</li>
                  </ul>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep("intro")}>
                  Back
                </Button>
                <Button 
                  onClick={() => setCurrentStep("setup")} 
                  size="lg"
                  disabled={selectedSymbols.length === 0 || selectedIntervals.length === 0}
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {currentStep === "setup" && (
            <>
              {!bootstrapResult && !loading && (
                <>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Ready to set up your data? This will take a few minutes. Review your configuration below:
                    </p>
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-2">Cryptocurrencies:</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedSymbols.map(symbol => (
                            <Badge key={symbol} variant="secondary">{symbol}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">Timeframes:</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedIntervals.map(interval => (
                            <Badge key={interval} variant="secondary">{interval}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Historical Period:</p>
                        <Badge variant="secondary">{lookbackDays} days</Badge>
                      </div>
                    </div>
                    {error && (
                      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                        {error}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep("data")}>
                      Back
                    </Button>
                    <Button onClick={handleRunBootstrap} size="lg" disabled={loading}>
                      {loading ? "Setting up..." : "Start Setup"}
                    </Button>
                  </div>
                </>
              )}

              {loading && (
                <ProgressIndicator
                  message="Setting up your platform..."
                  subMessage="Fetching market data and calculating features. This may take a few minutes."
                  variant="spinner"
                />
              )}

              {error && (
                <ErrorMessage
                  title="Setup failed"
                  message={error}
                  onRetry={() => {
                    setError(null);
                    setCurrentStep("data");
                  }}
                  guidance="The setup process encountered an error. This might be due to network issues or server problems. Try again, or check your connection."
                />
              )}
            </>
          )}

          {currentStep === "complete" && bootstrapResult && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <CheckCircle2 className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold">Setup Complete!</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your platform is ready. Here's what we set up:
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm font-medium">Price Data</p>
                    <p className="mt-1 text-2xl font-bold">{bootstrapResult.ingested.length} pairs</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm font-medium">Features Calculated</p>
                    <p className="mt-1 text-2xl font-bold">{bootstrapResult.features.length} sets</p>
                  </div>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-medium text-primary">What's Next?</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Visit the Dashboard to see your {isEasyMode ? "portfolio overview" : "system status and data coverage"}</li>
                    <li>• Check Insights to see market forecasts and {isEasyMode ? "recommendations" : "analytics"}</li>
                    <li>• Use the Assistant to ask questions about trading</li>
                    <li>• Go to Trading when you're ready to {isEasyMode ? "place orders" : "execute trades"}</li>
                    {!isEasyMode && <li>• Add more coins in Settings → General → Symbol Management</li>}
                  </ul>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleComplete} size="lg">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

