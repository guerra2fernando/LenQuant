# Authentication Phase 2: Multi-User Implementation

Complete guide to transitioning from single-user to multi-user system with full data segregation.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Changes](#architecture-changes)
3. [Database Migration](#database-migration)
4. [Backend Updates](#backend-updates)
5. [Frontend Updates](#frontend-updates)
6. [Admin Panel](#admin-panel)
7. [User Quotas & Rate Limiting](#user-quotas--rate-limiting)
8. [Testing](#testing)
9. [Deployment](#deployment)

---

## Overview

### What Changes in Phase 2

**Phase 1 → Phase 2 Transition**:

| Aspect | Phase 1 (Current) | Phase 2 (Multi-User) |
|--------|-------------------|----------------------|
| User Access | Whitelist (only you) | Open signups (configurable) |
| Data Isolation | None (single user) | By `user_id` field |
| API Keys | System-wide | Per-user, encrypted |
| Strategies | Global | User-specific |
| Models | Global | User-specific |
| Trading | Single account | Multiple user accounts |
| Admin Access | All users are admin | Role-based (admin/user) |
| Quotas | None | Per-user limits |

### Timeline

- **Backend Updates**: 4-6 hours
- **Frontend Updates**: 3-4 hours
- **Admin Panel**: 4-5 hours
- **Testing**: 2-3 hours
- **Total**: 2-3 days

### Goals

1. ✅ Allow multiple users to sign up
2. ✅ Isolate user data (strategies, models, trades)
3. ✅ Share market data (OHLCV, features)
4. ✅ Admin panel for user management
5. ✅ User quotas and rate limits
6. ✅ Audit logging

---

## Architecture Changes

### Data Flow (Phase 2)

```
┌──────────────────────────────────────────┐
│  User A                                  │
│  - Strategies (user_id: A)               │
│  - Models (user_id: A)                   │
│  - Trades (user_id: A)                   │
│  - API Keys (user_id: A, encrypted)      │
└──────────────────────────────────────────┘
           ↓ Query filtered by user_id
┌──────────────────────────────────────────┐
│  Shared Market Data                      │
│  - OHLCV (no user_id)                    │
│  - Features (no user_id)                 │
│  - Macro Analysis (no user_id)           │
│  - Knowledge Base (no user_id)           │
└──────────────────────────────────────────┘
           ↑ Query filtered by user_id
┌──────────────────────────────────────────┐
│  User B                                  │
│  - Strategies (user_id: B)               │
│  - Models (user_id: B)                   │
│  - Trades (user_id: B)                   │
│  - API Keys (user_id: B, encrypted)      │
└──────────────────────────────────────────┘
```

### User Roles

| Role | Permissions |
|------|-------------|
| **admin** | - Manage all users<br>- View system-wide metrics<br>- Configure global settings<br>- Run system scripts<br>- Access all data (read-only) |
| **user** | - Manage own data only<br>- Create strategies/models<br>- Execute trades<br>- View own history |

---

---

## Backend Updates

### Step 1: Add User Settings Model

Create `db/models/user_settings.py`:

```python
"""User settings model."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class TradingSettings(BaseModel):
    """Trading-specific settings."""
    
    account_mode: str = Field(default="paper", description="paper, testnet, live")
    daily_loss_limit_usd: float = Field(default=100.0)
    max_position_size_usd: float = Field(default=500.0)
    max_total_exposure_usd: float = Field(default=1000.0)
    stop_loss_pct: float = Field(default=2.0)


class ExchangeCredentials(BaseModel):
    """Exchange API credentials (encrypted)."""
    
    exchange: str = Field(..., description="Exchange name (binance, coinbase, etc)")
    api_key_encrypted: str = Field(..., description="Encrypted API key")
    api_secret_encrypted: str = Field(..., description="Encrypted API secret")
    is_testnet: bool = Field(default=False)


class UserSettings(BaseModel):
    """User settings."""
    
    user_id: str
    trading: TradingSettings = Field(default_factory=TradingSettings)
    exchange_credentials: Optional[ExchangeCredentials] = None
    notifications_enabled: bool = Field(default=True)
    email_reports: bool = Field(default=True)
    
    # Quotas
    max_strategies: int = Field(default=50)
    max_models: int = Field(default=100)
    max_api_calls_per_hour: int = Field(default=1000)
    storage_limit_mb: int = Field(default=1000)
```

### Step 2: Update Route Handlers to Filter by User

Example - Update `api/routes/strategies.py`:

```python
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from api.auth.dependencies import get_current_user
from db.client import get_database_name, mongo_client
from db.models.user import User

router = APIRouter()


@router.get("/")
def list_strategies(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
) -> Dict[str, List[Dict[str, Any]]]:
    """
    List strategies for current user (PHASE 2).
    
    Now filtered by user_id.
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Filter by user_id
        strategies = list(
            db.strategies.find({"user_id": current_user.id})
            .sort("created_at", -1)
            .limit(limit)
        )
        
        # Remove MongoDB _id
        for s in strategies:
            s.pop("_id", None)
        
        return {"strategies": strategies}


@router.post("/")
def create_strategy(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Create a new strategy for current user (PHASE 2).
    
    Automatically adds user_id.
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Check user quota
        count = db.strategies.count_documents({"user_id": current_user.id})
        if count >= 50:  # Default quota
            raise HTTPException(
                status_code=403,
                detail="Strategy quota exceeded. Delete old strategies or upgrade your plan.",
            )
        
        # Add user_id
        payload["user_id"] = current_user.id
        
        # Insert
        result = db.strategies.insert_one(payload)
        payload["_id"] = str(result.inserted_id)
        
        return {"strategy": payload}


@router.get("/{strategy_id}")
def get_strategy(
    strategy_id: str,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get strategy by ID (PHASE 2).
    
    Ensures user can only access their own strategies.
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Find strategy with user_id check
        strategy = db.strategies.find_one({
            "strategy_id": strategy_id,
            "user_id": current_user.id,  # Security: Only user's own strategy
        })
        
        if not strategy:
            raise HTTPException(
                status_code=404,
                detail="Strategy not found or access denied",
            )
        
        strategy.pop("_id", None)
        return {"strategy": strategy}


@router.delete("/{strategy_id}")
def delete_strategy(
    strategy_id: str,
    current_user: User = Depends(get_current_user),
) -> Dict[str, str]:
    """
    Delete strategy (PHASE 2).
    
    Only owner can delete.
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        
        result = db.strategies.delete_one({
            "strategy_id": strategy_id,
            "user_id": current_user.id,  # Security
        })
        
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=404,
                detail="Strategy not found or access denied",
            )
        
        return {"message": "Strategy deleted"}
```

**Repeat this pattern for all user-specific routes**:
- `api/routes/models.py` - Filter models by `user_id`
- `api/routes/experiments.py` - Filter experiments by `user_id`
- `api/routes/trade.py` - Filter positions/orders by `user_id`
- `api/routes/runs.py` - Filter simulation runs by `user_id`

### Step 3: Add User Management Routes

Create `api/routes/users.py`:

```python
"""User management routes (admin only)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from api.auth.dependencies import get_current_user
from db.client import get_database_name, mongo_client
from db.models.user import User

router = APIRouter()


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


@router.get("/")
def list_users(
    admin: User = Depends(require_admin),
    limit: int = 100,
) -> Dict[str, List[Dict[str, Any]]]:
    """List all users (admin only)."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        users = list(
            db.users.find()
            .sort("created_at", -1)
            .limit(limit)
        )
        
        for u in users:
            u.pop("_id", None)
        
        return {"users": users, "total": len(users)}


@router.get("/{user_id}")
def get_user(
    user_id: str,
    admin: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Get user details (admin only)."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        user = db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user.pop("_id", None)
        
        # Get user stats
        stats = {
            "strategies": db.strategies.count_documents({"user_id": user_id}),
            "models": db["models.registry"].count_documents({"user_id": user_id}),
            "experiments": db.experiments.count_documents({"user_id": user_id}),
            "positions": db.positions.count_documents({"user_id": user_id}),
        }
        
        return {"user": user, "stats": stats}


@router.patch("/{user_id}")
def update_user(
    user_id: str,
    payload: Dict[str, Any],
    admin: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Update user (admin only)."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Allowed fields to update
        allowed_fields = ["is_active", "is_admin", "name"]
        update_data = {k: v for k, v in payload.items() if k in allowed_fields}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        result = db.users.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"message": "User updated", "updated_fields": list(update_data.keys())}


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    admin: User = Depends(require_admin),
) -> Dict[str, str]:
    """
    Delete user and all associated data (admin only).
    
    WARNING: This is irreversible!
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Delete user
        result = db.users.delete_one({"id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Delete user's data
        db.strategies.delete_many({"user_id": user_id})
        db["models.registry"].delete_many({"user_id": user_id})
        db.experiments.delete_many({"user_id": user_id})
        db.sim_runs.delete_many({"user_id": user_id})
        db.positions.delete_many({"user_id": user_id})
        db.orders.delete_many({"user_id": user_id})
        db.user_settings.delete_many({"user_id": user_id})
        
        return {"message": f"User {user_id} and all associated data deleted"}


@router.get("/stats/system")
def system_stats(
    admin: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Get system-wide statistics (admin only)."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        return {
            "users": {
                "total": db.users.count_documents({}),
                "active": db.users.count_documents({"is_active": True}),
                "admins": db.users.count_documents({"is_admin": True}),
            },
            "data": {
                "strategies": db.strategies.count_documents({}),
                "models": db["models.registry"].count_documents({}),
                "experiments": db.experiments.count_documents({}),
                "ohlcv_candles": db.ohlcv.count_documents({}),
            },
            "trading": {
                "total_positions": db.positions.count_documents({}),
                "total_orders": db.orders.count_documents({}),
            },
        }
```

Update `api/main.py`:

```python
# Add users router
from api.routes import users

app.include_router(users.router, prefix="/api/users", tags=["users"])
```

### Step 4: Remove Whitelist and Allow Signups

Update `db/repositories/user_repository.py`:

```python
def is_email_allowed(email: str) -> bool:
    """
    Check if email is allowed to sign up.
    
    Phase 1: Whitelist only
    Phase 2: Configurable (whitelist or open signups)
    """
    import os
    
    # Check if signups are enabled
    allow_signups = os.getenv("ALLOW_SIGNUPS", "false").lower() == "true"
    
    if allow_signups:
        # Phase 2: Allow all signups
        return True
    
    # Phase 1/2: Check whitelist
    allowed_emails = os.getenv("ALLOWED_GOOGLE_EMAILS", "")
    if not allowed_emails:
        # No whitelist and signups disabled = no one can sign up
        return False
    
    allowed_list = [e.strip() for e in allowed_emails.split(",")]
    return email in allowed_list
```

Update `.env`:

```env
# Phase 2: Enable open signups
ALLOW_SIGNUPS=true

# Or keep whitelist (Phase 1 behavior)
ALLOW_SIGNUPS=false
ALLOWED_GOOGLE_EMAILS=your-email@gmail.com,another@gmail.com
```

---

## Frontend Updates

### Step 1: Add User Context

Update existing pages to show user-specific data only.

Example - `pages/strategies.tsx`:

```tsx
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

interface Strategy {
  strategy_id: string;
  name: string;
  user_id: string;
  created_at: string;
  // ... other fields
}

export default function StrategiesPage() {
  const { data: session } = useSession();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async () => {
    try {
      const data = await apiGet<{ strategies: Strategy[] }>("/api/strategies");
      setStrategies(data.strategies);
    } catch (error) {
      console.error("Failed to load strategies:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Strategies</h1>
        <p className="text-gray-600">
          User: {session?.user?.email}
        </p>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : strategies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No strategies yet</p>
          <button className="mt-4 btn-primary">Create Strategy</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {strategies.map((strategy) => (
            <div key={strategy.strategy_id} className="card">
              <h3>{strategy.name}</h3>
              <p className="text-sm text-gray-500">
                Created: {new Date(strategy.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 text-sm text-gray-500">
        {strategies.length} / 50 strategies used
      </div>
    </div>
  );
}
```

### Step 2: Add Admin Panel

Create `pages/admin/users.tsx`:

```tsx
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiDelete } from "../../lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  created_at: string;
  last_login: string;
  is_active: boolean;
  is_admin: boolean;
}

interface UserStats {
  strategies: number;
  models: number;
  experiments: number;
  positions: number;
}

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);

  useEffect(() => {
    // Check if user is admin
    if (session && !session.user.is_admin) {
      router.push("/");
      return;
    }

    loadUsers();
  }, [session]);

  const loadUsers = async () => {
    try {
      const data = await apiGet<{ users: User[] }>("/api/users");
      setUsers(data.users);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetails = async (userId: string) => {
    try {
      const data = await apiGet<{ user: User; stats: UserStats }>(
        `/api/users/${userId}`
      );
      setSelectedUser(data.user);
      setUserStats(data.stats);
    } catch (error) {
      console.error("Failed to load user details:", error);
    }
  };

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await apiPatch(`/api/users/${userId}`, { is_active: !isActive });
      loadUsers();
      alert(`User ${!isActive ? "activated" : "deactivated"}`);
    } catch (error) {
      alert("Failed to update user");
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Delete this user and all their data? This cannot be undone!")) {
      return;
    }

    try {
      await apiDelete(`/api/users/${userId}`);
      loadUsers();
      setSelectedUser(null);
      alert("User deleted");
    } catch (error) {
      alert("Failed to delete user");
    }
  };

  if (!session?.user?.is_admin) {
    return <div>Access denied</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">User Management</h1>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User List */}
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Users ({users.length})
            </h2>
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                    selectedUser?.id === user.id ? "border-blue-500" : ""
                  }`}
                  onClick={() => loadUserDetails(user.id)}
                >
                  <div className="flex items-center gap-3">
                    {user.picture && (
                      <img
                        src={user.picture}
                        alt={user.name}
                        className="w-10 h-10 rounded-full"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.name}</span>
                        {user.is_admin && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                            Admin
                          </span>
                        )}
                        {!user.is_active && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Details */}
          <div>
            {selectedUser ? (
              <div className="border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">User Details</h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600">Email</label>
                    <p className="font-medium">{selectedUser.email}</p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">Created</label>
                    <p className="font-medium">
                      {new Date(selectedUser.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">Last Login</label>
                    <p className="font-medium">
                      {new Date(selectedUser.last_login).toLocaleString()}
                    </p>
                  </div>

                  {userStats && (
                    <div>
                      <label className="text-sm text-gray-600 block mb-2">
                        Statistics
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-blue-50 p-3 rounded">
                          <div className="text-2xl font-bold text-blue-600">
                            {userStats.strategies}
                          </div>
                          <div className="text-xs text-gray-600">Strategies</div>
                        </div>
                        <div className="bg-green-50 p-3 rounded">
                          <div className="text-2xl font-bold text-green-600">
                            {userStats.models}
                          </div>
                          <div className="text-xs text-gray-600">Models</div>
                        </div>
                        <div className="bg-purple-50 p-3 rounded">
                          <div className="text-2xl font-bold text-purple-600">
                            {userStats.experiments}
                          </div>
                          <div className="text-xs text-gray-600">
                            Experiments
                          </div>
                        </div>
                        <div className="bg-yellow-50 p-3 rounded">
                          <div className="text-2xl font-bold text-yellow-600">
                            {userStats.positions}
                          </div>
                          <div className="text-xs text-gray-600">Positions</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t space-y-2">
                    <button
                      onClick={() =>
                        toggleUserStatus(
                          selectedUser.id,
                          selectedUser.is_active
                        )
                      }
                      className={`w-full px-4 py-2 rounded ${
                        selectedUser.is_active
                          ? "bg-yellow-500 hover:bg-yellow-600"
                          : "bg-green-500 hover:bg-green-600"
                      } text-white`}
                    >
                      {selectedUser.is_active ? "Deactivate" : "Activate"} User
                    </button>

                    <button
                      onClick={() => deleteUser(selectedUser.id)}
                      className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
                    >
                      Delete User
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg p-6 text-center text-gray-500">
                Select a user to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 3: Add Admin Link to Navigation

Update `components/Layout.tsx`:

```tsx
// Add admin link if user is admin
{session?.user?.is_admin && (
  <Link href="/admin/users" className="nav-link">
    Admin
  </Link>
)}
```

---

## User Quotas & Rate Limiting

### Step 1: Add Rate Limiting Middleware

Install dependencies:

```bash
pip install slowapi==0.1.9
```

Create `api/middleware/rate_limit.py`:

```python
"""Rate limiting middleware."""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
```

Update `api/main.py`:

```python
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from api.middleware.rate_limit import limiter

app = FastAPI(title="LenQuant Core API")

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Apply to routes:

```python
from api.middleware.rate_limit import limiter

@router.get("/forecast/{symbol}")
@limiter.limit("100/hour")  # 100 requests per hour per user
def get_forecast(
    symbol: str,
    current_user: User = Depends(get_current_user),
):
    # ... existing code ...
```

### Step 2: Implement Quota Checks

Create `api/middleware/quotas.py`:

```python
"""User quota checks."""
from __future__ import annotations

from fastapi import HTTPException, status

from db.client import get_database_name, mongo_client
from db.models.user import User


def check_strategy_quota(user: User) -> None:
    """Check if user can create more strategies."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        count = db.strategies.count_documents({"user_id": user.id})
        max_strategies = 50  # TODO: Get from user settings
        
        if count >= max_strategies:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Strategy quota exceeded ({count}/{max_strategies}). "
                       "Delete old strategies or upgrade your plan.",
            )


def check_model_quota(user: User) -> None:
    """Check if user can create more models."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        count = db["models.registry"].count_documents({"user_id": user.id})
        max_models = 100  # TODO: Get from user settings
        
        if count >= max_models:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Model quota exceeded ({count}/{max_models}). "
                       "Delete old models or upgrade your plan.",
            )
```

Use in routes:

```python
from api.middleware.quotas import check_strategy_quota

@router.post("/")
def create_strategy(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    # Check quota before creating
    check_strategy_quota(current_user)
    
    # ... rest of code ...
```

---

## Testing

### Test Plan

1. **User Isolation**:
   - Create two test users
   - User A creates strategy
   - User B tries to access User A's strategy → Should fail

2. **Quotas**:
   - Create 50 strategies
   - Try to create 51st → Should fail with quota error

3. **Admin Access**:
   - Admin views all users
   - Admin deactivates user
   - Deactivated user tries to login → Should fail

4. **Shared Data**:
   - User A and User B both fetch BTC/USDT forecast
   - Both should see same market data
   - But different personal strategies

### Automated Tests

Create `tests/test_user_isolation.py`:

```python
"""Test user data isolation."""
import pytest

from api.auth.jwt import create_access_token
from db.models.user import User


@pytest.fixture
def user_a():
    return User(
        id="user_a",
        email="user_a@test.com",
        name="User A",
        is_admin=False,
    )


@pytest.fixture
def user_b():
    return User(
        id="user_b",
        email="user_b@test.com",
        name="User B",
        is_admin=False,
    )


@pytest.fixture
def token_a(user_a):
    return create_access_token({"user_id": user_a.id, "email": user_a.email})


@pytest.fixture
def token_b(user_b):
    return create_access_token({"user_id": user_b.id, "email": user_b.email})


def test_user_cannot_access_other_user_strategies(client, token_a, token_b):
    """Test that users cannot access each other's strategies."""
    # User A creates strategy
    response = client.post(
        "/api/strategies",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"name": "My Strategy", "params": {}},
    )
    assert response.status_code == 200
    strategy_id = response.json()["strategy"]["strategy_id"]
    
    # User B tries to access User A's strategy
    response = client.get(
        f"/api/strategies/{strategy_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert response.status_code == 404  # Not found (or 403 Forbidden)


def test_shared_market_data_accessible(client, token_a, token_b):
    """Test that market data is accessible to all users."""
    # User A gets forecast
    response_a = client.get(
        "/api/forecast/BTC-USDT",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert response_status_code == 200
    
    # User B gets same forecast
    response_b = client.get(
        "/api/forecast/BTC-USDT",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert response_b.status_code == 200
    
    # Should return same data (market data is shared)
    assert response_a.json()["symbol"] == response_b.json()["symbol"]
```

Run tests:

```bash
pytest tests/test_user_isolation.py -v
```

---

## Deployment

### Step 1: Update Environment Variables

```env
# Phase 2 Configuration
ALLOW_SIGNUPS=true  # Enable public signups

# Remove whitelist (or keep for additional restriction)
# ALLOWED_GOOGLE_EMAILS=

# Keep other variables same as Phase 1
```

### Step 2: Run Migration

```bash
# On production server
export MIGRATION_USER_ID="your-google-id"
python db/migrations/002_add_user_id_to_collections.py
```

### Step 3: Deploy Updated Code

```bash
# Backend
git pull
pip install -r requirements.txt
sudo systemctl restart lenquant-api

# Frontend
cd web/next-app
git pull
npm install
npm run build
sudo systemctl restart lenquant-web
```

### Step 4: Verify Deployment

1. Login as your admin account
2. Check `/admin/users` page
3. Open incognito window
4. Create new test user account
5. Verify data isolation

---

## Rollback Plan

If issues occur:

```bash
# Restore database from backup
mongorestore --uri="mongodb://localhost:27017/lenquant" backup_before_phase2/

# Revert code
git revert <commit-hash>

# Restart services
sudo systemctl restart lenquant-api cryptotrader-web
```

---

## Next Steps After Phase 2

1. **Billing & Subscriptions**: Integrate Stripe for paid plans
2. **Enhanced Quotas**: Tiered plans (Free, Pro, Enterprise)
3. **Team Features**: Allow users to share strategies
4. **API Keys**: Public API for users to access their data
5. **Webhooks**: Notify users of trade executions
6. **Mobile App**: React Native app with same auth

---

**🎉 Congratulations! Your system now supports multiple users with complete data isolation.**

For questions or issues, refer to:
- [Main Authentication Guide](./AUTHENTICATION.md)
- [Phase 1 Guide](./AUTHENTICATION_PHASE1.md)

