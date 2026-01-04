"""User repository for database operations."""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from db.client import get_database_name, mongo_client
from db.models.user import ExtensionData, User, UserInDB

# Configuration
TRIAL_DAYS = int(os.getenv("EXT_TRIAL_DAYS", "3"))

# Feature definitions by tier
TIER_FEATURES = {
    "free": ["basic_analysis"],
    "trial": ["analysis", "ai_explain", "cloud_journal", "mtf_analysis", "behavioral"],
    "pro": ["analysis", "ai_explain", "cloud_journal", "mtf_analysis", "behavioral"],
    "premium": ["analysis", "ai_explain", "cloud_journal", "mtf_analysis", "behavioral",
                "trade_sync", "extended_journal", "priority_support"],
    "expired": ["basic_analysis"],
}


def _utcnow() -> datetime:
    return datetime.utcnow().replace(tzinfo=timezone.utc)


def _generate_device_id() -> str:
    """Generate unique device identifier."""
    return f"dev_{secrets.token_urlsafe(16)}"


def get_user_by_id(user_id: str) -> Optional[User]:
    """Get user by ID."""
    with mongo_client() as client:
        db = client[get_database_name()]
        user_doc = db.users.find_one({"id": user_id})

        if not user_doc:
            return None

        user_doc.pop("_id", None)
        return User(**user_doc)


def get_user_by_email(email: str) -> Optional[User]:
    """Get user by email."""
    with mongo_client() as client:
        db = client[get_database_name()]
        user_doc = db.users.find_one({"email": email.lower()})

        if not user_doc:
            return None

        user_doc.pop("_id", None)
        return User(**user_doc)


def get_user_by_device_id(device_id: str) -> Optional[User]:
    """Get user by extension device ID."""
    with mongo_client() as client:
        db = client[get_database_name()]
        user_doc = db.users.find_one({"extension.device_id": device_id})

        if not user_doc:
            return None

        user_doc.pop("_id", None)
        return User(**user_doc)


def create_user(user: User) -> User:
    """Create a new user."""
    with mongo_client() as client:
        db = client[get_database_name()]
        user_dict = user.model_dump()

        # Check if user already exists
        existing = db.users.find_one({"id": user.id})
        if existing:
            raise ValueError(f"User with ID {user.id} already exists")

        db.users.insert_one(user_dict)
        return user


def create_extension_user(
    email: str,
    auth_method: str,
    name: Optional[str] = None,
    picture: Optional[str] = None,
    google_id: Optional[str] = None,
    device_fingerprint: Optional[str] = None,
) -> User:
    """Create a new user from extension registration."""

    # Generate user ID based on auth method
    if auth_method == "google" and google_id:
        user_id = f"google_{google_id}"
    else:
        user_id = f"email_{secrets.token_urlsafe(16)}"

    # Generate device ID
    device_id = _generate_device_id()

    # Calculate trial end
    trial_ends = _utcnow() + timedelta(days=TRIAL_DAYS)

    user = User(
        id=user_id,
        email=email.lower(),
        name=name or email.split("@")[0],
        picture=picture,
        auth_method=auth_method,
        web_access=False,  # Extension users don't get web access by default
        extension_access=True,
        extension=ExtensionData(
            device_id=device_id,
            device_fingerprint=device_fingerprint,
            tier="trial",
            trial_started_at=_utcnow(),
            trial_ends_at=trial_ends,
            features=TIER_FEATURES["trial"],
        ),
        created_at=_utcnow(),
        updated_at=_utcnow(),
        last_login=_utcnow(),
    )

    with mongo_client() as client:
        db = client[get_database_name()]
        db.users.insert_one(user.model_dump())

    return user


def update_user_login(user_id: str) -> None:
    """Update user's last login timestamp."""
    with mongo_client() as client:
        db = client[get_database_name()]
        db.users.update_one(
            {"id": user_id},
            {"$set": {
                "last_login": _utcnow(),
                "updated_at": _utcnow(),
            }}
        )


def update_extension_last_active(user_id: str) -> None:
    """Update extension last active timestamp."""
    with mongo_client() as client:
        db = client[get_database_name()]
        db.users.update_one(
            {"id": user_id},
            {"$set": {
                "extension.usage.last_active": _utcnow(),
                "updated_at": _utcnow(),
            }}
        )


def is_email_allowed(email: str) -> bool:
    """Check if email is in whitelist for WEB access."""
    allowed_emails = os.getenv("ALLOWED_GOOGLE_EMAILS", "")
    if not allowed_emails:
        return True

    allowed_list = [e.strip().lower() for e in allowed_emails.split(",")]
    return email.lower() in allowed_list


def check_web_access(user: User) -> bool:
    """Check if user can access web platform."""
    if not user.is_active:
        return False
    return user.web_access == True


def check_extension_access(user: User) -> bool:
    """Check if user can access extension."""
    if not user.is_active:
        return False
    return user.extension_access == True


def grant_web_access(email: str) -> bool:
    """Grant web platform access to a user."""
    with mongo_client() as client:
        db = client[get_database_name()]
        result = db.users.update_one(
            {"email": email.lower()},
            {"$set": {
                "web_access": True,
                "updated_at": _utcnow(),
            }}
        )
        return result.modified_count > 0


def revoke_web_access(email: str) -> bool:
    """Revoke web platform access from a user."""
    with mongo_client() as client:
        db = client[get_database_name()]
        result = db.users.update_one(
            {"email": email.lower()},
            {"$set": {
                "web_access": False,
                "updated_at": _utcnow(),
            }}
        )
        return result.modified_count > 0


def update_extension_tier(user_id: str, tier: str, features: Optional[List[str]] = None) -> bool:
    """Update user's extension tier and features."""
    if features is None:
        features = TIER_FEATURES.get(tier, ["basic_analysis"])

    with mongo_client() as client:
        db = client[get_database_name()]
        result = db.users.update_one(
            {"id": user_id},
            {"$set": {
                "extension.tier": tier,
                "extension.features": features,
                "updated_at": _utcnow(),
            }}
        )
        return result.modified_count > 0


def check_trial_status(user: User) -> Dict[str, Any]:
    """Check and update trial status. Returns trial info."""
    if user.extension.tier != "trial":
        return {"is_trial": False, "tier": user.extension.tier}

    trial_ends = user.extension.trial_ends_at
    if trial_ends is None:
        return {"is_trial": True, "expired": True}

    now = _utcnow()

    # Ensure trial_ends is timezone-aware for comparison
    if trial_ends.tzinfo is None:
        trial_ends = trial_ends.replace(tzinfo=timezone.utc)

    if now > trial_ends:
        # Trial expired - update tier
        update_extension_tier(user.id, "expired")
        return {"is_trial": True, "expired": True, "tier": "expired"}

    # Trial still active
    remaining_hours = (trial_ends - now).total_seconds() / 3600
    return {
        "is_trial": True,
        "expired": False,
        "tier": "trial",
        "remaining_hours": round(remaining_hours, 1),
        "ends_at": trial_ends.isoformat(),
    }

