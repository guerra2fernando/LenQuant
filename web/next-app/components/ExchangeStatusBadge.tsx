/* eslint-disable */
// @ts-nocheck
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import { fetcher } from "@/lib/api";
import { useRouter } from "next/router";

export function ExchangeStatusBadge() {
  const router = useRouter();
  const { data, isLoading } = useSWR("/api/exchange/status", fetcher, {
    refreshInterval: 60000, // Refresh every 60 seconds
  });

  const handleClick = () => {
    router.push("/settings?tab=trading");
  };

  if (isLoading) {
    return (
      <button
        onClick={handleClick}
        className="relative p-2 cursor-pointer hover:opacity-80 transition-opacity"
        title="Loading connection status..."
        aria-label="Loading connection status"
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </button>
    );
  }

  const isConnected = data?.connected === true;
  const health = data?.health || "unknown";

  // Determine the status and color
  let statusColor = "bg-red-500";
  let tooltipMessage = "System not connected with exchange";
  
  if (isConnected) {
    if (health === "healthy") {
      statusColor = "bg-green-500";
      tooltipMessage = "System is connected with exchange";
    } else if (health === "degraded") {
      statusColor = "bg-yellow-500";
      tooltipMessage = "Exchange connection degraded";
    } else {
      statusColor = "bg-red-500";
      tooltipMessage = "Exchange connection error";
    }
  }

  return (
    <button
      onClick={handleClick}
      className="relative p-2 cursor-pointer hover:opacity-80 transition-opacity"
      title={tooltipMessage}
      aria-label={tooltipMessage}
    >
      <div className="relative flex items-center justify-center">
        {/* Pulsing outer glow */}
        <span className={`absolute inline-flex h-3 w-3 rounded-full ${statusColor} opacity-75 animate-ping`} />
        {/* Solid inner circle */}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusColor}`} />
      </div>
    </button>
  );
}

