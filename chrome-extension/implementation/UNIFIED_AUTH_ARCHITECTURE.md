# Unified Authentication Architecture

**Version:** 1.0  
**Last Updated:** January 2026  
**Status:** Approved for Implementation

---

## 🎯 Goals

1. **Single User Identity** - One user account works across web platform and Chrome extension
2. **Multiple Auth Methods** - Support both Google OAuth and email registration
3. **Platform Access Control** - Separate flags for web vs extension access
4. **Subscription Unification** - One subscription/tier system for all platforms
5. **Future-Proof** - Easy to grant web access to extension users

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER AUTHENTICATION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────┐         ┌─────────────────────┐                   │
│   │   Chrome Extension  │         │    Web Platform      │                   │
│   │                     │         │                     │                   │
│   │  • Google OAuth ────┼────┐    │  • Google OAuth ────┼───────┐           │
│   │  • Email + Device   │    │    │    (NextAuth)       │       │           │
│   │    Registration     │    │    │                     │       │           │
│   └─────────────────────┘    │    └─────────────────────┘       │           │
│                              │                                   │           │
│                              ▼                                   ▼           │
│                    ┌─────────────────────────────────────────────┐           │
│                    │            UNIFIED AUTH API                 │           │
│                    │                                             │           │
│                    │  POST /api/v1/auth/google     ← Web OAuth   │           │
│                    │  POST /api/v1/auth/ext/google ← Ext OAuth   │           │
│                    │  POST /api/v1/auth/ext/email  ← Ext Email   │           │
│                    │  POST /api/v1/auth/ext/validate ← Ext Check │           │
│                    │                                             │           │
│                    └─────────────────────────────────────────────┘           │
│                                        │                                     │
│                                        ▼                                     │
│                    ┌─────────────────────────────────────────────┐           │
│                    │           UNIFIED USERS COLLECTION          │           │
│                    │                                             │           │
│                    │  {                                          │           │
│                    │    id: "google_xxx" | "email_xxx",          │           │
│                    │    email: "user@example.com",               │           │
│                    │    auth_method: "google" | "email",         │           │
│                    │                                             │           │
│                    │    // Platform Access                       │           │
│                    │    web_access: false,  ← Flag you control   │           │
│                    │    extension_access: true,                  │           │
│                    │                                             │           │
│                    │    // Extension-specific                    │           │
│                    │    extension: {                             │           │
│                    │      device_id: "dev_xxx",                  │           │
│                    │      tier: "trial",                         │           │
│                    │      trial_ends_at: ISODate,                │           │
│                    │      subscription: { ... }                  │           │
│                    │    }                                        │           │
│                    │  }                                          │           │
│                    └─────────────────────────────────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Unified User Schema

```javascript
// Collection: users (unified)
{
  "_id": ObjectId,
  
  // Core Identity
  "id": "google_xxx" | "email_xxx",  // Auth provider prefix + unique ID
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://...",          // From Google, null for email users
  "auth_method": "google" | "email", // How they registered
  
  // Platform Access Flags (YOU CONTROL THESE)
  "web_access": false,               // Can access web platform (currently only you)
  "extension_access": true,          // Can use extension
  
  // Admin & Status
  "is_active": true,
  "is_admin": false,
  
  // Extension-Specific Fields
  "extension": {
    "device_id": "dev_xxx",          // Unique device for extension
    "device_fingerprint": "hash",    // Browser fingerprint
    
    // Subscription & Tier
    "tier": "trial",                 // free | trial | pro | premium | expired
    "trial_started_at": ISODate,
    "trial_ends_at": ISODate,
    
    "subscription": {
      "stripe_customer_id": null,
      "stripe_subscription_id": null,
      "plan": null,                  // pro_monthly, pro_yearly, etc.
      "status": null,                // active, canceled, past_due
      "current_period_end": null
    },
    
    // Features & Usage
    "features": ["analysis", "ai_explain", "cloud_journal"],
    "usage": {
      "analyses_today": 0,
      "explains_today": 0,
      "last_active": ISODate
    }
  },
  
  // Timestamps
  "created_at": ISODate,
  "updated_at": ISODate,
  "last_login": ISODate
}
```

---

## 🔐 Authentication Flows

### Flow 1: Extension → Google OAuth

```
1. User clicks "Sign in with Google" in extension popup
2. Extension opens Google OAuth consent (chrome.identity API or web flow)
3. Google returns ID token
4. Extension POSTs to: POST /api/extension/auth/google
   {
     "google_token": "eyJ...",
     "device_fingerprint": "hash_xxx"
   }
5. Backend:
   a. Verifies Google token
   b. Finds or creates user in `users` collection
   c. Sets auth_method: "google", extension_access: true
   d. Generates device_id if new
   e. Starts trial if new user
   f. Returns license token + user info
6. Extension stores license in chrome.storage.sync
```

### Flow 2: Extension → Email Registration

```
1. User enters email in extension popup
2. Extension POSTs to: POST /api/extension/auth/email
   {
     "email": "user@example.com",
     "device_fingerprint": "hash_xxx"
   }
3. Backend:
   a. Validates email format
   b. Checks if email exists in `users`:
      - EXISTS with Google: "This email uses Google Sign-In. Please use Google."
      - EXISTS with email: Return existing license (same device) or error (different device)
      - NOT EXISTS: Create new user with trial
   c. Generates device_id
   d. Returns license token + user info
4. Extension stores license in chrome.storage.sync
```

### Flow 3: Web Platform → Google OAuth (Existing)

```
1. User clicks "Sign in with Google" on web
2. NextAuth handles Google OAuth
3. signIn callback POSTs to: POST /api/v1/auth/google
4. Backend:
   a. Verifies Google token
   b. Checks email allowlist (ALLOWED_GOOGLE_EMAILS)
   c. Finds or creates user
   d. Checks web_access flag:
      - TRUE: Allow login, return JWT
      - FALSE: Reject with "Web access not enabled"
   e. Returns JWT token
5. NextAuth stores session
```

---

## 🚦 Access Control Logic

### Extension Access

```python
def can_access_extension(user: User) -> bool:
    """Check if user can use extension."""
    if not user.is_active:
        return False
    if not user.extension_access:
        return False
    
    # Check tier/trial status
    tier = user.extension.tier
    if tier == "expired":
        return True  # Can access but with limited features
    if tier == "trial":
        return user.extension.trial_ends_at > utcnow()
    if tier in ["pro", "premium"]:
        return user.extension.subscription.status in ["active", "trialing"]
    
    return True  # free tier always has basic access
```

### Web Access

```python
def can_access_web(user: User) -> bool:
    """Check if user can access web platform."""
    if not user.is_active:
        return False
    
    # Simple flag check - you control this manually or via admin panel
    return user.web_access == True
```

### Granting Web Access (Admin Action)

```python
# When you want to give someone web access:
def grant_web_access(email: str) -> bool:
    """Grant web platform access to a user."""
    with mongo_client() as client:
        db = client[get_database_name()]
        result = db.users.update_one(
            {"email": email.lower()},
            {
                "$set": {
                    "web_access": True,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0
```

---

## 🎫 Tier & Feature Matrix

| Tier | Extension Access | Web Access | Features |
|------|------------------|------------|----------|
| **free** | ✅ Basic | ❌ (unless flag) | `basic_analysis` |
| **trial** | ✅ Full | ❌ (unless flag) | `analysis`, `ai_explain`, `cloud_journal`, `mtf_analysis`, `behavioral` |
| **pro** | ✅ Full | ❌ (unless flag) | Same as trial |
| **premium** | ✅ Full | ❌ (unless flag) | All features + `trade_sync`, `extended_journal`, `priority_support` |
| **expired** | ✅ Basic | ❌ (unless flag) | `basic_analysis` |

**Note:** `web_access` is independent of tier. A free trial user can have `web_access: true` if you grant it.

---

## 🔄 Migration Strategy

### For Existing Web Users (you)

```javascript
// Your existing user document
{
  "id": "google_xxx",
  "email": "fern2gue@gmail.com",
  "name": "Your Name",
  "is_admin": true,
  "is_active": true,
  
  // ADD these fields:
  "auth_method": "google",
  "web_access": true,        // Already have access
  "extension_access": true,  // Grant yourself extension access
  "extension": {
    "device_id": "dev_xxx",
    "tier": "premium",       // Give yourself premium
    "trial_ends_at": null,   // No trial needed
    "subscription": { ... },
    "features": ["all"],
    "usage": { ... }
  }
}
```

### For New Extension Users

When someone registers via extension:
- `web_access: false` (default)
- `extension_access: true`
- `extension.tier: "trial"` (3-day trial)

### For Future Web Access Grants

```python
# Admin endpoint or script to grant web access
@router.post("/admin/grant-web-access")
async def grant_web_access(
    email: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    if not current_user.is_admin:
        raise HTTPException(403, "Admin only")
    
    # Grant access
    result = db.users.update_one(
        {"email": email.lower()},
        {"$set": {"web_access": True}}
    )
    
    return {"granted": result.modified_count > 0}
```

---

## 🛡️ Security Considerations

### Device Binding

- Extension generates `device_fingerprint` from browser properties
- Server generates `device_id` on first registration
- License validation requires matching device_id
- Prevents license sharing between devices

### Token Separation

| Token Type | Used For | Expiration | Storage |
|------------|----------|------------|---------|
| **JWT (Web)** | Web API calls | 24 hours | NextAuth session |
| **License Token (Ext)** | Extension validation | Long-lived | chrome.storage.sync |

### Rate Limiting

- `/auth/email` registration: 5/hour per IP
- `/auth/validate`: 60/hour per device
- Prevents abuse and credential stuffing

---

## 📁 Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `db/models/user.py` | MODIFY | Add extension fields, access flags |
| `db/repositories/user_repository.py` | MODIFY | Add extension user methods |
| `api/routes/auth.py` | MODIFY | Check web_access flag |
| `api/routes/ext_auth.py` | CREATE | Extension-specific auth endpoints |
| `api/main.py` | MODIFY | Include ext_auth router |
| `chrome-extension/license-manager.js` | CREATE | Handle both Google and email auth |
| `chrome-extension/auth-ui.js` | CREATE | UI for both auth methods |

---

## 🔑 Environment Variables

```bash
# Existing
ALLOWED_GOOGLE_EMAILS=fern2gue@gmail.com  # Still works for web whitelist
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
JWT_SECRET_KEY=xxx

# New for Extension
EXT_LICENSE_SECRET=your-extension-license-secret
EXT_TRIAL_DAYS=3
EXT_GOOGLE_CLIENT_ID=xxx  # Can be same or different from web
```

---

## ✅ Implementation Checklist

### Phase 1: Schema Migration
- [ ] Update User model with extension fields
- [ ] Add web_access, extension_access flags
- [ ] Migrate existing user (you) with full access

### Phase 2: Extension Auth Endpoints
- [ ] POST `/api/extension/auth/google` - Google OAuth for extension
- [ ] POST `/api/extension/auth/email` - Email registration
- [ ] POST `/api/extension/auth/validate` - License validation
- [ ] GET `/api/extension/auth/user` - Get user info

### Phase 3: Web Auth Update
- [ ] Modify `/api/v1/auth/google` to check web_access flag
- [ ] Add admin endpoint for granting access

### Phase 4: Extension Client
- [ ] license-manager.js with Google + Email support
- [ ] auth-ui.js with both auth method options
- [ ] Popup with auth state display

---

*This architecture provides a clean separation between platform access while maintaining a unified user identity. Extension users can later be granted web access with a simple flag change.*



