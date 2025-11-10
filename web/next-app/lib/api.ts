function resolveApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  if (typeof window === "undefined") {
    return envUrl || "http://localhost:8000";
  }

  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      const hostname = parsed.hostname.toLowerCase();
      const isDockerInternalHostname =
        !hostname.includes(".") && hostname !== "localhost" && hostname !== "127.0.0.1";

      if (!isDockerInternalHostname) {
        return envUrl;
      }
    } catch {
      return envUrl;
    }
  }

  const { protocol, hostname } = window.location;
  const port = process.env.NEXT_PUBLIC_API_PORT || "8000";

  return `${protocol}//${hostname}:${port}`;
}

export function buildApiUrl(path: string): string {
  const base = resolveApiBase();
  return path.startsWith("http") ? path : `${base}${path}`;
}

export async function fetcher<T>(path: string, init?: RequestInit): Promise<T> {
  const url = buildApiUrl(path);
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }
  return res.json();
}

export async function postJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  const url = buildApiUrl(path);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    body: JSON.stringify(body),
    ...init,
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `API request failed: ${res.status}`);
  }
  return res.json();
}

export async function putJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  const url = buildApiUrl(path);
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    body: JSON.stringify(body),
    ...init,
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `API request failed: ${res.status}`);
  }
  return res.json();
}

