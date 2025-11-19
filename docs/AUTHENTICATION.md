# Authentication System

Complete guide to implementing Google OAuth 2.0 authentication for the LenQuant system.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Security Model](#security-model)
4. [Data Segregation](#data-segregation)
5. [Implementation Phases](#implementation-phases)
6. [Google Cloud Setup](#google-cloud-setup)
7. [Quick Start](#quick-start)

---

## Overview

The LenQuant system uses **Google OAuth 2.0** for authentication, providing:

- ✅ Secure login without managing passwords
- ✅ User identification via Google accounts
- ✅ JWT-based API authentication
- ✅ Session management with Redis
- ✅ Protection for both frontend and backend
- ✅ Multi-tenancy support (Phase 2)

### Why Google OAuth?

1. **Security**: Google handles password security and 2FA
2. **User Experience**: One-click login with existing Google account
3. **Reliability**: Google's infrastructure ensures 99.99% uptime
4. **No Password Management**: No risk of password leaks
5. **Easy Setup**: Simple integration with Next.js and FastAPI

---

## Architecture

### High-Level Flow

```
┌─────────────┐
│   Browser   │
│  (Next.js)  │
└──────┬──────┘
       │ 1. Login with Google
       ↓
┌─────────────────────┐
│  Google OAuth 2.0   │
│   Authorization     │
└──────┬──────────────┘
       │ 2. Google Token
       ↓
┌─────────────────────┐
│  FastAPI Backend    │
│  - Verify token     │
│  - Create/get user  │
│  - Issue JWT        │
└──────┬──────────────┘
       │ 3. JWT Token
       ↓
┌─────────────────────┐
│  Protected Routes   │
│  - Validate JWT     │
│  - Load user        │
│  - Execute request  │
└─────────────────────┘
```

### Components

#### Frontend (Next.js)
- **NextAuth.js**: Handles OAuth flow and session management
- **Middleware**: Protects routes, redirects unauthorized users
- **API Client**: Includes JWT in all requests

#### Backend (FastAPI)
- **Auth Routes**: Handle Google token validation, JWT issuance
- **Auth Middleware**: Validates JWT on protected endpoints
- **User Dependency**: Injects current user into route handlers

#### Database (MongoDB)
- **users**: Stores user profiles (Google ID, email, name, avatar)
- **sessions**: Optional refresh token storage
- **User-specific collections**: Include `user_id` field

#### Cache (Redis)
- **Session storage**: Active sessions and refresh tokens
- **Token blacklist**: Revoked tokens (logout)

---

## Security Model

### Authentication Flow (Detailed)

```
1. User visits protected route → Redirected to /login
2. User clicks "Login with Google"
3. Browser redirects to Google OAuth consent screen
4. User approves permissions
5. Google redirects back with authorization code
6. NextAuth exchanges code for Google token
7. Backend validates Google token with Google API
8. Backend checks if user exists in database
   - If new: Create user record
   - If exists: Update last login
9. Backend generates JWT with payload:
   {
     "user_id": "google_123456",
     "email": "user@gmail.com",
     "exp": timestamp
   }
10. JWT stored in httpOnly cookie (frontend)
11. All API requests include JWT in Authorization header
12. Backend middleware validates JWT signature
13. Backend loads user from database
14. Request proceeds with user context
```

### Token Strategy

#### JWT (JSON Web Token)
- **Purpose**: API authentication
- **Storage**: httpOnly cookie (prevents XSS)
- **Expiration**: 1 hour (configurable)
- **Payload**: user_id, email, issued_at, expires_at
- **Signature**: HMAC-SHA256 with secret key

#### Refresh Token (Optional - Phase 2)
- **Purpose**: Obtain new JWT without re-login
- **Storage**: Redis (server-side)
- **Expiration**: 7 days (configurable)
- **Security**: Single-use, rotated on refresh

### Security Measures

1. **httpOnly Cookies**: Prevents JavaScript access (XSS protection)
2. **Secure Flag**: HTTPS-only transmission
3. **SameSite**: CSRF protection
4. **Token Expiration**: Short-lived JWTs (1 hour)
5. **Signature Verification**: Prevents token tampering
6. **CORS Configuration**: Whitelist frontend domain only
7. **Rate Limiting**: Prevent brute force (Phase 2)

---

## Data Segregation

### Shared Data (Global - No User Isolation)

These collections are shared across all users:

| Collection | Purpose | Why Shared |
|------------|---------|------------|
| `ohlcv` | Price candles | Same market data for everyone |
| `features` | Technical indicators | Computed from shared OHLCV |
| `knowledge` | Trading insights | System-wide learnings |
| `macro_*` | Macro analysis | Global economic indicators |
| `daily_reports` | System reports | Read-only, centralized |

**Data Ingestion**: Runs as **system user**, not tied to any specific user.

### User-Specific Data (Requires `user_id`)

These collections are filtered by user:

| Collection | Purpose | Schema Addition |
|------------|---------|-----------------|
| `users` | User profiles | `{google_id, email, name, avatar, created_at}` |
| `strategies` | Trading strategies | Add `user_id` field |
| `models.registry` | ML models | Add `user_id` field |
| `sim_runs` | Backtests | Add `user_id` field |
| `experiments` | Evolution runs | Add `user_id` field |
| `positions` | Trading positions | Add `user_id` field |
| `orders` | Trade history | Add `user_id` field |
| `user_settings` | Preferences | Add `user_id` field |
| `user_api_keys` | Exchange keys | Add `user_id` field (encrypted) |
| `assistant_chats` | Chat history | Add `user_id` field |

**Database Queries**: Automatically filtered by `user_id` in route handlers.

### Multi-Tenancy Pattern

**Phase 1 (Single User)**:
```python
# No filtering needed, only one user
strategies = db.strategies.find()
```

**Phase 2 (Multi-User)**:
```python
# Filter by current user
strategies = db.strategies.find({"user_id": current_user.id})
```

**Migration**:
```python
# Migrate existing data to your user_id
db.strategies.update_many({}, {"$set": {"user_id": "your-google-id"}})
db.models.registry.update_many({}, {"$set": {"user_id": "your-google-id"}})
# ... etc for all user-specific collections
```

---

## Implementation Phases

### Phase 1: Single User (You Only)

**Timeline**: 1-2 days  
**Complexity**: Low  

**Features**:
- ✅ Google OAuth login
- ✅ JWT authentication
- ✅ Route protection (frontend + backend)
- ✅ Whitelist (only your Google email)
- ✅ Scripts run with admin token
- ❌ No multi-tenancy yet
- ❌ No user management UI

**Use Case**: Deploy system publicly, only you can access.

[→ Phase 1 Implementation Guide](./AUTHENTICATION_PHASE1.md)

### Phase 2: Multi-User

**Timeline**: 3-5 days  
**Complexity**: Medium  

**Features**:
- ✅ Open signups (configurable)
- ✅ User onboarding flow
- ✅ Data segregation by user_id
- ✅ User dashboard
- ✅ Admin panel
- ✅ User quotas and limits
- ✅ Rate limiting
- ✅ Audit logging

**Use Case**: Allow others to create accounts and trade independently.

[→ Phase 2 Implementation Guide](./AUTHENTICATION_PHASE2.md)

---

## Google Cloud Setup

### Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create New Project**:
   - Click the project dropdown (top left)
   - Click "New Project"
   - **Project Name**: `lenquant-auth`
   - **Organization**: (optional)
   - Click "Create"
   - Wait for project creation (~30 seconds)

3. **Select Project**:
   - From project dropdown, select `lenquant-auth`

### Step 2: Enable Google OAuth API

1. **Navigate to APIs & Services**:
   - Hamburger menu (☰) → "APIs & Services" → "Library"

2. **Enable Google+ API** (for user info):
   - Search for "Google+ API"
   - Click "Google+ API"
   - Click "Enable"

### Step 3: Configure OAuth Consent Screen

1. **Go to Consent Screen**:
   - Hamburger menu (☰) → "APIs & Services" → "OAuth consent screen"

2. **Choose User Type**:
   - Select **"External"** (allows any Google account)
   - Click "Create"

3. **Fill App Information**:

   **App Information**:
   - **App name**: `LenQuant`
   - **User support email**: Your email
   - **App logo**: (optional, can upload later)

   **App Domain**:
   - **Application home page**: `https://yourdomain.com`
   - **Application privacy policy**: `https://yourdomain.com/privacy`
   - **Application terms of service**: `https://yourdomain.com/terms`
   
   (For Phase 1, you can use placeholder URLs or localhost)

   **Authorized domains**:
   - Add: `yourdomain.com` (your production domain)
   - Add: `localhost` (for local development)

   **Developer contact information**:
   - **Email**: Your email

   Click "Save and Continue"

4. **Scopes** (Step 2):
   - Click "Add or Remove Scopes"
   - Select:
     - ✅ `.../auth/userinfo.email`
     - ✅ `.../auth/userinfo.profile`
     - ✅ `openid`
   - Click "Update"
   - Click "Save and Continue"

5. **Test Users** (Step 3):
   - **Important**: Add your email as a test user
   - Click "Add Users"
   - Enter your Gmail address
   - Click "Add"
   - Click "Save and Continue"

6. **Summary** (Step 4):
   - Review settings
   - Click "Back to Dashboard"

### Step 4: Create OAuth Credentials

1. **Navigate to Credentials**:
   - Hamburger menu (☰) → "APIs & Services" → "Credentials"

2. **Create OAuth Client ID**:
   - Click "Create Credentials" → "OAuth client ID"

3. **Configure OAuth Client**:
   
   **Application type**: `Web application`
   
   **Name**: `LenQuant Web Client`
   
   **Authorized JavaScript origins**:
   - Add `http://localhost:3000` (development)
   - Add `https://yourdomain.com` (production)
   
   **Authorized redirect URIs**:
   - Add `http://localhost:3000/api/auth/callback/google` (development)
   - Add `https://yourdomain.com/api/auth/callback/google` (production)
   
   Click "Create"

4. **Save Credentials**:
   - A popup shows your **Client ID** and **Client Secret**
   - **IMPORTANT**: Copy both immediately
   - Click "Download JSON" (backup)
   - Store securely (do NOT commit to git)

Example credentials:
```
Client ID: 123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
Client Secret: GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz
```

### Step 5: Environment Configuration

Add to your `.env` file:

```env
# Google OAuth
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-random-secret-here

# JWT Configuration
JWT_SECRET_KEY=generate-strong-random-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=60

# Phase 1: Whitelist (comma-separated emails)
ALLOWED_GOOGLE_EMAILS=your-email@gmail.com

# Admin/Script Access
SYSTEM_ADMIN_TOKEN=generate-strong-admin-token-here
```

### Generating Secrets

**Option 1: OpenSSL**
```bash
# Generate NextAuth secret
openssl rand -base64 32

# Generate JWT secret
openssl rand -base64 64

# Generate admin token
openssl rand -hex 32
```

**Option 2: Python**
```python
import secrets

# Generate NextAuth secret
print(secrets.token_urlsafe(32))

# Generate JWT secret
print(secrets.token_urlsafe(64))

# Generate admin token
print(secrets.token_hex(32))
```

**Option 3: Node.js**
```javascript
// In terminal
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 6: Verify Setup

1. **Test OAuth Flow**:
   - Run your application (after implementing Phase 1)
   - Navigate to `http://localhost:3000/login`
   - Click "Login with Google"
   - Should redirect to Google consent screen
   - Approve permissions
   - Should redirect back to your app (logged in)

2. **Check Logs**:
   - Backend should log: `User logged in: your-email@gmail.com`
   - No errors in browser console

3. **Test Protected Routes**:
   - Try accessing `/api/forecast/BTC-USDT` without token → 401 Unauthorized
   - Login first, then try again → 200 OK

---

## Quick Start

### Prerequisites

- ✅ Google Cloud project created
- ✅ OAuth credentials obtained
- ✅ Environment variables configured
- ✅ MongoDB and Redis running

### Implementation Order

1. **Backend Setup** (2-3 hours)
   ```bash
   # Install dependencies
   pip install python-jose[cryptography] passlib python-multipart google-auth
   
   # Implement auth routes
   # See AUTHENTICATION_PHASE1.md for code
   ```

2. **Frontend Setup** (2-3 hours)
   ```bash
   cd web/next-app
   npm install next-auth
   
   # Configure NextAuth
   # See AUTHENTICATION_PHASE1.md for code
   ```

3. **Testing** (1 hour)
   ```bash
   # Test auth flow
   # Test protected routes
   # Test logout
   ```

### File Checklist

**Backend**:
- [ ] `api/auth/__init__.py` - Auth module
- [ ] `api/auth/models.py` - User model
- [ ] `api/auth/jwt.py` - JWT utilities
- [ ] `api/auth/dependencies.py` - Auth dependencies
- [ ] `api/routes/auth.py` - Auth routes
- [ ] `db/models/user.py` - User database model

**Frontend**:
- [ ] `pages/api/auth/[...nextauth].ts` - NextAuth config
- [ ] `pages/login.tsx` - Login page
- [ ] `middleware.ts` - Route protection
- [ ] `lib/auth.ts` - Auth utilities

**Configuration**:
- [ ] `.env` - Environment variables
- [ ] `requirements.txt` - Python dependencies
- [ ] `package.json` - Node dependencies

---

## Troubleshooting

### Issue 1: "Redirect URI Mismatch"

**Error**: `Error 400: redirect_uri_mismatch`

**Solution**:
1. Check Google Cloud Console → Credentials
2. Verify redirect URI exactly matches:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://yourdomain.com/api/auth/callback/google` (prod)
3. No trailing slashes!
4. Protocol must match (http vs https)

### Issue 2: "Access Blocked: This app's request is invalid"

**Error**: `Access blocked: lenquant has not completed the Google verification process`

**Solution**:
1. Go to OAuth consent screen
2. Add your email as "Test User"
3. Or publish app (takes 1-2 weeks for Google review)

### Issue 3: JWT Validation Fails

**Error**: `401 Unauthorized` on protected routes

**Solution**:
1. Check JWT secret matches between frontend and backend
2. Verify token is being sent in `Authorization: Bearer <token>` header
3. Check token hasn't expired
4. Validate token signature:
   ```python
   from jose import jwt
   try:
       payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
       print(payload)
   except Exception as e:
       print(f"Invalid token: {e}")
   ```

### Issue 4: CORS Errors

**Error**: `Access to fetch at 'http://localhost:8000' from origin 'http://localhost:3000' has been blocked by CORS policy`

**Solution**:
1. Check FastAPI CORS middleware:
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["http://localhost:3000"],  # Specific origin
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```
2. Ensure `allow_credentials=True` is set
3. Don't use `allow_origins=["*"]` with credentials

### Issue 5: Session Lost on Refresh

**Error**: User logged out after page refresh

**Solution**:
1. Ensure JWT stored in httpOnly cookie
2. Check cookie domain and path settings
3. Verify NextAuth session strategy:
   ```typescript
   session: {
     strategy: "jwt",  // Not "database"
     maxAge: 60 * 60,  // 1 hour
   }
   ```

---

## Best Practices

### Security

1. **Never expose secrets**:
   - Add `.env` to `.gitignore`
   - Use environment variables in production
   - Rotate secrets regularly

2. **Use HTTPS in production**:
   - Configure SSL/TLS certificate
   - Set `secure: true` for cookies
   - Redirect HTTP to HTTPS

3. **Implement rate limiting**:
   - Limit login attempts (5 per 15 min)
   - Limit API calls per user (Phase 2)

4. **Audit logging**:
   - Log all authentication events
   - Log sensitive operations (trades, settings changes)
   - Monitor for suspicious activity

### Development

1. **Separate environments**:
   - `.env.development` - Local development
   - `.env.staging` - Staging server
   - `.env.production` - Production server

2. **Use test mode**:
   - Keep app in Google "Testing" mode for development
   - Add all developers as test users
   - Publish only when ready for production

3. **Mock auth in tests**:
   ```python
   @pytest.fixture
   def mock_user():
       return User(id="test-123", email="test@example.com")
   
   def test_protected_route(client, mock_user):
       with patch("api.auth.dependencies.get_current_user", return_value=mock_user):
           response = client.get("/api/forecast/BTC-USDT")
           assert response.status_code == 200
   ```

---

## Next Steps

1. **Implement Phase 1**: [→ AUTHENTICATION_PHASE1.md](./AUTHENTICATION_PHASE1.md)
2. **Test thoroughly**: Login, logout, protected routes, scripts
3. **Deploy**: Follow [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) for production deployment
4. **Monitor**: Check logs, set up alerts
5. **Plan Phase 2**: When ready for multi-user [→ AUTHENTICATION_PHASE2.md](./AUTHENTICATION_PHASE2.md)

---

## Support Resources

- **Google OAuth Documentation**: https://developers.google.com/identity/protocols/oauth2
- **NextAuth.js Documentation**: https://next-auth.js.org/
- **FastAPI Security**: https://fastapi.tiangolo.com/tutorial/security/
- **JWT.io**: https://jwt.io/ (decode and inspect JWTs)

---

**Ready to implement? Start with [Phase 1 Implementation Guide](./AUTHENTICATION_PHASE1.md)** 🚀

