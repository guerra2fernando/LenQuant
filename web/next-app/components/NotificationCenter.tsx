/* eslint-disable */
// @ts-nocheck
import { useState, useCallback } from "react";
import { useRouter } from "next/router";
import { Bell, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useNotificationSocket } from "@/hooks/useNotificationSocket";
import { fetcher, postJson } from "@/lib/api";

type NotificationAction = {
  label: string;
  action: string; // "navigate" | "api_call"
  payload: Record<string, any>;
};

type Notification = {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  metadata: Record<string, any>;
  actions?: NotificationAction[];
  read: boolean;
  created_at: string;
};

function NotificationItem({ notification, onMarkRead, onDismiss, onAction }: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onAction: (id: string, action: NotificationAction) => void;
}) {
  const router = useRouter();
  const severityColors = {
    success: "border-l-emerald-500 bg-emerald-500/5",
    warning: "border-l-amber-500 bg-amber-500/5",
    error: "border-l-red-500 bg-red-500/5",
    critical: "border-l-red-600 bg-red-600/10",
    info: "border-l-blue-500 bg-blue-500/5",
  };

  const handleMarkRead = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
  };

  const handleDismiss = () => {
    onDismiss(notification.id);
  };

  const handleAction = async (action: NotificationAction) => {
    onAction(notification.id, action);
    
    if (action.action === "navigate") {
      router.push(action.payload.route);
    } else if (action.action === "api_call") {
      try {
        await fetcher(action.payload.endpoint, {
          method: action.payload.method || "POST",
        });
      } catch (error) {
        console.error("Failed to execute action:", error);
      }
    }
  };

  return (
    <div
      className={`border-b border-border border-l-4 p-4 transition hover:bg-accent/50 ${
        severityColors[notification.severity] || severityColors.info
      } ${!notification.read ? "bg-accent/30" : ""}`}
      onClick={handleMarkRead}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{notification.title}</p>
            {!notification.read && (
              <div className="h-2 w-2 rounded-full bg-blue-500" />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {notification.message}
          </p>
          {notification.actions && notification.actions.length > 0 && (
            <div className="mt-3 flex gap-2">
              {notification.actions.map((action, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(action);
                  }}
                  className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(notification.created_at).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="ml-2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const { data: session } = useSession();
  const { notifications, unreadCount, setNotifications, setUnreadCount } = useNotificationSocket();
  const [open, setOpen] = useState(false);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await postJson(`/api/notifications/${notificationId}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }, [setNotifications, setUnreadCount]);

  const dismissNotification = useCallback(async (notificationId: string) => {
    try {
      await fetcher(`/api/notifications/${notificationId}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      // Decrement unread count if it was unread
      const notification = notifications.find((n) => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
    }
  }, [notifications, setNotifications, setUnreadCount]);

  const handleAction = useCallback(async (notificationId: string, action: NotificationAction) => {
    try {
      await postJson(`/api/notifications/${notificationId}/action`, { action: action.action });
    } catch (error) {
      console.error("Failed to track action:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await postJson("/api/notifications/mark-all-read", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  }, [setNotifications, setUnreadCount]);

  if (!session) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-md border border-border bg-card p-2 text-muted-foreground transition hover:text-foreground"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          
          {/* Notification Panel */}
          <div className="absolute right-0 z-50 mt-2 w-96 rounded-lg border border-border bg-background shadow-2xl">
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={markAllAsRead}
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Close notifications"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-[32rem] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No notifications yet
                </div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={markAsRead}
                    onDismiss={dismissNotification}
                    onAction={handleAction}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
