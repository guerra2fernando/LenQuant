"""User model for authentication."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ExtensionSubscription(BaseModel):
    """Extension subscription details."""
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    plan: Optional[str] = None  # pro_monthly, pro_yearly, etc.
    status: Optional[str] = None  # active, canceled, past_due
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False


class ExtensionUsage(BaseModel):
    """Daily usage tracking."""
    analyses_today: int = 0
    explains_today: int = 0
    last_active: Optional[datetime] = None


class ExtensionData(BaseModel):
    """Extension-specific user data."""
    device_id: Optional[str] = None
    device_fingerprint: Optional[str] = None

    # Tier & Trial
    tier: str = "trial"  # free, trial, pro, premium, expired
    trial_started_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None

    # Subscription
    subscription: ExtensionSubscription = Field(default_factory=ExtensionSubscription)

    # Features & Usage
    features: List[str] = Field(default_factory=lambda: ["basic_analysis"])
    usage: ExtensionUsage = Field(default_factory=ExtensionUsage)


class User(BaseModel):
    """User model for authentication."""

    id: str = Field(..., description="User ID (google_xxx or email_xxx)")
    email: str = Field(..., description="User email")
    name: str = Field(..., description="User display name")
    picture: Optional[str] = Field(None, description="Avatar URL")

    # Authentication method
    auth_method: str = Field(default="google", description="google or email")

    # Platform Access Flags
    web_access: bool = Field(default=False, description="Can access web platform")
    extension_access: bool = Field(default=True, description="Can use extension")

    # Admin & Status
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)

    # Extension-specific data
    extension: ExtensionData = Field(default_factory=ExtensionData)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "id": "google_123456789",
                "email": "user@gmail.com",
                "name": "John Doe",
                "auth_method": "google",
                "web_access": False,
                "extension_access": True,
                "extension": {
                    "device_id": "dev_xxx",
                    "tier": "trial",
                }
            }
        }


class UserInDB(User):
    """User model as stored in database."""
    pass


class TokenData(BaseModel):
    """Token payload data."""
    
    user_id: str
    email: str
    exp: Optional[int] = None


class Token(BaseModel):
    """Token response."""
    
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: User

