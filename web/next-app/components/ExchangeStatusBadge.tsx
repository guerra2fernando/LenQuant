/* eslint-disable */
// @ts-nocheck
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { fetcher } from "@/lib/api";
import { useRouter } from "next/router";

export function ExchangeStatusBadge() {
  const router = useRouter();
  const { data, isLoading } = useSWR("/api/exchange/status", fetcher, {
    refreshInterval: 60000, // Refresh every 60 seconds
  });

  if (isLoading) {
    return (
      <Badge variant="outline" className="cursor-pointer">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        <span className="text-xs">Exchange</span>
      </Badge>
    );
  }

  const isConnected = data?.connected === true;
  const health = data?.health || "unknown";

  const handleClick = () => {
    router.push("/settings?tab=trading");
  };

  if (!isConnected) {
    return (
      <Badge 
        variant="outline" 
        className="cursor-pointer hover:bg-muted"
        onClick={handleClick}
      >
        <XCircle className="mr-1 h-3 w-3 text-muted-foreground" />
        <span className="text-xs">Not Connected</span>
      </Badge>
    );
  }

  if (health === "healthy") {
    return (
      <Badge 
        className="cursor-pointer bg-green-600 hover:bg-green-700"
        onClick={handleClick}
      >
        <CheckCircle2 className="mr-1 h-3 w-3" />
        <span className="text-xs">Exchange Connected</span>
      </Badge>
    );
  }

  if (health === "degraded") {
    return (
      <Badge 
        className="cursor-pointer bg-yellow-600 hover:bg-yellow-700"
        onClick={handleClick}
      >
        <AlertCircle className="mr-1 h-3 w-3" />
        <span className="text-xs">Exchange Degraded</span>
      </Badge>
    );
  }

  return (
    <Badge 
      variant="destructive"
      className="cursor-pointer"
      onClick={handleClick}
    >
      <XCircle className="mr-1 h-3 w-3" />
      <span className="text-xs">Exchange Error</span>
    </Badge>
  );
}

