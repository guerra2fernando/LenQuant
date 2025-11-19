"""Notification API routes."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.auth.dependencies import get_current_user
from db.models.user import User
from db.repositories.notification_analytics_repository import NotificationAnalyticsRepository
from db.repositories.notification_preferences_repository import NotificationPreferencesRepository
from db.repositories.notification_repository import NotificationRepository

router = APIRouter()


class NotificationAction(BaseModel):
    """Notification action model."""
    
    label: str
    action: str  # "navigate" | "api_call"
    payload: dict


class NotificationResponse(BaseModel):
    """Notification response model."""
    
    id: str
    type: str
    severity: str
    title: str
    message: str
    metadata: dict
    actions: List[NotificationAction] = []
    read: bool
    created_at: str


class NotificationCountResponse(BaseModel):
    """Notification count response model."""
    
    unread_count: int
    total_count: int


@router.get("/notifications", response_model=List[NotificationResponse])
def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    skip: int = 0,
    current_user: User = Depends(get_current_user),
):
    """Get user notifications with optional filtering."""
    repo = NotificationRepository()
    notifications = repo.get_user_notifications(
        user_id=current_user.id,
        unread_only=unread_only,
        limit=limit,
        skip=skip,
    )
    
    return [
        NotificationResponse(
            id=n["_id"],
            type=n["type"],
            severity=n["severity"],
            title=n["title"],
            message=n["message"],
            metadata=n.get("metadata", {}),
            actions=[NotificationAction(**a) for a in n.get("actions", [])],
            read=n["read"],
            created_at=n["created_at"],
        )
        for n in notifications
    ]


@router.get("/notifications/count", response_model=NotificationCountResponse)
def get_notification_count(current_user: User = Depends(get_current_user)):
    """Get notification counts."""
    repo = NotificationRepository()
    unread = repo.get_unread_count(current_user.id)
    total = repo.get_total_count(current_user.id)
    return NotificationCountResponse(unread_count=unread, total_count=total)


@router.post("/notifications/mark-all-read")
def mark_all_notifications_read(current_user: User = Depends(get_current_user)):
    """Mark all notifications as read."""
    repo = NotificationRepository()
    count = repo.mark_all_as_read(current_user.id)
    return {"status": "success", "marked_count": count}


@router.delete("/notifications/{notification_id}")
def dismiss_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
):
    """Dismiss a notification."""
    repo = NotificationRepository()
    analytics_repo = NotificationAnalyticsRepository()
    
    success = repo.dismiss_notification(notification_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Track dismissal
    try:
        analytics_repo.track_dismissed(notification_id, current_user.id)
    except Exception:
        pass  # Don't fail if analytics tracking fails
    
    return {"status": "success"}


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
):
    """Mark a notification as read."""
    repo = NotificationRepository()
    analytics_repo = NotificationAnalyticsRepository()
    
    success = repo.mark_as_read(notification_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Track opening/viewing
    try:
        analytics_repo.track_opened(notification_id, current_user.id)
    except Exception:
        pass  # Don't fail if analytics tracking fails
    
    return {"status": "success"}


class ActionRequest(BaseModel):
    """Action request model."""
    action: str


@router.post("/notifications/{notification_id}/action")
def track_notification_action(
    notification_id: str,
    request: ActionRequest,
    current_user: User = Depends(get_current_user),
):
    """Track when a user clicks a notification action."""
    analytics_repo = NotificationAnalyticsRepository()
    analytics_repo.track_clicked(notification_id, current_user.id, request.action)
    return {"status": "success"}


@router.get("/notifications/preferences")
def get_notification_preferences(current_user: User = Depends(get_current_user)):
    """Get user notification preferences."""
    prefs_repo = NotificationPreferencesRepository()
    prefs = prefs_repo.get_preferences(current_user.id)
    
    # Convert datetime to ISO string if present
    if "updated_at" in prefs and hasattr(prefs["updated_at"], "isoformat"):
        prefs["updated_at"] = prefs["updated_at"].isoformat()
    
    return prefs


@router.put("/notifications/preferences")
def update_notification_preferences(
    preferences: dict,
    current_user: User = Depends(get_current_user),
):
    """Update user notification preferences."""
    prefs_repo = NotificationPreferencesRepository()
    updated = prefs_repo.update_preferences(current_user.id, preferences)
    
    # Convert datetime to ISO string
    if "updated_at" in updated and hasattr(updated["updated_at"], "isoformat"):
        updated["updated_at"] = updated["updated_at"].isoformat()
    
    return updated


@router.get("/notifications/analytics")
def get_notification_analytics(
    days: int = 30,
    current_user: User = Depends(get_current_user),
):
    """Get notification engagement analytics."""
    analytics_repo = NotificationAnalyticsRepository()
    stats = analytics_repo.get_engagement_stats(current_user.id, days=days)
    return stats

