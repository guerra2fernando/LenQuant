"""Notification preferences repository for user notification settings."""
from __future__ import annotations

from datetime import datetime
from typing import Dict, Optional

from db.client import get_database_name, mongo_client


class NotificationPreferencesRepository:
    """Repository for notification preferences database operations."""
    
    def __init__(self):
        self.collection_name = "notification_preferences"
    
    def _get_collection(self):
        """Get the notification_preferences collection."""
        with mongo_client() as client:
            db = client[get_database_name()]
            return db[self.collection_name]
    
    def get_preferences(self, user_id: str) -> Dict:
        """Get user notification preferences, creating defaults if not found."""
        collection = self._get_collection()
        doc = collection.find_one({"user_id": user_id})
        
        if not doc:
            # Return default preferences
            return self._get_default_preferences()
        
        # Remove _id for JSON serialization
        doc.pop("_id", None)
        return doc
    
    def update_preferences(self, user_id: str, preferences: Dict) -> Dict:
        """Update user notification preferences."""
        collection = self._get_collection()
        
        # Merge with existing preferences
        existing = self.get_preferences(user_id)
        merged_preferences = self._merge_preferences(existing.get("preferences", {}), preferences.get("preferences", {}))
        merged_quiet_hours = {**existing.get("quiet_hours", {}), **preferences.get("quiet_hours", {})}
        
        doc = {
            "user_id": user_id,
            "preferences": merged_preferences,
            "quiet_hours": merged_quiet_hours,
            "updated_at": datetime.utcnow(),
        }
        
        collection.update_one(
            {"user_id": user_id},
            {"$set": doc},
            upsert=True,
        )
        
        doc.pop("_id", None)
        return doc
    
    def _get_default_preferences(self) -> Dict:
        """Get default notification preferences."""
        return {
            "preferences": {
                "trade_execution": {
                    "enabled": True,
                    "channels": ["in_app"],
                    "min_severity": "info",
                },
                "risk_alert": {
                    "enabled": True,
                    "channels": ["in_app"],
                    "min_severity": "warning",
                },
                "strategy_performance": {
                    "enabled": True,
                    "channels": ["in_app"],
                    "min_severity": "info",
                },
                "system_event": {
                    "enabled": True,
                    "channels": ["in_app"],
                    "min_severity": "info",
                },
                "insight": {
                    "enabled": True,
                    "channels": ["in_app"],
                    "min_severity": "info",
                    "frequency": "immediate",  # immediate | hourly_digest | daily_digest
                },
                "experiment_completion": {
                    "enabled": True,
                    "channels": ["in_app"],
                    "min_severity": "info",
                },
            },
            "quiet_hours": {
                "enabled": False,
                "start": "22:00",
                "end": "08:00",
                "timezone": "UTC",
            },
        }
    
    def _merge_preferences(self, existing: Dict, updates: Dict) -> Dict:
        """Merge preference updates with existing preferences."""
        merged = {**existing}
        for key, value in updates.items():
            if isinstance(value, dict) and isinstance(merged.get(key), dict):
                merged[key] = {**merged.get(key, {}), **value}
            else:
                merged[key] = value
        return merged
    
    def should_send_notification(
        self,
        user_id: str,
        notification_type: str,
        severity: str,
    ) -> bool:
        """Check if a notification should be sent based on user preferences."""
        prefs = self.get_preferences(user_id)
        type_prefs = prefs.get("preferences", {}).get(notification_type, {})
        
        # Check if type is enabled
        if not type_prefs.get("enabled", True):
            return False
        
        # Check severity threshold
        min_severity = type_prefs.get("min_severity", "info")
        severity_levels = ["info", "success", "warning", "error", "critical"]
        try:
            notification_level = severity_levels.index(severity)
            min_level = severity_levels.index(min_severity)
            if notification_level < min_level:
                return False
        except ValueError:
            # Unknown severity, allow it
            pass
        
        return True
    
    def is_quiet_hours(self, user_id: str) -> bool:
        """Check if current time is within user's quiet hours."""
        prefs = self.get_preferences(user_id)
        quiet_hours = prefs.get("quiet_hours", {})
        
        if not quiet_hours.get("enabled", False):
            return False
        
        # TODO: Implement timezone-aware quiet hours check
        # For now, return False (not in quiet hours)
        # This would require pytz or similar library
        return False

