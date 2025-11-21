/* eslint-disable */
// @ts-nocheck
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PositionsTable } from "@/components/PositionsTable";
import { PaperWalletControls } from "@/components/PaperWalletControls";
import { ParentWalletCard } from "@/components/ParentWalletCard";
import { EquityCurveChart } from "@/components/EquityCurveChart";
import { PerformanceMetrics } from "@/components/PerformanceMetrics";
import { AuditSection } from "@/components/AuditSection";
import { DataFreshnessBadge } from "@/components/DataFreshnessBadge";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { EmptyState } from "@/components/EmptyState";
import { SymbolDisplay } from "@/components/CryptoSelector";
import { useWebSocket } from "@/lib/hooks";
import { fetcher } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/utils";
import { useMode } from "@/lib/mode-context";
import { TrendingUp, TrendingDown, Wallet, PieChart, Activity, DollarSign, Terminal, AlertTriangle, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import { PortfolioActionsCard } from "@/components/PortfolioActionsCard";
import { PositionInsightsCard } from "@/components/PositionInsightsCard";

export default function PortfolioPage() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState("paper");
  const { isEasyMode } = useMode();
  
  // Fetch portfolio data with SWR (using cached endpoint for better performance)
  const { data: portfolio, mutate, isValidating, error } = useSWR(
    "/api/trading/portfolio/summary/cached",
    fetcher,
    { 
      refreshInterval: 10_000, // 10 second polling (matches cache refresh rate)
      revalidateOnFocus: true, // Refresh when tab becomes active
    }
  );
  
  // Fetch performance metrics for selected mode
  const { data: performance } = useSWR(
    selectedMode ? `/api/trading/portfolio/performance/${selectedMode}` : null,
    fetcher,
    { refreshInterval: 30_000 }
  );

  // Fetch exchange connection status
  const { data: exchangeStatus } = useSWR("/api/exchange/status", fetcher, {
    refreshInterval: 30_000,
  });
  
  // Real-time updates via WebSocket
  const { data: wsData, isConnected } = useWebSocket("/ws/trading");
  
  // Merge WebSocket data with portfolio
  const livePortfolio = useMemo(() => {
    if (wsData?.portfolio_summary && portfolio) {
      return {
        ...portfolio,
        total_equity_usd: wsData.portfolio_summary.total_equity,
        total_pnl_usd: wsData.portfolio_summary.total_pnl,
      };
    }
    return portfolio;
  }, [wsData, portfolio]);
  
  // Enhanced error handling
  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="text-red-500 text-lg font-semibold">Failed to load portfolio</div>
          <p className="text-muted-foreground">
            {error.message || "An unexpected error occurred"}
          </p>
          <Button onClick={() => mutate()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!livePortfolio) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Loading portfolio...</p>
        </div>
      </div>
    );
  }
  
  const modeData = livePortfolio.modes[selectedMode] || {};
  const totalEquityChange = livePortfolio.total_pnl_usd || 0;
  const isPositive = totalEquityChange >= 0;
  
  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <PieChart className="h-8 w-8" />
            Portfolio
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEasyMode 
              ? "View your complete portfolio across all trading modes" 
              : "Unified view of positions, equity, and performance with real-time valuations"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isConnected && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </div>
          )}
          <DataFreshnessBadge lastUpdated={livePortfolio.timestamp} />
        </div>
      </div>
      
      {/* Total Portfolio Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${formatNumber(livePortfolio.total_equity_usd, 2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all modes
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              isPositive ? "text-green-500" : "text-red-500"
            }`}>
              {isPositive ? "+" : ""}${formatNumber(livePortfolio.total_pnl_usd, 2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Realized + Unrealized
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Holdings</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(livePortfolio.by_symbol || {}).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Unique assets
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Market Regime</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">
              {livePortfolio.regime?.current || "UNDEFINED"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Multiplier: {livePortfolio.regime?.multiplier || 1.0}x
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Mode Tabs */}
      <Tabs value={selectedMode} onValueChange={setSelectedMode}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="paper">Paper Trading</TabsTrigger>
          <TabsTrigger value="testnet">Testnet</TabsTrigger>
          <TabsTrigger value="live">Live Trading</TabsTrigger>
        </TabsList>
        
        {["paper", "testnet", "live"].map((mode) => (
          <TabsContent key={mode} value={mode} className="space-y-4">
            {/* Phase 1: Portfolio Actions Card */}
            <PortfolioActionsCard 
              mode={mode}
              balance={modeData.wallet_balance || 0}
              hasPositions={(modeData.positions || []).length > 0}
              isExchangeConnected={exchangeStatus?.connected === true}
            />

            {/* Phase 1: Position Insights */}
            <PositionInsightsCard positions={modeData.positions || []} />

            {/* Mode Summary Cards */}
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1">
                    Wallet
                    <TooltipExplainer
                      term="Wallet"
                      explanation="Available cash balance for trading"
                      size="xs"
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    ${formatNumber(modeData.wallet_balance || 0, 2)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1">
                    Positions
                    <TooltipExplainer
                      term="Positions"
                      explanation="Current market value of all open positions"
                      size="xs"
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    ${formatNumber(modeData.positions_value || 0, 2)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1">
                    Total Equity
                    <TooltipExplainer
                      term="Equity"
                      explanation="Wallet balance + Positions value"
                      size="xs"
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    ${formatNumber(modeData.equity || 0, 2)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Realized P&L</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-xl font-bold ${
                    (modeData.realized_pnl || 0) >= 0 ? "text-green-500" : "text-red-500"
                  }`}>
                    {(modeData.realized_pnl || 0) >= 0 ? "+" : ""}${formatNumber(modeData.realized_pnl || 0, 2)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Unrealized P&L</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-xl font-bold ${
                    (modeData.unrealized_pnl || 0) >= 0 ? "text-green-500" : "text-red-500"
                  }`}>
                    {(modeData.unrealized_pnl || 0) >= 0 ? "+" : ""}${formatNumber(modeData.unrealized_pnl || 0, 2)}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Paper Trading Controls */}
            {(selectedMode === "paper" || selectedMode === "testnet") && (
              <PaperWalletControls
                currentBalance={modeData.wallet_balance || 0}
                onBalanceChanged={() => mutate()}
                mode={selectedMode}
              />
            )}
            
            {/* Parent Wallet Hierarchy (Phase 3) */}
            {!isEasyMode && modeData.parent_wallet && (
              <ParentWalletCard data={modeData.parent_wallet} />
            )}
            
            {/* Positions Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Open Positions</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/analytics?tab=strategies')}
                      className="gap-1"
                    >
                      <BarChart3 className="h-3 w-3" />
                      View Strategies
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <PositionsTable 
                  positions={modeData.positions || []} 
                  mode={mode} 
                />
              </CardContent>
            </Card>
            
            {/* Equity Curve Chart (Phase 5) */}
            <EquityCurveChart mode={selectedMode} limit={100} />
            
            {/* Performance Metrics (Phase 5) */}
            {performance && (
              <PerformanceMetrics mode={selectedMode} data={performance} />
            )}
          </TabsContent>
        ))}
      </Tabs>
      
      {/* Holdings by Symbol */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Holdings by Asset
            <TooltipExplainer
              term="Holdings by Asset"
              explanation="Aggregated view of all your cryptocurrency holdings across all trading modes. Shows total quantity, current value, and unrealized profit/loss for each asset."
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(livePortfolio.by_symbol || {}).length === 0 ? (
            <EmptyState
              variant="trading"
              title="No Open Positions"
              description="You don't have any open positions across your trading modes. Place a buy order to start building your portfolio."
            />
          ) : (
            <div className="space-y-2">
              {Object.entries(livePortfolio.by_symbol || {}).map(([symbol, data]: [string, any]) => (
                <div key={symbol} className="flex justify-between items-center p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4 flex-1">
                    <SymbolDisplay symbol={symbol} />
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {formatNumber(data.quantity, 6)} units @ ${formatNumber(data.current_price, 2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Modes: {data.modes.join(", ").toUpperCase()}
                      </div>
                      {/* Contextual Links */}
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/terminal?symbol=${symbol}`)}
                          className="h-6 text-xs gap-1 px-2"
                        >
                          <Terminal className="h-3 w-3" />
                          Terminal
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/risk?symbol=${symbol}`)}
                          className="h-6 text-xs gap-1 px-2"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Risk
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/analytics?tab=strategies&symbol=${symbol}`)}
                          className="h-6 text-xs gap-1 px-2"
                        >
                          <BarChart3 className="h-3 w-3" />
                          Strategies
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${formatNumber(data.value_usd, 2)}</div>
                    <div className={`text-sm ${
                      data.unrealized_pnl >= 0 ? "text-green-500" : "text-red-500"
                    }`}>
                      {data.unrealized_pnl >= 0 ? "+" : ""}
                      ${formatNumber(data.unrealized_pnl, 2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Audit & Reconciliation Section (Phase 5) - Hidden in Easy Mode */}
      {!isEasyMode && (
        <AuditSection />
      )}
    </div>
  );
}

export async function getStaticProps() {
  return {
    props: {
      title: "Portfolio - LenQuant",
      description: "View your complete portfolio across paper, testnet, and live trading modes with real-time valuations.",
    },
  };
}

