"""Authentication routes."""
from __future__ import annotations

import os
from datetime import timedelta
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests
from google.oauth2 import id_token
from pydantic import BaseModel

from api.auth.dependencies import get_current_user
from api.auth.jwt import ACCESS_TOKEN_EXPIRE_MINUTES, create_access_token
from db.models.user import Token, User
from db.repositories.user_repository import (
    create_user,
    get_user_by_email,
    is_email_allowed,
    update_user_login,
)

router = APIRouter()


class GoogleLoginRequest(BaseModel):
    """Request body for Google login."""
    
    token: str  # Google ID token from frontend


class GoogleLoginResponse(BaseModel):
    """Response for Google login."""
    
    access_token: str
    token_type: str
    expires_in: int
    user: User


@router.post("/google", response_model=Token)
async def login_with_google(request: GoogleLoginRequest) -> Token:
    """
    Authenticate with Google OAuth token.
    
    Flow:
    1. Frontend gets Google token via Google Sign-In
    2. Frontend sends token to this endpoint
    3. Backend verifies token with Google
    4. Backend creates/updates user in database
    5. Backend returns JWT token
    
    Args:
        request: Contains Google ID token
        
    Returns:
        JWT access token and user info
        
    Raises:
        HTTPException: If token invalid or email not allowed
    """
    try:
        # Verify Google token
        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        if not google_client_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google OAuth not configured",
            )
        
        # Verify the token with Google
        idinfo = id_token.verify_oauth2_token(
            request.token,
            requests.Request(),
            google_client_id,
        )
        
        # Extract user info from Google token
        google_id = idinfo["sub"]
        email = idinfo["email"]
        name = idinfo.get("name", email.split("@")[0])
        picture = idinfo.get("picture")
        
        # Check if email is allowed (Phase 1 whitelist)
        if not is_email_allowed(email):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Email {email} is not authorized to access this system",
            )
        
        # Get or create user
        user = get_user_by_email(email)
        
        if user is None:
            # Create new user
            user = User(
                id=f"google_{google_id}",
                email=email,
                name=name,
                picture=picture,
                is_admin=True,  # Phase 1: First user is admin
            )
            user = create_user(user)
        else:
            # Update last login
            update_user_login(user.id)
        
        # Create JWT token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"user_id": user.id, "email": user.email},
            expires_delta=access_token_expires,
        )
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # Convert to seconds
            user=user,
        )
        
    except ValueError as e:
        # Invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication failed: {str(e)}",
        )


@router.get("/me", response_model=User)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Get current authenticated user info.
    
    Protected endpoint that returns user profile.
    """
    return current_user


@router.post("/logout")
async def logout() -> Dict[str, str]:
    """
    Logout current user.
    
    In Phase 1, this is mostly a no-op since JWT tokens
    can't be invalidated. In Phase 2, we'll add token blacklist.
    
    Frontend should delete the token from storage.
    """
    return {"message": "Logged out successfully"}

