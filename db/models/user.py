"""User model for authentication."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class User(BaseModel):
    """User model for authentication."""
    
    id: str = Field(..., description="User ID (Google ID)")
    email: str = Field(..., description="User email from Google")
    name: str = Field(..., description="User display name")
    picture: Optional[str] = Field(None, description="Avatar URL")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)

    class Config:
        json_schema_extra = {
            "example": {
                "id": "google_123456789",
                "email": "user@gmail.com",
                "name": "John Doe",
                "picture": "https://lh3.googleusercontent.com/a/...",
                "created_at": "2024-11-19T10:00:00",
                "last_login": "2024-11-19T10:00:00",
                "is_active": True,
                "is_admin": False,
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

