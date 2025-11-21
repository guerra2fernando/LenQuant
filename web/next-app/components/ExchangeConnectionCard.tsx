/* eslint-disable */
// @ts-nocheck
import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { ExchangeConnectionModal } from "./ExchangeConnectionModal";
import { TooltipExplainer } from "./TooltipExplainer";
import { CheckCircle2, AlertCircle, XCircle, RefreshCw, Plug, Activity } from "lucide-react";
import { fetcher, postJson } from "@/lib/api";
import { toast } from "sonner";

export function ExchangeConnectionCard() {
  const [showModal, setShowModal] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { data, mutate } = useSWR("/api/exchange/status", fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  // Extract Binance status from new API structure
  const exchangeName = "binance";
  const binanceStatus = data?.exchanges?.[exchangeName] || {};
  const isConnected = binanceStatus.connected === true;
  const lastChecked = binanceStatus.last_tested;
  const permissions = binanceStatus.permissions || [];
  const error = binanceStatus.error_message;
  
  // Determine health from status
  const statusToHealth: Record<string, string> = {
    "connected": "healthy",
    "error": "unhealthy",
    "disconnected": "unknown",
    "not_configured": "unknown",
  };
  const health = statusToHealth[binanceStatus.status] || "unknown";

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const response = await postJson("/api/exchange/test", {
        exchange: exchangeName,
      });
      if (response.test_passed) {
        toast.success("Connection test successful!");
        mutate();
      } else {
        toast.error(response.error || "Connection test failed");
      }
    } catch (err) {
      toast.error("Failed to test connection");
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect your exchange? Live trading will be disabled.")) {
      return;
    }

    try {
      await postJson("/api/exchange/disconnect", {
        exchange: exchangeName,
      });
      toast.success("Exchange disconnected");
      mutate();
    } catch (err) {
      toast.error("Failed to disconnect exchange");
    }
  };

  const getHealthIcon = () => {
    if (!isConnected) return <XCircle className="h-5 w-5 text-muted-foreground" />;
    if (health === "healthy") return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    if (health === "degraded") return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    return <XCircle className="h-5 w-5 text-red-600" />;
  };

  const getHealthBadge = () => {
    if (!isConnected) return <Badge variant="secondary">Not Connected</Badge>;
    if (health === "healthy") return <Badge className="bg-green-600">Connected</Badge>;
    if (health === "degraded") return <Badge className="bg-yellow-600">Degraded</Badge>;
    return <Badge variant="destructive">Unhealthy</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5" />
                Exchange Connection
                <TooltipExplainer
                  term="Exchange Connection"
                  explanation="Connect your exchange account (like Binance) to enable live trading. Your API keys are encrypted and never shared. You can test the connection anytime to verify it's working properly. Without a connection, you can only use paper trading mode."
                />
              </CardTitle>
              <CardDescription className="mt-1">
                Manage your live trading connection to {exchangeName}
              </CardDescription>
            </div>
            {getHealthIcon()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Connection Status</p>
              <div className="flex items-center gap-2">
                {getHealthBadge()}
                {lastChecked && (
                  <span className="text-xs text-muted-foreground">
                    Last checked: {new Date(lastChecked).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
            <Activity className="h-8 w-8 text-muted-foreground" />
          </div>

          {/* Permissions */}
          {isConnected && permissions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">API Permissions</p>
              <div className="flex flex-wrap gap-2">
                {permissions.map((permission) => (
                  <Badge key={permission} variant="outline">
                    {permission}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <div className="ml-2">
                <p className="text-sm font-medium">Connection Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {!isConnected ? (
              <Button onClick={() => setShowModal(true)} className="flex-1">
                <Plug className="mr-2 h-4 w-4" />
                Connect Exchange
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex-1"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  className="flex-1"
                >
                  Disconnect
                </Button>
              </>
            )}
          </div>

          {/* Security Note */}
          <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Your API keys are encrypted at rest and only used for executing trades on your behalf.
                We recommend using IP whitelisting on your exchange for additional security.
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      <ExchangeConnectionModal
        open={showModal}
        onOpenChange={setShowModal}
        onConnectionSuccess={mutate}
      />
    </>
  );
}

