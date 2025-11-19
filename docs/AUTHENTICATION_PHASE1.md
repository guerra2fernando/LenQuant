# Authentication Phase 1: Single User Implementation

Complete step-by-step guide to implementing authentication for single-user deployment.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Testing](#testing)
6. [Scripts & Automation](#scripts--automation)
7. [Deployment](#deployment)

---

## Overview

### What You'll Build

- ✅ Google OAuth login
- ✅ JWT-based API authentication
- ✅ Protected routes (frontend + backend)
- ✅ Whitelist (only your email can login)
- ✅ Scripts run with admin token
- ✅ Session management

### Timeline

- **Backend**: 2-3 hours
- **Frontend**: 2-3 hours
- **Testing**: 1 hour
- **Total**: ~6 hours

### What Won't Change

- ❌ Database schema (no `user_id` yet)
- ❌ Data ingestion scripts
- ❌ Existing functionality
- ❌ Multi-tenancy (Phase 2)

---

## Prerequisites

### 1. Google Cloud Setup

Complete the [Google Cloud Setup](./AUTHENTICATION.md#google-cloud-setup) section first.

You should have:
- ✅ Google OAuth Client ID
- ✅ Google OAuth Client Secret
- ✅ Authorized redirect URIs configured

### 2. Environment Variables

Add to `.env`:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here

# JWT Configuration
JWT_SECRET_KEY=your-jwt-secret-here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=60

# Phase 1: Whitelist
ALLOWED_GOOGLE_EMAILS=your-email@gmail.com

# Admin/Script Access
SYSTEM_ADMIN_TOKEN=your-admin-token-here
```

Generate secrets:
```bash
# Generate secrets using Python
python -c "import secrets; print('NEXTAUTH_SECRET=' + secrets.token_urlsafe(32))"
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(64))"
python -c "import secrets; print('SYSTEM_ADMIN_TOKEN=' + secrets.token_hex(32))"
```

### 3. Install Dependencies

**Backend**:
```bash
# Activate virtual environment
source .venv/bin/activate  # macOS/Linux
.venv\Scripts\activate     # Windows

# Install new packages
pip install python-jose[cryptography]==3.3.0
pip install passlib==1.7.4
pip install python-multipart==0.0.6
pip install google-auth==2.23.4

# Update requirements.txt
pip freeze > requirements.txt
```

**Frontend**:
```bash
cd web/next-app
npm install next-auth@4.24.5
cd ../..
```

---

## Backend Implementation

### Step 1: Create User Model

Create `db/models/user.py`:

```python
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
```

### Step 2: Create JWT Utilities

Create `api/auth/jwt.py`:

```python
"""JWT token creation and validation."""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt

from db.models.user import TokenData

# Configuration from environment
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRATION_MINUTES", "60"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Payload data to encode in token
        expires_delta: Optional custom expiration time
        
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
    })
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[TokenData]:
    """
    Decode and validate a JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        TokenData if valid, None if invalid
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("user_id")
        email: str = payload.get("email")
        exp: int = payload.get("exp")
        
        if user_id is None or email is None:
            return None
            
        return TokenData(user_id=user_id, email=email, exp=exp)
    except JWTError:
        return None


def verify_token(token: str) -> bool:
    """
    Verify if a token is valid.
    
    Args:
        token: JWT token string
        
    Returns:
        True if valid, False otherwise
    """
    token_data = decode_access_token(token)
    return token_data is not None
```

### Step 3: Create User Repository

Create `db/repositories/user_repository.py`:

```python
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
```

### Step 4: Create Auth Dependencies

Create `api/auth/dependencies.py`:

```python
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
```

### Step 5: Create Auth Routes

Create `api/routes/auth.py`:

```python
"""Authentication routes."""
from __future__ import annotations

import os
from datetime import timedelta
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, status
from google.auth.transport import requests
from google.oauth2 import id_token
from pydantic import BaseModel

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
```

### Step 6: Update Main API

Update `api/main.py`:

```python
from __future__ import annotations

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from api.routes import (
    admin,
    assistant,
    auth,  # Add this
    evolution,
    experiments,
    forecast,
    knowledge,
    leaderboard,
    learning,
    macro,
    models,
    reports,
    risk,
    runs,
    settings,
    strategies,
    trade,
)

app = FastAPI(title="LenQuant Core API")

# Update CORS for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://yourdomain.com",  # Add your production domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add auth router (PUBLIC - no authentication required)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

# Existing routers (will be protected in next step)
app.include_router(runs.router, prefix="/api/run")
app.include_router(reports.router, prefix="/api/reports")
app.include_router(models.router, prefix="/api/models")
app.include_router(leaderboard.router, prefix="/api/leaderboard")
app.include_router(strategies.router, prefix="/api/strategies")
app.include_router(settings.router, prefix="/api/settings")
app.include_router(forecast.router, prefix="/api/forecast")
app.include_router(evolution.router, prefix="/api/evolution")
app.include_router(experiments.router, prefix="/api/experiments")
app.include_router(assistant.router, prefix="/api/assistant")
app.include_router(learning.router, prefix="/api/learning")
app.include_router(knowledge.router, prefix="/api/knowledge")
app.include_router(admin.router, prefix="/api/admin")
app.include_router(trade.router, prefix="/api/trading")
app.include_router(risk.router, prefix="/api/risk")
app.include_router(macro.router, prefix="/api/macro")

# WebSocket endpoints
@app.websocket("/ws/trading")
async def websocket_trading(websocket: WebSocket):
    """WebSocket endpoint for real-time trading updates."""
    from api.routes.trade import websocket_trading as trading_ws
    await trading_ws(websocket)


# Health check endpoint (public)
@app.get("/api/status")
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
```

### Step 7: Protect Existing Routes

Now update one existing route as an example. Let's protect the forecast route.

Update `api/routes/forecast.py`:

```python
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

# Add this import
from api.auth.dependencies import get_current_user
from db.models.user import User

# ... existing imports ...

router = APIRouter()


@router.get("/{symbol}")
def get_forecast(
    symbol: str,
    horizon: str = Query("1h", description="Forecast horizon (1h, 4h, 1d)"),
    current_user: User = Depends(get_current_user),  # Add this
) -> Dict[str, Any]:
    """
    Get forecast for a symbol (PROTECTED).
    
    Now requires authentication.
    """
    # ... existing code ...
    # No changes to logic, just added auth dependency
```

**Repeat this pattern for all routes you want to protect.** For now, you can protect these critical routes:

- `/api/trading/*` - All trading endpoints
- `/api/models/*` - Model management
- `/api/strategies/*` - Strategy management
- `/api/forecast/*` - Forecasts
- `/api/admin/*` - Admin endpoints
- `/api/assistant/*` - AI assistant

**Leave these public (or protect later)**:
- `/api/status` - Health check
- `/api/auth/*` - Authentication endpoints

### Step 8: Create Database Indexes

Create `db/migrations/001_add_users.py`:

```python
"""Add users collection and indexes."""
from db.client import get_database_name, mongo_client


def migrate():
    """Create users collection with indexes."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Create indexes
        db.users.create_index("id", unique=True)
        db.users.create_index("email", unique=True)
        
        print("✅ Created users collection indexes")


if __name__ == "__main__":
    migrate()
```

Run migration:
```bash
python db/migrations/001_add_users.py
```

---

## Frontend Implementation

### Step 1: Install Dependencies

```bash
cd web/next-app
npm install next-auth@4.24.5
cd ../..
```

### Step 2: Configure NextAuth

Create `web/next-app/pages/api/auth/[...nextauth].ts`:

```typescript
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  
  callbacks: {
    async signIn({ user, account, profile }) {
      // This is called after Google authentication
      // We'll send the Google token to our backend
      
      if (!account || !account.id_token) {
        return false;
      }
      
      try {
        // Call our backend to verify and get JWT
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: account.id_token,
          }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          console.error('Backend authentication failed:', error);
          return false;
        }
        
        const data = await response.json();
        
        // Store our JWT token in the user object
        user.accessToken = data.access_token;
        user.backendUser = data.user;
        
        return true;
      } catch (error) {
        console.error('Authentication error:', error);
        return false;
      }
    },
    
    async jwt({ token, user, account }) {
      // Persist the OAuth access_token and backend JWT to the token right after signin
      if (user) {
        token.accessToken = user.accessToken;
        token.backendUser = user.backendUser;
      }
      return token;
    },
    
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string;
      session.user = token.backendUser as any;
      return session;
    },
  },
  
  pages: {
    signIn: '/login',
    error: '/login',
  },
  
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60, // 1 hour (match backend JWT expiration)
  },
  
  debug: process.env.NODE_ENV === 'development',
};

export default NextAuth(authOptions);
```

### Step 3: Update Next.js Environment

Create/update `web/next-app/.env.local`:

```env
# Google OAuth (copy from main .env)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Step 4: Extend Next.js Types

Create `web/next-app/types/next-auth.d.ts`:

```typescript
import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      picture?: string;
      is_admin: boolean;
    };
  }

  interface User {
    accessToken?: string;
    backendUser?: any;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    backendUser?: any;
  }
}
```

### Step 5: Create Login Page

Create `web/next-app/pages/login.tsx`:

```tsx
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Redirect to home if already logged in
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  const handleGoogleLogin = () => {
    signIn("google", { callbackUrl: "/" });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            LenQuant
          </h1>
          <p className="text-gray-600">
            AI-Powered Cryptocurrency Trading System
          </p>
        </div>

        <div className="mt-8">
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-gray-700 font-medium">
              Sign in with Google
            </span>
          </button>

          <p className="mt-4 text-sm text-gray-500 text-center">
            Secure authentication powered by Google OAuth 2.0
          </p>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>By signing in, you agree to our</p>
          <p>
            <a href="/terms" className="text-indigo-600 hover:text-indigo-500">
              Terms of Service
            </a>
            {" and "}
            <a href="/privacy" className="text-indigo-600 hover:text-indigo-500">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// This page is public
LoginPage.auth = false;
```

### Step 6: Create Middleware for Route Protection

Create `web/next-app/middleware.ts`:

```typescript
import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /login (login page)
     * - /api/auth/* (NextAuth endpoints)
     * - /_next/* (Next.js internals)
     * - /favicon.ico, /robots.txt, etc. (static files)
     */
    "/((?!login|api/auth|_next|favicon.ico|robots.txt).*)",
  ],
};
```

### Step 7: Update _app.tsx

Update `web/next-app/pages/_app.tsx`:

```tsx
import { SessionProvider, useSession } from "next-auth/react";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import "../styles/globals.css";

function Auth({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isLoading = status === "loading";
  const isUnauthenticated = status === "unauthenticated";

  useEffect(() => {
    if (isUnauthenticated) {
      router.push("/login");
    }
  }, [isUnauthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isUnauthenticated) {
    return null;
  }

  return <>{children}</>;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      {/* @ts-ignore */}
      {Component.auth === false ? (
        <Component {...pageProps} />
      ) : (
        <Auth>
          <Component {...pageProps} />
        </Auth>
      )}
    </SessionProvider>
  );
}
```

### Step 8: Update API Client

Update `web/next-app/lib/api.ts` to include JWT:

```typescript
import { getSession } from "next-auth/react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getAuthHeaders(): Promise<HeadersInit> {
  const session = await getSession();
  
  if (!session?.accessToken) {
    return {
      "Content-Type": "application/json",
    };
  }
  
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${session.accessToken}`,
  };
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "GET",
    headers,
  });
  
  if (response.status === 401) {
    // Token expired, redirect to login
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "API request failed");
  }
  
  return response.json();
}

export async function apiPost<T>(endpoint: string, data: any): Promise<T> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  
  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "API request failed");
  }
  
  return response.json();
}

// Add more methods as needed (apiPut, apiDelete, etc.)
```

### Step 9: Add User Menu to Layout

Update `web/next-app/components/Layout.tsx` to show user info:

```tsx
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/" className="flex items-center">
                <span className="text-xl font-bold text-gray-900">
                  LenQuant
                </span>
              </Link>
              
              {/* Navigation links */}
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link href="/trading" className="nav-link">
                  Trading
                </Link>
                <Link href="/forecasts" className="nav-link">
                  Forecasts
                </Link>
                <Link href="/strategies" className="nav-link">
                  Strategies
                </Link>
                <Link href="/analytics" className="nav-link">
                  Analytics
                </Link>
              </div>
            </div>
            
            {/* User menu */}
            <div className="flex items-center">
              <div className="flex items-center gap-3">
                {session?.user?.picture && (
                  <img
                    src={session.user.picture}
                    alt={session.user.name}
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-700">
                  {session?.user?.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      <main>{children}</main>
    </div>
  );
}
```

---

## Testing

### Step 1: Start Services

```bash
# Terminal 1: MongoDB (if not running)
mongod

# Terminal 2: Redis (if not running)
redis-server

# Terminal 3: Backend
cd lenxys-trader
source .venv/bin/activate
cd api
uvicorn main:app --reload

# Terminal 4: Frontend
cd web/next-app
npm run dev
```

### Step 2: Test Login Flow

1. **Open browser**: `http://localhost:3000`
2. **Should redirect to**: `/login`
3. **Click**: "Sign in with Google"
4. **Google OAuth**: Sign in with your whitelisted email
5. **Should redirect back**: to `/` (dashboard)
6. **Check**: User avatar/name in top right

### Step 3: Test Protected API

```bash
# Get forecast without auth (should fail)
curl http://localhost:8000/api/forecast/BTC-USDT?horizon=1h

# Expected: {"detail":"Not authenticated"}

# Login via frontend, then check browser dev tools
# Application → Cookies → next-auth.session-token

# Get the JWT token from session
# Then test with token:
curl -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  http://localhost:8000/api/forecast/BTC-USDT?horizon=1h

# Should return forecast data
```

### Step 4: Test System Admin Token

```bash
# Test with system admin token (for scripts)
export TOKEN=$(grep SYSTEM_ADMIN_TOKEN .env | cut -d= -f2)

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/forecast/BTC-USDT?horizon=1h

# Should work (system user)
```

### Step 5: Test Logout

1. **Click logout** in UI
2. **Should redirect to**: `/login`
3. **Try accessing protected route**: Should redirect to login

---

## Scripts & Automation

### Update Data Ingestion Script

Scripts need to use the system admin token.

Create `scripts/run_with_auth.sh`:

```bash
#!/bin/bash
# Wrapper script to run commands with system admin token

# Load environment variables
set -a
source .env
set +a

# Export token for Python scripts
export SYSTEM_ADMIN_TOKEN

# Run the command passed as arguments
exec "$@"
```

Usage:
```bash
chmod +x scripts/run_with_auth.sh

# Run data fetcher with auth
./scripts/run_with_auth.sh python -m data_ingest.fetcher

# Run training with auth
./scripts/run_with_auth.sh python scripts/run_retraining.py
```

### Update Python Scripts to Use Token

Update scripts that call the API to include the admin token.

Example - update any script that makes API calls:

```python
import os
import requests

def get_api_headers():
    """Get headers with system admin token."""
    token = os.getenv("SYSTEM_ADMIN_TOKEN")
    if not token:
        raise ValueError("SYSTEM_ADMIN_TOKEN not set in environment")
    
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

# Example usage
response = requests.get(
    "http://localhost:8000/api/forecast/BTC-USDT",
    headers=get_api_headers()
)
```

### Update Cron Jobs

Update your cron jobs to source the environment:

```cron
# Edit crontab
crontab -e

# Add this line to fetch data every hour
0 * * * * cd /path/to/lenxys-trader && /path/to/scripts/run_with_auth.sh /path/to/.venv/bin/python -m data_ingest.fetcher
```

---

## Deployment

### Step 1: Update Production Environment

Create `.env.production`:

```env
# Google OAuth (Production)
GOOGLE_CLIENT_ID=your-production-client-id
GOOGLE_CLIENT_SECRET=your-production-secret

# NextAuth (Production)
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=strong-random-secret-here

# JWT (Production)
JWT_SECRET_KEY=strong-random-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=60

# Whitelist
ALLOWED_GOOGLE_EMAILS=your-email@gmail.com

# System Token
SYSTEM_ADMIN_TOKEN=strong-admin-token-here

# Database (Production)
MONGO_URI=mongodb://production-host:27017/lenquant

# Redis (Production)
CELERY_BROKER_URL=redis://production-host:6379/0
```

### Step 2: Update Google OAuth Redirect URIs

1. **Go to Google Cloud Console**
2. **APIs & Services** → **Credentials**
3. **Edit OAuth Client ID**
4. **Add production redirect URI**:
   - `https://yourdomain.com/api/auth/callback/google`
5. **Add production origin**:
   - `https://yourdomain.com`

### Step 3: Deploy Backend

```bash
# On production server
cd /path/to/lenxys-trader
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python db/migrations/001_add_users.py

# Start with gunicorn (production server)
gunicorn api.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --env PRODUCTION=1
```

### Step 4: Deploy Frontend

```bash
cd web/next-app

# Build production version
npm run build

# Start production server
npm start

# Or use PM2 for process management
pm2 start npm --name "lenquant-web" -- start
```

### Step 5: Configure Nginx (Recommended)

Create `/etc/nginx/sites-available/lenquant`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL configuration
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;
    
    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
    
    # WebSocket
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/lenquant /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 6: SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is set up automatically
```

---

## Verification Checklist

- [ ] Google OAuth configured in Cloud Console
- [ ] Environment variables set correctly
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can access login page (`/login`)
- [ ] Can login with Google
- [ ] Redirected to dashboard after login
- [ ] User info displayed in header
- [ ] Protected API routes return 401 without token
- [ ] Protected API routes work with token
- [ ] Scripts work with admin token
- [ ] Logout works correctly
- [ ] Can't access protected routes after logout

---

## Next Steps

1. ✅ **Test thoroughly** in development
2. ✅ **Deploy to production** following deployment guide
3. ✅ **Monitor logs** for any auth issues
4. ✅ **Set up SSL** for production
5. ⏭️ **Plan Phase 2** when ready for multi-user

---

## Troubleshooting

See [AUTHENTICATION.md](./AUTHENTICATION.md#troubleshooting) for common issues and solutions.

---

**🎉 Congratulations! Your system is now protected with Google OAuth authentication.**

**For multi-user support, see [Phase 2 Implementation Guide](./AUTHENTICATION_PHASE2.md)**

