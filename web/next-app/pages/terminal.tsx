/* eslint-disable */
// @ts-nocheck
import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { TradingChart } from "@/components/TradingChart";
import { QuickStats } from "@/components/QuickStats";
import { StrategySelector } from "@/components/StrategySelector";
import { PositionTabs } from "@/components/PositionTabs";
import { QuickOrderPanel } from "@/components/QuickOrderPanel";
import { SmartNotifications } from "@/components/SmartNotifications";
import { StrategyAutomationPanel } from "@/components/StrategyAutomationPanel";
import { SymbolDisplay } from "@/components/CryptoSelector";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { fetcher } from "@/lib/api";
import { useMode } from "@/lib/mode-context";

const INTERVALS = [
  { value: "1m", label: "1 Minute" },
  { value: "5m", label: "5 Minutes" },
  { value: "15m", label: "15 Minutes" },
  { value: "1h", label: "1 Hour" },
  { value: "4h", label: "4 Hours" },
  { value: "1d", label: "1 Day" },
];

const TRADING_MODES = [
  { key: "paper", label: "Paper Trading", description: "Practice with virtual money" },
  { key: "testnet", label: "Testnet", description: "Test with testnet tokens" },
  { key: "live", label: "Live Trading", description: "Real money - use with caution" },
];

export default function TerminalPage() {
  const { isEasyMode } = useMode();
  const [selectedSymbol, setSelectedSymbol] = useState<string>("BTC/USDT");
  const [selectedInterval, setSelectedInterval] = useState<string>("1h");
  const [showPredictions, setShowPredictions] = useState(true);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [tradingMode, setTradingMode] = useState<string>("paper");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.8);

  console.log('[Terminal] Render - Symbol:', selectedSymbol, 'Interval:', selectedInterval, 'Mode:', tradingMode);

  // Fetch available symbols
  const { data: symbolsData, isLoading: loadingSymbols, error: symbolsError } = useSWR(
    "/api/market/symbols",
    fetcher
  );

  console.log('[Terminal] Symbols data:', symbolsData, 'Loading:', loadingSymbols, 'Error:', symbolsError);

  // Fetch inventory to get last update times
  const { data: inventoryData } = useSWR("/api/admin/overview", fetcher);

  // Fetch strategies for auto-selection
  const { data: strategiesData } = useSWR(
    "/api/strategies/genomes?status=active&limit=20",
    fetcher
  );

  const availableSymbols = useMemo(() => {
    const symbols = symbolsData?.symbols ?? [];
    console.log('[Terminal] Available symbols:', symbols);
    return symbols;
  }, [symbolsData]);

  // Get last update time for selected symbol/interval
  const lastUpdate = useMemo(() => {
    if (!inventoryData?.inventory) return null;
    const row = inventoryData.inventory.find(
      (r: any) => r.symbol === selectedSymbol && r.interval === selectedInterval
    );
    console.log('[Terminal] Last update for', selectedSymbol, selectedInterval, ':', row?.latest_candle);
    return row?.latest_candle;
  }, [inventoryData, selectedSymbol, selectedInterval]);

  // Set default symbol when data loads
  useEffect(() => {
    if (availableSymbols.length > 0 && !availableSymbols.includes(selectedSymbol)) {
      setSelectedSymbol(availableSymbols[0]);
    }
  }, [availableSymbols, selectedSymbol]);

  // Auto-select best strategy on load
  useEffect(() => {
    if (strategiesData?.genomes && selectedStrategies.length === 0) {
      // Find and select best strategy
      const best = strategiesData.genomes.reduce((b: any, c: any) => {
        return (c.fitness?.composite ?? 0) > (b.fitness?.composite ?? 0) ? c : b;
      }, strategiesData.genomes[0]);
      if (best) {
        setSelectedStrategies([best.strategy_id]);
      }
    }
  }, [strategiesData, selectedStrategies]);

  if (loadingSymbols) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Loading terminal...</p>
      </div>
    );
  }

  if (availableSymbols.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="No Market Data Available"
        description="Please ingest OHLCV data first. Go to Get Started page to bootstrap historical data."
      />
    );
  }

  return (
    <div className="space-y-4">
        {/* Header with controls */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Trading Terminal</h1>
            <p className="text-sm text-muted-foreground">
              {isEasyMode
                ? "Real-time charts with AI predictions and quick trading controls"
                : "Advanced trading interface with live data and ML forecasts"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Trading Mode Badge */}
            <Badge 
              variant={tradingMode === "live" ? "destructive" : "outline"}
              className="gap-2"
            >
              {tradingMode === "live" && <span className="h-2 w-2 rounded-full bg-red-500" />}
              {TRADING_MODES.find(m => m.key === tradingMode)?.label ?? tradingMode.toUpperCase()}
            </Badge>

            {/* Last Update Badge */}
            {lastUpdate && (
              <Badge variant="outline" className="gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                Updated: {new Date(lastUpdate).toLocaleTimeString()}
              </Badge>
            )}
          </div>
        </div>

        {/* Trading Mode Selector Card */}
        <Card className="p-4">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Trading Mode</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TRADING_MODES.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setTradingMode(mode.key)}
                  className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition hover:border-primary ${
                    tradingMode === mode.key
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background"
                  }`}
                >
                  <span className="font-medium">{mode.label}</span>
                  <span className="text-xs text-muted-foreground">{mode.description}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Controls Row */}
        <Card className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 flex-1">
              {/* Symbol Selector */}
              <div className="flex-1">
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Cryptocurrency
                </label>
                <div className="flex items-center gap-2">
                  <SymbolDisplay symbol={selectedSymbol} logoSize={24} showText={false} />
                  <select
                    className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                  >
                    {availableSymbols.map((symbol: string) => (
                      <option key={symbol} value={symbol}>
                        {symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Interval Selector */}
              <div className="flex-1">
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Timeframe
                </label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={selectedInterval}
                  onChange={(e) => setSelectedInterval(e.target.value)}
                >
                  {INTERVALS.map((interval) => (
                    <option key={interval.value} value={interval.value}>
                      {interval.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prediction Toggle */}
            <div className="flex items-center gap-2 self-end">
              <input
                type="checkbox"
                id="show-predictions"
                checked={showPredictions}
                onChange={(e) => setShowPredictions(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <label htmlFor="show-predictions" className="text-sm font-medium cursor-pointer">
                Show AI Predictions
              </label>
            </div>
          </div>
        </Card>

        {/* Main Content Area - Different layouts for Easy/Advanced */}
        <div className="grid gap-4 lg:grid-cols-[1fr,400px]">
          {/* Left: Chart + Quick Stats in Easy Mode */}
          <div className="space-y-4">
            {isEasyMode && <QuickStats symbol={selectedSymbol} />}
            
            <TradingChart
              symbol={selectedSymbol}
              interval={selectedInterval}
              showPredictions={showPredictions}
              mode={tradingMode}
            />
          </div>

          {/* Right: Control Panel - Simplified for Easy Mode */}
          <div className="space-y-4">
            {isEasyMode ? (
              <>
                {/* Easy Mode: Simplified panels only */}
                <SmartNotifications
                  symbol={selectedSymbol}
                  interval={selectedInterval}
                  mode={tradingMode}
                  confidenceThreshold={0.85} 
                />
                <QuickOrderPanel 
                  symbol={selectedSymbol} 
                  mode={tradingMode} 
                />
                <PositionTabs 
                  selectedSymbol={selectedSymbol} 
                  mode={tradingMode} 
                />
              </>
            ) : (
              <>
                {/* Advanced Mode: All panels */}
                <SmartNotifications
                  symbol={selectedSymbol}
                  interval={selectedInterval}
                  mode={tradingMode}
                  confidenceThreshold={confidenceThreshold}
                />
                <StrategyAutomationPanel 
                  selectedStrategies={selectedStrategies} 
                />
                <QuickOrderPanel 
                  symbol={selectedSymbol} 
                  mode={tradingMode} 
                />
                <PositionTabs 
                  selectedSymbol={selectedSymbol} 
                  mode={tradingMode} 
                />
                <StrategySelector
                  selectedStrategies={selectedStrategies}
                  onSelect={setSelectedStrategies}
                />
              </>
            )}
          </div>
        </div>
      </div>
  );
}

export async function getStaticProps() {
  return {
    props: {
      title: "Trading Terminal - LenQuant",
      description:
        "Real-time cryptocurrency trading terminal with live charts, AI predictions, and instant trade execution.",
    },
  };
}

