"""Authentication dependencies for FastAPI routes."""
from __future__ import annotations

import os
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from api.auth.jwt import decode_access_token
from db.models.user import User
from db.repositories.user_repository import get_user_by_id

# Security scheme for JWT
security = HTTPBearer()

# Admin token for scripts
SYSTEM_ADMIN_TOKEN = os.getenv("SYSTEM_ADMIN_TOKEN", "")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    """
    Get current authenticated user from JWT token.
    
    Dependency for protected routes.
    
    Args:
        credentials: HTTP Authorization header with Bearer token
        
    Returns:
        Current user object
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    token = credentials.credentials
    
    # Check if it's the system admin token
    if SYSTEM_ADMIN_TOKEN and token == SYSTEM_ADMIN_TOKEN:
        # Return a system user for scripts
        return User(
            id="system",
            email="system@lenquant.local",
            name="System",
            is_admin=True,
        )
    
    # Decode JWT token
    token_data = decode_access_token(token)
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database
    user = get_user_by_id(token_data.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current active user (alias for clarity)."""
    return current_user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
) -> Optional[User]:
    """
    Get current user if authenticated, None otherwise.
    
    Use for routes that are public but have enhanced features when authenticated.
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None

