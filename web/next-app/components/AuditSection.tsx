/* eslint-disable */
// @ts-nocheck
import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetcher, postJson } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Shield, Download, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";

export function AuditSection() {
  const [loading, setLoading] = useState(false);
  const { pushToast } = useToast();
  
  const { data: reconciliation, mutate } = useSWR(
    "/api/trading/reconciliation",
    fetcher,
    { refreshInterval: 60_000 }
  );

  const handleExport = async () => {
    setLoading(true);
    try {
      const report = await fetcher("/api/trading/reconciliation");
      
      // Download as JSON
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reconciliation-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      pushToast({
        title: "Report exported",
        description: "Reconciliation report downloaded successfully",
        variant: "success",
      });
    } catch (error) {
      pushToast({
        title: "Export failed",
        description: "Failed to export reconciliation report",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunReconciliation = async () => {
    setLoading(true);
    try {
      await postJson("/api/trading/reconciliation/run", {});
      await mutate();
      
      pushToast({
        title: "Reconciliation triggered",
        description: "Report will be generated shortly",
        variant: "success",
      });
    } catch (error) {
      pushToast({
        title: "Reconciliation failed",
        description: "Failed to trigger reconciliation",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!reconciliation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Audit & Reconciliation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Audit & Reconciliation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {reconciliation.modes?.map((modeData: any) => (
            <div key={modeData.mode} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase">{modeData.mode}</span>
                <Badge 
                  variant={modeData.pending_fills > 0 ? "destructive" : "default"}
                  className="flex items-center gap-1"
                >
                  {modeData.pending_fills === 0 ? (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      Synced
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3" />
                      {modeData.pending_fills} pending
                    </>
                  )}
                </Badge>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Balance:</span>
                  <span className="font-medium">${modeData.wallet_balance?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Positions:</span>
                  <span className="font-medium">{modeData.open_positions || 0}</span>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="text-xs font-mono text-muted-foreground break-all">
                  Hash: {modeData.last_hash?.substring(0, 16)}...
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button 
            onClick={handleRunReconciliation} 
            disabled={loading} 
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Run Reconciliation
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
        
        {/* Last Generated */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Last generated: {new Date(reconciliation.generated_at).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

