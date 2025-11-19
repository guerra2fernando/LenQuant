"""Notification repository for database operations."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional

from bson import ObjectId
from db.client import get_database_name, mongo_client


class NotificationRepository:
    """Repository for notification database operations."""
    
    def __init__(self):
        self.collection_name = "notifications"
    
    def _get_collection(self):
        """Get the notifications collection."""
        with mongo_client() as client:
            db = client[get_database_name()]
            return db[self.collection_name]
    
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
    ) -> str:
        """Create a new notification."""
        collection = self._get_collection()
        doc = {
            "user_id": user_id,
            "type": type,
            "severity": severity,
            "title": title,
            "message": message,
            "metadata": metadata or {},
            "actions": actions or [],
            "read": False,
            "dismissed": False,
            "grouped": False,
            "group_id": None,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(days=expires_days),
        }
        result = collection.insert_one(doc)
        return str(result.inserted_id)
    
    def get_user_notifications(
        self,
        user_id: str,
        unread_only: bool = False,
        limit: int = 50,
        skip: int = 0,
    ) -> List[dict]:
        """Retrieve user notifications with pagination."""
        collection = self._get_collection()
        query = {"user_id": user_id, "dismissed": False}
        if unread_only:
            query["read"] = False
        
        cursor = collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
        notifications = list(cursor)
        
        # Convert ObjectId to string for JSON serialization
        for notification in notifications:
            notification["_id"] = str(notification["_id"])
            # Convert datetime to ISO format string
            if isinstance(notification.get("created_at"), datetime):
                notification["created_at"] = notification["created_at"].isoformat()
            if isinstance(notification.get("expires_at"), datetime):
                notification["expires_at"] = notification["expires_at"].isoformat()
        
        return notifications
    
    def mark_as_read(self, notification_id: str, user_id: str) -> bool:
        """Mark notification as read."""
        collection = self._get_collection()
        try:
            result = collection.update_one(
                {"_id": ObjectId(notification_id), "user_id": user_id},
                {"$set": {"read": True}},
            )
            return result.modified_count > 0
        except Exception:
            return False
    
    def mark_all_as_read(self, user_id: str) -> int:
        """Mark all user notifications as read."""
        collection = self._get_collection()
        result = collection.update_many(
            {"user_id": user_id, "read": False, "dismissed": False},
            {"$set": {"read": True}},
        )
        return result.modified_count
    
    def dismiss_notification(self, notification_id: str, user_id: str) -> bool:
        """Dismiss (soft delete) a notification."""
        collection = self._get_collection()
        try:
            result = collection.update_one(
                {"_id": ObjectId(notification_id), "user_id": user_id},
                {"$set": {"dismissed": True}},
            )
            return result.modified_count > 0
        except Exception:
            return False
    
    def get_unread_count(self, user_id: str) -> int:
        """Get count of unread notifications."""
        collection = self._get_collection()
        return collection.count_documents({
            "user_id": user_id,
            "read": False,
            "dismissed": False,
        })
    
    def get_total_count(self, user_id: str) -> int:
        """Get total count of non-dismissed notifications."""
        collection = self._get_collection()
        return collection.count_documents({
            "user_id": user_id,
            "dismissed": False,
        })
    
    def group_notifications(
        self,
        user_id: str,
        notification_type: str,
        time_window_minutes: int = 5,
        threshold: int = 3,
    ) -> Optional[str]:
        """Group similar notifications within a time window.
        
        Returns the group_id if grouping occurred, None otherwise.
        """
        collection = self._get_collection()
        cutoff = datetime.utcnow() - timedelta(minutes=time_window_minutes)
        
        # Find recent ungrouped notifications of the same type
        recent = list(collection.find({
            "user_id": user_id,
            "type": notification_type,
            "created_at": {"$gte": cutoff},
            "grouped": {"$ne": True},
            "dismissed": False,
        }).sort("created_at", -1).limit(100))
        
        if len(recent) < threshold:
            return None
        
        # Create a group
        group_id = str(ObjectId())
        
        # Mark notifications as grouped
        notification_ids = [n["_id"] for n in recent]
        collection.update_many(
            {"_id": {"$in": notification_ids}},
            {"$set": {"grouped": True, "group_id": group_id}},
        )
        
        # Create a summary notification
        summary_id = self.create_notification(
            user_id=user_id,
            type=f"{notification_type}_summary",
            severity="info",
            title=f"{len(recent)} {notification_type.replace('_', ' ').title()}s",
            message=f"You have {len(recent)} recent {notification_type.replace('_', ' ')} notifications",
            metadata={"group_id": group_id, "count": len(recent), "original_type": notification_type},
        )
        
        return group_id

