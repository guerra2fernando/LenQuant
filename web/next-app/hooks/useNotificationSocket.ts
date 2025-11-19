import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { buildWebSocketUrl } from "@/lib/api";

type Notification = {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  metadata: Record<string, any>;
  read: boolean;
  created_at: string;
};

export function useNotificationSocket() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (!session?.accessToken) {
      return;
    }

    const connect = () => {
      try {
        const wsUrl = `${buildWebSocketUrl("/ws/notifications")}?token=${session.accessToken}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("Notification WebSocket connected");
          reconnectAttempts.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "new_notification") {
              const notification = data.notification as Notification;
              setNotifications((prev) => {
                // Add new notification at the beginning, keep max 50
                const updated = [notification, ...prev.filter((n) => n.id !== notification.id)].slice(0, 50);
                return updated;
              });
              setUnreadCount((prev) => prev + 1);

              // Show browser notification if permission granted
              if (typeof window !== "undefined" && "Notification" in window) {
                if (Notification.permission === "granted") {
                  new Notification(notification.title, {
                    body: notification.message,
                    icon: "/images/logo.png",
                    tag: notification.id,
                  });
                }
              }
            } else if (data.type === "unread_count") {
              setUnreadCount(data.count);
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("Notification WebSocket error:", error);
        };

        ws.onclose = () => {
          console.log("Notification WebSocket closed");
          // Attempt to reconnect with exponential backoff
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            reconnectAttempts.current += 1;
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("Failed to create WebSocket connection:", error);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [session?.accessToken]);

  // Fetch initial notifications from API
  useEffect(() => {
    if (!session?.accessToken) {
      return;
    }

    const fetchNotifications = async () => {
      try {
        const { fetcher } = await import("@/lib/api");
        const data = await fetcher<Notification[]>("/api/notifications?limit=50");
        setNotifications(data);

      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    };

    fetchNotifications();
  }, [session?.accessToken]);

  return { notifications, unreadCount, setNotifications, setUnreadCount };
}

