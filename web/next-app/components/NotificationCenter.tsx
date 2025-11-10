/* eslint-disable */
// @ts-nocheck
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Notification = {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  kind?: "info" | "warning" | "success";
};

type NotificationContextValue = {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id" | "timestamp"> & { timestamp?: string }) => void;
  clearNotifications: () => void;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (notification: Omit<Notification, "id" | "timestamp"> & { timestamp?: string }) => {
      const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const timestamp = notification.timestamp ?? new Date().toISOString();
      setNotifications((prev) => [
        { id, ...notification, timestamp },
        ...prev.slice(0, 49),
      ]);
    },
    [],
  );

  const clearNotifications = useCallback(() => setNotifications([]), []);

  const value = useMemo(
    () => ({
      notifications,
      addNotification,
      clearNotifications,
    }),
    [notifications, addNotification, clearNotifications],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationCenter() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotificationCenter must be used within NotificationProvider");
  }
  return ctx;
}

export function NotificationCenter() {
  const { notifications, clearNotifications } = useNotificationCenter();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        onClick={() => setOpen((prev) => !prev)}
      >
        Notifications {notifications.length > 0 && <span className="ml-1 rounded-full bg-primary/20 px-2 text-xs">{notifications.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-md border border-border bg-background p-4 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Notification Center</h3>
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={() => clearNotifications()}
            >
              Clear
            </button>
          </div>
          <div className="max-h-72 space-y-3 overflow-y-auto pr-2 text-sm">
            {notifications.length === 0 && <p className="text-xs text-muted-foreground">No notifications yet.</p>}
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`rounded-md border p-2 ${
                  notification.kind === "warning"
                    ? "border-amber-500/70 bg-amber-500/10"
                    : notification.kind === "success"
                      ? "border-emerald-500/60 bg-emerald-500/10"
                      : "border-border bg-card/80"
                }`}
              >
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{new Date(notification.timestamp).toLocaleTimeString()}</div>
                <div className="text-sm font-medium text-foreground">{notification.title}</div>
                <div className="text-xs text-muted-foreground">{notification.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

