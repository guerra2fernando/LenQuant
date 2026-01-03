"""
API routes for Chrome extension authentication.

Supports:
- Google OAuth (same identity as web)
- Email registration (extension-only)
- License validation
- Usage tracking
"""
from __future__ import annotations

import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel, EmailStr, Field

from db.client import get_database_name, mongo_client
from db.repositories.user_repository import (
    TIER_FEATURES,
    check_extension_access,
    check_trial_status,
    create_extension_user,
    get_user_by_device_id,
    get_user_by_email,
    update_extension_last_active,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Configuration
LICENSE_SECRET = os.getenv("EXT_LICENSE_SECRET", "default-secret-change-me")


def _utcnow() -> datetime:
    return datetime.utcnow().replace(tzinfo=timezone.utc)


def _generate_license_token(email: str, device_id: str, tier: str) -> str:
    """Generate license token for validation."""
    payload = f"{email}:{device_id}:{tier}:{LICENSE_SECRET}"
    return hashlib.sha256(payload.encode()).hexdigest()[:32]


# ============================================================================
# Request/Response Models
# ============================================================================


class GoogleAuthRequest(BaseModel):
    """Google OAuth authentication request."""
    google_token: str = Field(..., description="Google ID token")
    device_fingerprint: Optional[str] = None


class EmailAuthRequest(BaseModel):
    """Email registration request."""
    email: EmailStr
    device_fingerprint: Optional[str] = None


class AuthResponse(BaseModel):
    """Authentication response."""
    success: bool
    user_id: str
    email: str
    device_id: str
    license_token: str
    tier: str
    trial_ends_at: Optional[str] = None
    features: List[str]
    message: str
    auth_method: str


class ValidateRequest(BaseModel):
    """License validation request."""
    email: str
    device_id: str
    license_token: Optional[str] = None


class ValidateResponse(BaseModel):
    """License validation response."""
    valid: bool
    tier: str
    features: List[str]
    trial_remaining_hours: Optional[float] = None
    needs_upgrade: bool = False
    upgrade_message: Optional[str] = None


class UsageRequest(BaseModel):
    """Usage tracking request."""
    email: str
    device_id: str
    action: str  # analysis, explain, journal


# ============================================================================
# Google OAuth Authentication
# ============================================================================


@router.post("/google", response_model=AuthResponse)
async def auth_with_google(payload: GoogleAuthRequest) -> Dict[str, Any]:
    """
    Authenticate extension user with Google OAuth.

    This uses the same Google identity as the web platform but:
    - Does NOT require web_access flag
    - Creates extension-specific data (device_id, trial, etc.)
    - Returns extension license token
    """
    logger.info("Extension Google auth request")

    try:
        # Verify Google token
        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        if not google_client_id:
            raise HTTPException(500, "Google OAuth not configured")

        idinfo = id_token.verify_oauth2_token(
            payload.google_token,
            google_requests.Request(),
            google_client_id,
        )

        google_id = idinfo["sub"]
        email = idinfo["email"]
        name = idinfo.get("name", email.split("@")[0])
        picture = idinfo.get("picture")

    except ValueError as e:
        raise HTTPException(401, f"Invalid Google token: {str(e)}")

    # Check if user exists
    existing_user = get_user_by_email(email)

    if existing_user:
        # User exists - check if they used email registration
        if existing_user.auth_method == "email":
            # User registered with email - link to Google account
            with mongo_client() as client:
                db = client[get_database_name()]
                db.users.update_one(
                    {"email": email.lower()},
                    {"$set": {
                        "id": f"google_{google_id}",
                        "auth_method": "google",
                        "name": name,
                        "picture": picture,
                        "updated_at": _utcnow(),
                    }}
                )
            existing_user = get_user_by_email(email)

        # Return existing license
        tier = existing_user.extension.tier

        # Check trial status
        trial_info = check_trial_status(existing_user)
        if trial_info.get("expired"):
            tier = "expired"

        device_id = existing_user.extension.device_id
        features = existing_user.extension.features or TIER_FEATURES.get(tier, ["basic_analysis"])
        license_token = _generate_license_token(email, device_id, tier)

        logger.info("Google auth: returning existing user %s", email)

        return {
            "success": True,
            "user_id": existing_user.id,
            "email": email,
            "device_id": device_id,
            "license_token": license_token,
            "tier": tier,
            "trial_ends_at": existing_user.extension.trial_ends_at.isoformat() if existing_user.extension.trial_ends_at else None,
            "features": features,
            "message": f"Welcome back! Your account tier: {tier}",
            "auth_method": "google",
        }

    # Create new user
    user = create_extension_user(
        email=email,
        auth_method="google",
        name=name,
        picture=picture,
        google_id=google_id,
        device_fingerprint=payload.device_fingerprint,
    )

    license_token = _generate_license_token(email, user.extension.device_id, user.extension.tier)

    logger.info("Google auth: created new user %s", email)

    return {
        "success": True,
        "user_id": user.id,
        "email": email,
        "device_id": user.extension.device_id,
        "license_token": license_token,
        "tier": user.extension.tier,
        "trial_ends_at": user.extension.trial_ends_at.isoformat() if user.extension.trial_ends_at else None,
        "features": user.extension.features,
        "message": "Welcome! Your 3-day Pro trial has started.",
        "auth_method": "google",
    }


# ============================================================================
# Email Registration
# ============================================================================


@router.post("/email", response_model=AuthResponse)
def auth_with_email(payload: EmailAuthRequest) -> Dict[str, Any]:
    """
    Register/login extension user with email.

    For users who don't want to use Google OAuth.
    """
    logger.info("Extension email auth: %s", payload.email)

    email = payload.email.lower()

    # Check if user exists
    existing_user = get_user_by_email(email)

    if existing_user:
        # User exists
        if existing_user.auth_method == "google":
            # User registered with Google - tell them to use Google
            raise HTTPException(
                400,
                "This email is linked to a Google account. Please sign in with Google."
            )

        # Email user exists - return existing license
        tier = existing_user.extension.tier

        # Check trial status
        trial_info = check_trial_status(existing_user)
        if trial_info.get("expired"):
            tier = "expired"

        device_id = existing_user.extension.device_id
        features = existing_user.extension.features or TIER_FEATURES.get(tier, ["basic_analysis"])
        license_token = _generate_license_token(email, device_id, tier)

        logger.info("Email auth: returning existing user %s", email)

        return {
            "success": True,
            "user_id": existing_user.id,
            "email": email,
            "device_id": device_id,
            "license_token": license_token,
            "tier": tier,
            "trial_ends_at": existing_user.extension.trial_ends_at.isoformat() if existing_user.extension.trial_ends_at else None,
            "features": features,
            "message": f"Welcome back! Your account tier: {tier}",
            "auth_method": "email",
        }

    # Create new user
    user = create_extension_user(
        email=email,
        auth_method="email",
        device_fingerprint=payload.device_fingerprint,
    )

    license_token = _generate_license_token(email, user.extension.device_id, user.extension.tier)

    logger.info("Email auth: created new user %s", email)

    return {
        "success": True,
        "user_id": user.id,
        "email": email,
        "device_id": user.extension.device_id,
        "license_token": license_token,
        "tier": user.extension.tier,
        "trial_ends_at": user.extension.trial_ends_at.isoformat() if user.extension.trial_ends_at else None,
        "features": user.extension.features,
        "message": "Welcome! Your 3-day Pro trial has started.",
        "auth_method": "email",
    }


# ============================================================================
# License Validation
# ============================================================================


@router.post("/validate", response_model=ValidateResponse)
def validate_license(payload: ValidateRequest) -> Dict[str, Any]:
    """
    Validate extension license.

    Called on extension startup and periodically to verify access.
    """
    # Find user by email + device_id combination
    user = get_user_by_email(payload.email.lower())

    if not user:
        return {
            "valid": False,
            "tier": "expired",
            "features": ["basic_analysis"],
            "needs_upgrade": True,
            "upgrade_message": "Account not found. Please register again.",
        }

    # Verify device_id matches
    if user.extension.device_id != payload.device_id:
        return {
            "valid": False,
            "tier": "expired",
            "features": ["basic_analysis"],
            "needs_upgrade": True,
            "upgrade_message": "Device mismatch. Please re-authenticate.",
        }

    # Check extension access
    if not check_extension_access(user):
        return {
            "valid": False,
            "tier": "expired",
            "features": ["basic_analysis"],
            "needs_upgrade": True,
            "upgrade_message": "Extension access disabled for this account.",
        }

    tier = user.extension.tier

    # Check trial status
    trial_info = check_trial_status(user)

    if trial_info.get("expired"):
        return {
            "valid": True,
            "tier": "expired",
            "features": TIER_FEATURES["expired"],
            "needs_upgrade": True,
            "upgrade_message": "Your trial has ended. Upgrade to Pro to continue using all features.",
        }

    # Update last active
    update_extension_last_active(user.id)

    features = user.extension.features or TIER_FEATURES.get(tier, ["basic_analysis"])

    # Build response
    response = {
        "valid": True,
        "tier": tier,
        "features": features,
        "needs_upgrade": tier in ["expired", "free"],
    }

    if trial_info.get("is_trial") and not trial_info.get("expired"):
        response["trial_remaining_hours"] = trial_info.get("remaining_hours")
        if trial_info.get("remaining_hours", 72) < 24:
            response["needs_upgrade"] = True
            response["upgrade_message"] = f"Trial ends in {int(trial_info['remaining_hours'])} hours. Upgrade now!"

    return response


# ============================================================================
# User Info & Usage
# ============================================================================


@router.get("/user")
def get_user_info(
    email: str = Query(...),
    device_id: str = Query(...),
) -> Dict[str, Any]:
    """Get user account information."""
    user = get_user_by_email(email.lower())

    if not user:
        raise HTTPException(404, "User not found")

    if user.extension.device_id != device_id:
        raise HTTPException(403, "Device mismatch")

    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "auth_method": user.auth_method,
        "tier": user.extension.tier,
        "trial_ends_at": user.extension.trial_ends_at.isoformat() if user.extension.trial_ends_at else None,
        "features": user.extension.features,
        "subscription": user.extension.subscription.model_dump() if user.extension.subscription else None,
        "created_at": user.created_at.isoformat(),
    }


@router.get("/features")
def get_tier_features(
    tier: str = Query("free", description="Tier to get features for"),
) -> Dict[str, Any]:
    """Get available features for a tier."""
    return {
        "tier": tier,
        "features": TIER_FEATURES.get(tier, ["basic_analysis"]),
        "all_tiers": {k: v for k, v in TIER_FEATURES.items()},
    }


@router.post("/track-usage")
def track_usage(payload: UsageRequest) -> Dict[str, Any]:
    """Track feature usage for analytics and rate limiting."""
    user = get_user_by_email(payload.email.lower())

    if not user:
        return {"tracked": False, "error": "User not found"}

    if user.extension.device_id != payload.device_id:
        return {"tracked": False, "error": "Device mismatch"}

    with mongo_client() as client:
        db = client[get_database_name()]

        # Get current usage
        usage = user.extension.usage

        # Reset daily counts if new day
        if usage.last_active:
            if usage.last_active.date() < _utcnow().date():
                usage.analyses_today = 0
                usage.explains_today = 0

        # Increment usage
        if payload.action == "analysis":
            usage.analyses_today += 1
        elif payload.action == "explain":
            usage.explains_today += 1

        # Check limits for free/expired tier
        tier = user.extension.tier
        limit_reached = False

        if tier in ["free", "expired"]:
            if payload.action == "analysis" and usage.analyses_today > 10:
                limit_reached = True
            if payload.action == "explain":
                limit_reached = True  # Explain not available for free

        # Update in database
        db.users.update_one(
            {"id": user.id},
            {"$set": {
                "extension.usage.analyses_today": usage.analyses_today,
                "extension.usage.explains_today": usage.explains_today,
                "extension.usage.last_active": _utcnow(),
                "updated_at": _utcnow(),
            }}
        )

        return {
            "tracked": True,
            "action": payload.action,
            "usage_today": {
                "analyses": usage.analyses_today,
                "explains": usage.explains_today,
            },
            "limit_reached": limit_reached,
        }


