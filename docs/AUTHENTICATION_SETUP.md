# Authentication Setup Guide - Phase 1

This guide will help you set up authentication for your LenQuant system. Phase 1 implements single-user authentication with Google OAuth.

## ✅ What's Been Implemented

### Backend Components
- ✅ `db/models/user.py` - User data model
- ✅ `api/auth/jwt.py` - JWT token utilities
- ✅ `db/repositories/user_repository.py` - User database operations
- ✅ `api/auth/dependencies.py` - FastAPI auth dependencies
- ✅ `api/routes/auth.py` - Authentication endpoints
- ✅ `db/migrations/001_add_users.py` - Database migration
- ✅ `api/main.py` - Updated with auth router

### Frontend Components
- ✅ `pages/api/auth/[...nextauth].ts` - NextAuth configuration
- ✅ `types/next-auth.d.ts` - TypeScript type definitions
- ✅ `pages/login.tsx` - Login page with Google OAuth
- ✅ `middleware.ts` - Route protection middleware
- ✅ `pages/_app.tsx` - Updated with SessionProvider
- ✅ `lib/api.ts` - Updated to include JWT in requests
- ✅ `components/Layout.tsx` - Added user menu with logout

### Configuration Files
- ✅ `requirements.txt` - Added authentication dependencies
- ✅ `package.json` - Added next-auth dependency
- ✅ `env.example` - Added authentication environment variables

## 🚀 Setup Instructions

### 1. Install Backend Dependencies

```bash
cd lenxys-trader
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Install Frontend Dependencies

```bash
cd web/next-app
npm install
cd ../..
```

### 3. Configure Google OAuth

Follow the [Google Cloud Setup guide](docs/AUTHENTICATION.md#google-cloud-setup) to:
1. Create a Google Cloud project
2. Enable Google+ API
3. Configure OAuth consent screen
4. Create OAuth Client ID
5. Get your Client ID and Secret

### 4. Set Up Environment Variables

Copy the authentication section from `env.example` to your `.env` file:

```bash
# Backend (.env)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
JWT_SECRET_KEY=your-jwt-secret
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=60
ALLOWED_GOOGLE_EMAILS=your-email@gmail.com
SYSTEM_ADMIN_TOKEN=your-admin-token
```

**Generate secrets using Python:**
```bash
# NextAuth secret
python -c "import secrets; print(secrets.token_urlsafe(32))"

# JWT secret
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Admin token
python -c "import secrets; print(secrets.token_hex(32))"
```

Create `web/next-app/.env.local`:

```bash
# Frontend (.env.local)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 5. Run Database Migration

```bash
python db/migrations/001_add_users.py
```

### 6. Start the System

```bash
# Terminal 1: Backend
cd lenxys-trader
source .venv/bin/activate
cd api
uvicorn main:app --reload

# Terminal 2: Frontend
cd web/next-app
npm run dev
```

### 7. Test Authentication

1. Open browser: `http://localhost:3000`
2. You should be redirected to `/login`
3. Click "Sign in with Google"
4. Sign in with your whitelisted email
5. You should be redirected to the dashboard
6. Your profile should appear in the top right corner

## 🧪 Testing

### Test Protected API Endpoints

```bash
# Without auth (should fail)
curl http://localhost:8000/api/status

# With admin token (should work)
export TOKEN=$(grep SYSTEM_ADMIN_TOKEN .env | cut -d= -f2)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/status
```

### Test Login Flow
1. Open DevTools → Network tab
2. Login with Google
3. Check that `/api/auth/google` returns a JWT token
4. Check that subsequent API calls include `Authorization: Bearer <token>` header

## 📋 Phase 1 Implementation Checklist

### Google Cloud Setup
- [x] Create Google Cloud project
- [x] Enable Google+ API
- [x] Configure OAuth consent screen
- [ ] Add your email as test user
- [ ] Create OAuth Client ID
- [ ] Add authorized redirect URIs
- [ ] Save Client ID and Secret

### Environment Configuration
- [x] Add `GOOGLE_CLIENT_ID` to `.env`
- [x] Add `GOOGLE_CLIENT_SECRET` to `.env`
- [ ] Generate and add `NEXTAUTH_SECRET`
- [ ] Generate and add `JWT_SECRET_KEY`
- [ ] Generate and add `SYSTEM_ADMIN_TOKEN`
- [ ] Set `ALLOWED_GOOGLE_EMAILS` (your email)

### Backend Implementation
- [x] Install dependencies (`python-jose`, `google-auth`, etc.)
- [x] Create `db/models/user.py` (User model)
- [x] Create `api/auth/jwt.py` (JWT utilities)
- [x] Create `db/repositories/user_repository.py` (User CRUD)
- [x] Create `api/auth/dependencies.py` (Auth dependencies)
- [x] Create `api/routes/auth.py` (Auth endpoints)
- [x] Update `api/main.py` (add auth router)
- [ ] Run migration: `python db/migrations/001_add_users.py`

### Frontend Implementation
- [x] Install `next-auth` package
- [x] Create `pages/api/auth/[...nextauth].ts` (NextAuth config)
- [ ] Create `.env.local` (frontend env vars)
- [x] Create `types/next-auth.d.ts` (TypeScript types)
- [x] Create `pages/login.tsx` (login page)
- [x] Create `middleware.ts` (route protection)
- [x] Update `pages/_app.tsx` (SessionProvider)
- [x] Update `lib/api.ts` (include JWT in requests)
- [x] Update `components/Layout.tsx` (user menu)

### Testing
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can access login page
- [ ] Can login with Google
- [ ] Redirected to dashboard after login
- [ ] User info displayed
- [ ] Protected API routes require auth
- [ ] Logout works
- [ ] Scripts work with admin token

## 🔐 Security Notes

1. **Never commit secrets** - `.env` and `.env.local` are in `.gitignore`
2. **Use strong random secrets** - Use the provided Python commands to generate them
3. **Whitelist only trusted emails** - In Phase 1, only whitelisted emails can access the system
4. **HTTPS in production** - Always use HTTPS in production environments
5. **Rotate secrets regularly** - Change secrets periodically for better security

## 📚 Additional Documentation

- **[AUTHENTICATION.md](docs/AUTHENTICATION.md)** - Complete authentication overview
- **[AUTHENTICATION_PHASE1.md](docs/AUTHENTICATION_PHASE1.md)** - Detailed Phase 1 implementation
- **[AUTHENTICATION_QUICK_REFERENCE.md](docs/AUTHENTICATION_QUICK_REFERENCE.md)** - Quick reference guide

## 🎯 Next Steps

After successfully implementing Phase 1:

1. ✅ **Test thoroughly** - Verify all authentication flows work
2. ✅ **Deploy to production** - Update redirect URIs in Google Cloud Console
3. ⏭️ **Plan Phase 2** - Multi-user support when ready (see [AUTHENTICATION_PHASE2.md](docs/AUTHENTICATION_PHASE2.md))

## 🆘 Troubleshooting

### "Redirect URI mismatch"
- Check Google Cloud Console → Credentials
- Verify redirect URI exactly matches: `http://localhost:3000/api/auth/callback/google`

### "Access Blocked"
- Add your email as a test user in Google Cloud Console → OAuth consent screen

### JWT validation fails
- Check that `JWT_SECRET_KEY` is the same in both backend and frontend
- Verify token is being sent in `Authorization: Bearer <token>` header

### CORS errors
- Check `allow_origins` in `api/main.py` includes your frontend URL
- Ensure `allow_credentials=True` is set

---

**Need help?** Refer to the [Troubleshooting section](docs/AUTHENTICATION.md#troubleshooting) in the main documentation.

