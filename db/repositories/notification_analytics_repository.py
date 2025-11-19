"""Notification analytics repository for tracking engagement."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Optional

from bson import ObjectId
from db.client import get_database_name, mongo_client


class NotificationAnalyticsRepository:
    """Repository for notification analytics tracking."""

    def __init__(self):
        self.collection_name = "notification_analytics"
    
    def track_opened(self, notification_id: str, user_id: str) -> str:
        """Track when a notification is opened/viewed."""
        with mongo_client() as client:
            db = client[get_database_name()]
            collection = db[self.collection_name]
            doc = {
                "notification_id": notification_id,
                "user_id": user_id,
                "opened_at": datetime.utcnow(),
            }
            result = collection.insert_one(doc)
            return str(result.inserted_id)
    
    def track_clicked(self, notification_id: str, user_id: str, action: Optional[str] = None) -> str:
        """Track when a notification action is clicked."""
        with mongo_client() as client:
            db = client[get_database_name()]
            collection = db[self.collection_name]
            doc = {
                "notification_id": notification_id,
                "user_id": user_id,
                "clicked_at": datetime.utcnow(),
                "action_taken": action,
            }
            result = collection.insert_one(doc)
            return str(result.inserted_id)
    
    def track_dismissed(self, notification_id: str, user_id: str) -> str:
        """Track when a notification is dismissed."""
        with mongo_client() as client:
            db = client[get_database_name()]
            collection = db[self.collection_name]
            doc = {
                "notification_id": notification_id,
                "user_id": user_id,
                "dismissed_at": datetime.utcnow(),
            }
            result = collection.insert_one(doc)
            return str(result.inserted_id)
    
    def get_engagement_stats(self, user_id: str, days: int = 30) -> Dict:
        """Get engagement statistics for a user."""
        with mongo_client() as client:
            db = client[get_database_name()]
            collection = db[self.collection_name]
            cutoff = datetime.utcnow() - timedelta(days=days)

            pipeline = [
                {"$match": {"user_id": user_id, "opened_at": {"$gte": cutoff}}},
                {"$group": {
                    "_id": None,
                    "total_opened": {"$sum": 1},
                    "total_clicked": {"$sum": {"$cond": [{"$ifNull": ["$clicked_at", False]}, 1, 0]}},
                    "total_dismissed": {"$sum": {"$cond": [{"$ifNull": ["$dismissed_at", False]}, 1, 0]}},
                }},
            ]

            result = list(collection.aggregate(pipeline))
            if result:
                stats = result[0]
                stats.pop("_id", None)
                return stats

            return {"total_opened": 0, "total_clicked": 0, "total_dismissed": 0}

