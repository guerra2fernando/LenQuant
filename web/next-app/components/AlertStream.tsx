/* eslint-disable */
// @ts-nocheck
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { EmptyState } from "@/components/EmptyState";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMode } from "@/lib/mode-context";
import { fetcher } from "@/lib/api";

type Alert = {
  id?: string;
  title: string;
  message: string;
  severity?: "info" | "success" | "warning" | "error" | "critical";
  timestamp?: string;
  created_at?: string;
};

type AlertStreamProps = {
  alerts?: Alert[]; // Optional prop for backward compatibility
  notificationTypes?: string[]; // Filter by notification types (e.g., ["risk_alert", "trade_execution"])
  limit?: number; // Limit number of alerts to fetch
};

const BADGE_COLORS: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-500",
  warning: "bg-amber-500/15 text-amber-600",
  error: "bg-red-500/15 text-red-500",
  critical: "bg-red-600/15 text-red-600",
  info: "bg-sky-500/15 text-sky-500",
};

export function AlertStream({ alerts: propAlerts, notificationTypes, limit = 20 }: AlertStreamProps) {
  const { isEasyMode } = useMode();
  const { data: session } = useSession();
  const [alerts, setAlerts] = useState<Alert[]>(propAlerts || []);

  // Fetch alerts from API if not provided via props
  useEffect(() => {
    if (propAlerts) {
      // Use provided alerts (backward compatibility)
      setAlerts(propAlerts);
      return;
    }

    if (!session?.accessToken) {
      return;
    }

    const fetchAlerts = async () => {
      try {
        // Build query params
        const params = new URLSearchParams();
        params.append("limit", limit.toString());
        
        // Filter by notification types if provided
        if (notificationTypes && notificationTypes.length > 0) {
          // Fetch all notifications and filter client-side
          // (API doesn't support type filtering yet)
        }

        const data = await fetcher<Alert[]>(`/api/notifications?${params.toString()}`);
        
        // Filter by types if specified
        let filteredData = data;
        if (notificationTypes && notificationTypes.length > 0) {
          filteredData = data.filter((alert: any) => 
            notificationTypes.includes(alert.type)
          );
        }

        // Transform notifications to alerts format
        const transformedAlerts: Alert[] = filteredData.map((notification: any) => ({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          severity: notification.severity || "info",
          timestamp: notification.created_at || notification.timestamp,
        }));

        setAlerts(transformedAlerts);
      } catch (error) {
        console.error("Failed to fetch alerts:", error);
        // Keep empty array on error
        setAlerts([]);
      }
    };

    fetchAlerts();

    // Optionally set up polling or WebSocket for real-time updates
    // For now, just fetch once on mount
  }, [session?.accessToken, propAlerts, notificationTypes, limit]);

  return (
    <Card className="flex h-full max-h-[24rem] flex-col overflow-hidden">
      <CardHeader>
        <CardTitle>
          Alert Stream
          <TooltipExplainer 
            term="Alert Stream" 
            explanation="Real-time notifications about important trading events - execution alerts, risk breaches, order fills, strategy promotions, or system errors. Color-coded by severity: green (success), yellow (warning), red (error), blue (info). Scroll through to see recent alerts. These help you stay informed about what's happening without constantly checking individual dashboards."
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 overflow-y-auto pr-1">
        {alerts.length === 0 ? (
          <EmptyState
            variant="default"
            title={isEasyMode ? "No Alerts" : "No Alerts"}
            description={
              isEasyMode
                ? "System alerts and notifications will appear here when there are important updates about your trading activity."
                : "Execution alerts will appear here."
            }
          />
        ) : (
          alerts.map((alert, index) => {
            const severity = alert.severity ?? "info";
            const key = alert.id || `${alert.title}-${index}`;
            return (
              <div
                key={key}
                className="rounded-lg border border-border/60 bg-background/80 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{alert.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${BADGE_COLORS[severity] ?? BADGE_COLORS.info}`}>
                    {severity.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                {(alert.timestamp || alert.created_at) ? (
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {new Date(alert.timestamp || alert.created_at).toLocaleTimeString()}
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
