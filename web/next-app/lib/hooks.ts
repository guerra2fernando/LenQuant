/* eslint-disable */
// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { buildWebSocketUrl, fetcher, buildRegimeUrl, buildRegimeBatchUrl } from "./api";

export function useWebSocket<T = any>(url: string | null, options?: { enabled?: boolean; onMessage?: (data: T) => void }) {
  const [data, setData] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!url || !enabled) {
      return;
    }

    const connect = () => {
      try {
        const wsUrl = buildWebSocketUrl(url);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
          setError(null);
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            setData(parsed);
            if (options?.onMessage) {
              options.onMessage(parsed);
            }
          } catch (err) {
            console.error("Failed to parse WebSocket message:", err);
          }
        };

        ws.onerror = (event) => {
          console.error("WebSocket error:", event);
          setError(new Error("WebSocket connection error"));
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Attempt to reconnect after 3 seconds
          if (enabled) {
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, 3000);
          }
        };

        wsRef.current = ws;
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to create WebSocket connection"));
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  }, [url, enabled, options?.onMessage]);

  return { data, isConnected, error };
}

// Regime data hooks
export function useRegime(symbol: string, interval: string = "1h") {
  const url = symbol ? buildRegimeUrl(symbol, interval) : null;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    refreshInterval: 60000, // Refresh every minute
    revalidateOnFocus: true,
  });

  return {
    regime: data,
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}

export function useRegimeBatch(symbols: string[], interval: string = "1h") {
  const url = symbols.length > 0 ? buildRegimeBatchUrl(symbols, interval) : null;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    refreshInterval: 60000, // Refresh every minute
    revalidateOnFocus: true,
  });

  return {
    regimes: data?.regimes ?? [],
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}

