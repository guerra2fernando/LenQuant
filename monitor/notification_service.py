"""Centralized service for creating notifications from various system events."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from db.repositories.notification_preferences_repository import NotificationPreferencesRepository
from db.repositories.notification_repository import NotificationRepository

logger = logging.getLogger(__name__)


class NotificationService:
    """Centralized service for creating notifications from various system events."""
    
    def __init__(self):
        self.repo = NotificationRepository()
        self.prefs_repo = NotificationPreferencesRepository()
    
    def notify_order_filled(self, user_id: str, order_data: dict):
        """Notify user about order fill."""
        try:
            self.create_notification(
                user_id=user_id,
                type="trade_execution",
                severity="success",
                title="Order Filled",
                message=f"{order_data.get('side', 'Order').title()} order for {order_data.get('symbol', 'N/A')} filled at ${order_data.get('price', 0):,.2f}",
                metadata={
                    "symbol": order_data.get("symbol"),
                    "order_id": order_data.get("order_id"),
                    "side": order_data.get("side"),
                    "amount": order_data.get("amount"),
                    "price": order_data.get("price"),
                },
            )
        except Exception as e:
            logger.error(f"Failed to create order filled notification: {e}")
    
    def notify_risk_breach(self, user_id: str, breach_type: str, details: dict):
        """Notify user about risk limit breach."""
        try:
            severity = details.get("severity", "warning")
            notification_severity = "warning" if severity == "warning" else "error"
            
            self.create_notification(
                user_id=user_id,
                type="risk_alert",
                severity=notification_severity,
                title=f"Risk Alert: {breach_type}",
                message=details.get("message", f"Risk breach: {breach_type}"),
                metadata=details,
            )
        except Exception as e:
            logger.error(f"Failed to create risk breach notification: {e}")
    
    def notify_strategy_promotion(self, user_id: str, strategy_id: str, metrics: dict):
        """Notify user about strategy promotion."""
        try:
            self.create_notification(
                user_id=user_id,
                type="strategy_performance",
                severity="success",
                title="Strategy Promoted",
                message=f"Strategy {strategy_id} has been promoted to live trading!",
                metadata={"strategy_id": strategy_id, "metrics": metrics},
                actions=[
                    {
                        "label": "View Strategy",
                        "action": "navigate",
                        "payload": {"route": f"/strategies/{strategy_id}"},
                    },
                ],
            )
        except Exception as e:
            logger.error(f"Failed to create strategy promotion notification: {e}")
    
    def notify_experiment_complete(self, user_id: str, experiment_type: str, results: dict):
        """Notify user about experiment completion."""
        try:
            self.create_notification(
                user_id=user_id,
                type="experiment_completion",
                severity="info",
                title=f"{experiment_type.title()} Complete",
                message=results.get("summary", f"{experiment_type} experiment has completed."),
                metadata={"experiment_type": experiment_type, "results": results},
            )
        except Exception as e:
            logger.error(f"Failed to create experiment completion notification: {e}")
    
    def notify_insight(self, user_id: str, insight_title: str, insight_message: str, metadata: Optional[dict] = None):
        """Notify user about AI-generated insights."""
        try:
            self.create_notification(
                user_id=user_id,
                type="insight",
                severity="info",
                title=insight_title,
                message=insight_message,
                metadata=metadata or {},
            )
        except Exception as e:
            logger.error(f"Failed to create insight notification: {e}")
    
    def create_notification(
        self,
        user_id: str,
        type: str,
        severity: str,
        title: str,
        message: str,
        metadata: Optional[dict] = None,
        expires_days: int = 30,
        actions: Optional[List[dict]] = None,
    ) -> Optional[str]:
        """Generic method to create a notification and broadcast via WebSocket.
        
        Returns notification_id if created, None if filtered by preferences.
        """
        try:
            # Check user preferences
            if not self.prefs_repo.should_send_notification(user_id, type, severity):
                logger.debug(f"Notification filtered by preferences: user={user_id}, type={type}, severity={severity}")
                return None
            
            # Check quiet hours (only for non-critical notifications)
            if severity not in ["critical", "error"] and self.prefs_repo.is_quiet_hours(user_id):
                logger.debug(f"Notification delayed due to quiet hours: user={user_id}, type={type}")
                # Still create the notification, but don't broadcast immediately
                # Could implement a queue for quiet hours notifications
            
            # Create in database
            notification_id = self.repo.create_notification(
                user_id=user_id,
                type=type,
                severity=severity,
                title=title,
                message=message,
                metadata=metadata,
                expires_days=expires_days,
                actions=actions,
            )
            
            # Broadcast to connected clients via WebSocket
            self._broadcast_notification(
                user_id=user_id,
                notification_id=notification_id,
                type=type,
                severity=severity,
                title=title,
                message=message,
                metadata=metadata or {},
                actions=actions or [],
            )
            
            # Check for grouping opportunities (async, non-blocking)
            try:
                self.repo.group_notifications(user_id, type, time_window_minutes=5, threshold=3)
            except Exception as e:
                logger.warning(f"Failed to group notifications: {e}")
            
            return notification_id
        except Exception as e:
            logger.error(f"Failed to create notification: {e}")
            raise
    
    def _broadcast_notification(
        self,
        user_id: str,
        notification_id: str,
        type: str,
        severity: str,
        title: str,
        message: str,
        metadata: dict,
        actions: List[dict],
    ):
        """Broadcast notification to user's connected WebSocket clients."""
        try:
            # Lazy import to avoid circular dependency
            from api.main import notification_manager
            
            notification_data = {
                "type": "new_notification",
                "notification": {
                    "id": notification_id,
                    "user_id": user_id,
                    "type": type,
                    "severity": severity,
                    "title": title,
                    "message": message,
                    "metadata": metadata,
                    "actions": actions,
                    "read": False,
                    "created_at": datetime.utcnow().isoformat(),
                }
            }
            
            # Use asyncio to run the async broadcast
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # If loop is running, schedule the coroutine
                    asyncio.create_task(notification_manager.broadcast_to_user(user_id, notification_data))
                else:
                    # If no loop is running, run it
                    loop.run_until_complete(notification_manager.broadcast_to_user(user_id, notification_data))
            except RuntimeError:
                # No event loop, create a new one
                asyncio.run(notification_manager.broadcast_to_user(user_id, notification_data))
        except Exception as e:
            # Log but don't fail notification creation if WebSocket broadcast fails
            logger.warning(f"Failed to broadcast notification via WebSocket: {e}")

