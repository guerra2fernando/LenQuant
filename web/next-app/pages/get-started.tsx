/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { ArrowRight, CheckCircle2, TrendingUp, Database, Sparkles, BarChart3 } from "lucide-react";

import { ErrorMessage } from "@/components/ErrorMessage";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { CryptoSelector, getCryptoLogo, getAllPredefinedSymbols } from "@/components/CryptoSelector";
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
  job_id: string;
  seeded_symbols: number;
  message: string;
  total_combinations: number;
  timestamp: string;
  // Legacy fields (for backwards compatibility)
  ingested?: Array<{ symbol: string; interval: string; rows: number }>;
  features?: Array<{ symbol: string; interval: string; rows: number }>;
  simulation_run_id?: string | null;
  report_path?: string | null;
  inventory?: Array<{
    symbol: string;
    interval: string;
    ohlcv_count: number;
    features_count: number;
    latest_candle: string | null;
  }>;
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
  const [lookbackDays, setLookbackDays] = useState<number>(30);

  // Fetch available symbols from the API
  const { data: overview } = useSWR<{
    available_symbols: string[];
    default_symbols: string[];
    default_intervals: string[];
    default_lookback_days: number;
  }>("/api/admin/overview", fetcher);

  // Use all predefined symbols from CryptoSelector, plus any from API
  const apiSymbols = overview?.available_symbols ?? [];
  const predefinedSymbols = getAllPredefinedSymbols();
  const availableSymbols = Array.from(new Set([...predefinedSymbols, ...apiSymbols])).sort();

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
      
      // Redirect to settings page to show live progress
      router.push(`/settings?section=data-ingestion&job_id=${response.job_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to set up data. Please try again.");
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

                {/* Cryptocurrency Selector */}
                <CryptoSelector
                  availableSymbols={availableSymbols}
                  selectedSymbols={selectedSymbols}
                  onSelectionChange={setSelectedSymbols}
                  placeholder="Select cryptocurrencies to track..."
                />

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
                            <Badge key={symbol} variant="secondary" className="flex items-center gap-1.5">
                              <img
                                src={getCryptoLogo(symbol)}
                                alt={symbol}
                                className="w-4 h-4 rounded-full"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  // Generate colored SVG placeholder
                                  const baseSymbol = symbol.split('/')[0].toUpperCase();
                                  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
                                  const colorIndex = baseSymbol.length % colors.length;
                                  const bgColor = colors[colorIndex];
                                  const svg = `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="8" fill="${bgColor}"/><text x="8" y="11" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="white" text-anchor="middle">${baseSymbol.slice(0, 4)}</text></svg>`;
                                  target.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
                                }}
                              />
                              {symbol}
                            </Badge>
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
                  message="Starting data ingestion..."
                  subMessage="Preparing to fetch market data. You'll be redirected to track progress in real-time."
                  variant="spinner"
                />
              )}
            </>
          )}

          {currentStep === "complete" && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <CheckCircle2 className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold">Redirecting...</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Taking you to the data ingestion dashboard to track progress.
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

