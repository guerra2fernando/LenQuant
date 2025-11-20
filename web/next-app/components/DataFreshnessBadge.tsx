/* eslint-disable */
// @ts-nocheck
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle, CheckCircle } from "lucide-react";

interface DataFreshnessBadgeProps {
  lastUpdated?: string;
  className?: string;
  showIcon?: boolean;
  showText?: boolean;
}

export function DataFreshnessBadge({ 
  lastUpdated, 
  className = "",
  showIcon = true,
  showText = true
}: DataFreshnessBadgeProps) {
  if (!lastUpdated) {
    return (
      <Badge variant="secondary" className={className}>
        {showIcon && <AlertCircle className="h-3 w-3 mr-1" />}
        {showText && "No data"}
      </Badge>
    );
  }

  const lastUpdateDate = new Date(lastUpdated);
  const now = new Date();
  const hoursOld = (now.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60);

  // Determine freshness status
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let icon = <CheckCircle className="h-3 w-3 mr-1" />;
  let label = "Fresh";
  let colorClass = "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";

  if (hoursOld > 24) {
    // Stale (> 24 hours)
    variant = "destructive";
    icon = <AlertCircle className="h-3 w-3 mr-1" />;
    label = "Stale";
    colorClass = "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
  } else if (hoursOld > 2) {
    // Aging (2-24 hours)
    variant = "secondary";
    icon = <Clock className="h-3 w-3 mr-1" />;
    label = "Aging";
    colorClass = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
  }

  const formatAge = (hours: number): string => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m ago`;
    }
    if (hours < 24) {
      return `${Math.round(hours)}h ago`;
    }
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Badge 
      variant={variant} 
      className={`${colorClass} ${className}`}
      title={`Last updated: ${lastUpdateDate.toLocaleString()}`}
    >
      {showIcon && icon}
      {showText && (
        <span>
          {label} ({formatAge(hoursOld)})
        </span>
      )}
    </Badge>
  );
}

interface SymbolFreshnessIndicatorProps {
  symbol: string;
  intervals?: Record<string, { last_updated?: string }>;
  className?: string;
}

export function SymbolFreshnessIndicator({ 
  symbol, 
  intervals = {},
  className = ""
}: SymbolFreshnessIndicatorProps) {
  const intervalKeys = Object.keys(intervals);
  
  if (intervalKeys.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        <AlertCircle className="inline h-4 w-4 mr-1" />
        No data available
      </div>
    );
  }

  // Find the most recent update across all intervals
  let mostRecentUpdate: string | null = null;
  let stalestUpdate: string | null = null;
  
  intervalKeys.forEach((interval) => {
    const lastUpdated = intervals[interval]?.last_updated;
    if (lastUpdated) {
      if (!mostRecentUpdate || lastUpdated > mostRecentUpdate) {
        mostRecentUpdate = lastUpdated;
      }
      if (!stalestUpdate || lastUpdated < stalestUpdate) {
        stalestUpdate = lastUpdated;
      }
    }
  });

  // Count fresh, aging, and stale intervals
  let fresh = 0;
  let aging = 0;
  let stale = 0;
  
  intervalKeys.forEach((interval) => {
    const lastUpdated = intervals[interval]?.last_updated;
    if (!lastUpdated) return;
    
    const hoursOld = (new Date().getTime() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60);
    if (hoursOld <= 2) fresh++;
    else if (hoursOld <= 24) aging++;
    else stale++;
  });

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm font-medium">{symbol}</span>
      <div className="flex gap-1">
        {fresh > 0 && (
          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 text-xs">
            {fresh} fresh
          </Badge>
        )}
        {aging > 0 && (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 text-xs">
            {aging} aging
          </Badge>
        )}
        {stale > 0 && (
          <Badge variant="destructive" className="text-xs">
            {stale} stale
          </Badge>
        )}
      </div>
    </div>
  );
}

