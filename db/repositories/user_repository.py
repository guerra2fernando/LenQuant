"""User repository for database operations."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from db.client import get_database_name, mongo_client
from db.models.user import User, UserInDB


def get_user_by_id(user_id: str) -> Optional[User]:
    """Get user by ID."""
    with mongo_client() as client:
        db = client[get_database_name()]
        user_doc = db.users.find_one({"id": user_id})
        
        if not user_doc:
            return None
        
        # Remove MongoDB _id field
        user_doc.pop("_id", None)
        return User(**user_doc)


def get_user_by_email(email: str) -> Optional[User]:
    """Get user by email."""
    with mongo_client() as client:
        db = client[get_database_name()]
        user_doc = db.users.find_one({"email": email})
        
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


def update_user_login(user_id: str) -> None:
    """Update user's last login timestamp."""
    with mongo_client() as client:
        db = client[get_database_name()]
        db.users.update_one(
            {"id": user_id},
            {"$set": {"last_login": datetime.utcnow()}}
        )


def is_email_allowed(email: str) -> bool:
    """Check if email is in whitelist (Phase 1)."""
    import os
    
    allowed_emails = os.getenv("ALLOWED_GOOGLE_EMAILS", "")
    if not allowed_emails:
        # If no whitelist, allow all (Phase 2 behavior)
        return True
    
    allowed_list = [e.strip() for e in allowed_emails.split(",")]
    return email in allowed_list

