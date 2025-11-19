import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  timeout?: number;
};

export type ToastContextValue = {
  toasts: Toast[];
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const timeout = toast.timeout ?? 4200;
      const entry: Toast = { id, ...toast };
      setToasts((prev) => [...prev, entry]);
      if (timeout > 0 && typeof window !== "undefined") {
        window.setTimeout(() => dismissToast(id), timeout);
      }
    },
    [dismissToast],
  );

  const clearToasts = useCallback(() => setToasts([]), []);

  const value = useMemo(
    () => ({
      toasts,
      pushToast,
      dismissToast,
      clearToasts,
    }),
    [toasts, pushToast, dismissToast, clearToasts],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-md border bg-card/95 p-3 shadow-lg backdrop-blur ${
              toast.variant === "destructive"
                ? "border-red-600/60 text-red-400"
                : toast.variant === "success"
                  ? "border-emerald-500/60 text-emerald-300"
                  : "border-muted text-muted-foreground"
            }`}
          >
            {toast.title && <div className="text-sm font-semibold text-foreground">{toast.title}</div>}
            {toast.description && <div className="text-xs leading-snug text-foreground/80">{toast.description}</div>}
            <button
              type="button"
              className="mt-2 text-xs text-primary underline"
              onClick={() => dismissToast(toast.id)}
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext<ToastContextValue | undefined>(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

