import { getSession } from "next-auth/react";

function resolveApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  // Server-side rendering: use env URL or default
  if (typeof window === "undefined") {
    return envUrl || "http://localhost:8000";
  }

  // If explicit API URL is set and it's not a Docker internal hostname, use it
  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      const hostname = parsed.hostname.toLowerCase();
      const isDockerInternalHostname =
        !hostname.includes(".") && hostname !== "localhost" && hostname !== "127.0.0.1";

      if (!isDockerInternalHostname) {
        // If page is served over HTTPS, upgrade HTTP URLs to HTTPS
        if (window.location.protocol === "https:" && parsed.protocol === "http:") {
          parsed.protocol = "https:";
          return parsed.toString();
        }
        return envUrl;
      }
    } catch {
      return envUrl;
    }
  }

  // Client-side: use relative URLs when behind nginx proxy
  // This works because nginx proxies /api/* to the backend
  // Only use absolute URLs in development (localhost)
  const { hostname, protocol } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  
  if (isLocalhost) {
    // Development: use explicit port
    const port = process.env.NEXT_PUBLIC_API_PORT || "8000";
    return `${protocol}//${hostname}:${port}`;
  }
  
  // Production: use relative URLs (nginx handles routing)
  // Return empty string to use relative paths
  return "";
}

export function buildApiUrl(path: string): string {
  // If path is already absolute, return as-is
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  
  const base = resolveApiBase();
  
  // If base is empty (production behind nginx), use relative URL
  if (!base) {
    return path;
  }
  
  // Ensure path starts with / if base is provided
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const session = await getSession();
  
  if (!session?.accessToken) {
    return {
      "Content-Type": "application/json",
    };
  }
  
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${session.accessToken}`,
  };
}

export async function fetcher<T>(path: string, init?: RequestInit): Promise<T> {
  const url = buildApiUrl(path);
  const headers = await getAuthHeaders();
  
  const res = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
  });
  
  if (res.status === 401) {
    // Token expired, redirect to login
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }
  
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }
  return res.json();
}

export async function postJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  const url = buildApiUrl(path);
  const headers = await getAuthHeaders();
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
    body: JSON.stringify(body),
    ...init,
  });
  
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }
  
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `API request failed: ${res.status}`);
  }
  return res.json();
}

export async function putJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  const url = buildApiUrl(path);
  const headers = await getAuthHeaders();
  
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
    body: JSON.stringify(body),
    ...init,
  });
  
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }
  
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `API request failed: ${res.status}`);
  }
  return res.json();
}

export function buildWebSocketUrl(path: string): string {
  // If path is already a full WebSocket URL, return as-is
  if (path.startsWith("ws://") || path.startsWith("wss://")) {
    return path;
  }
  
  const base = resolveApiBase();
  
  // If base is empty (production behind nginx), construct from window.location
  if (!base && typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    // Use wss:// for HTTPS, ws:// for HTTP
    const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${wsProtocol}//${hostname}${normalizedPath}`;
  }
  
  // Convert http/https to ws/wss, ensuring we use wss:// when page is served over HTTPS
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    // Page is served over HTTPS, use wss://
    const wsBase = base.replace(/^https?/, "wss");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${wsBase}${normalizedPath}`;
  }
  
  // Use ws:// for HTTP
  const wsBase = base.replace(/^https?/, "ws");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${wsBase}${normalizedPath}`;
}

// Macro/Regime API hooks
export function buildRegimeUrl(symbol: string, interval: string = "1h"): string {
  return `/api/macro/regime?symbol=${encodeURIComponent(symbol)}&interval=${interval}`;
}

export function buildRegimeHistoryUrl(symbol: string, limit: number = 100): string {
  return `/api/macro/regimes/history/${encodeURIComponent(symbol)}?limit=${limit}`;
}

export function buildRegimeBatchUrl(symbols: string[], interval: string = "1h"): string {
  return `/api/macro/regimes/batch?symbols=${symbols.map(s => encodeURIComponent(s)).join(",")}&interval=${interval}`;
}

