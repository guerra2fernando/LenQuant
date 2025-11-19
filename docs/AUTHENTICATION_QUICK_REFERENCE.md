# Authentication Quick Reference

Quick links and checklist for implementing authentication in LenQuant.

## 📚 Documentation Files

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[AUTHENTICATION.md](./AUTHENTICATION.md)** | Main overview | Start here - understand architecture |
| **[AUTHENTICATION_PHASE1.md](./AUTHENTICATION_PHASE1.md)** | Single-user setup | Implementing for personal use |
| **[AUTHENTICATION_PHASE2.md](./AUTHENTICATION_PHASE2.md)** | Multi-user setup | Adding multiple users later |

## ⚡ Quick Start Path

### For Public Deployment (Recommended)

```
1. Read AUTHENTICATION.md (understand what you're building)
   └─> Time: 20 minutes

2. Google Cloud Setup (AUTHENTICATION.md#google-cloud-setup)
   └─> Time: 30 minutes
   └─> Output: Client ID, Client Secret

3. Implement Phase 1 (AUTHENTICATION_PHASE1.md)
   └─> Time: 4-6 hours
   └─> Steps:
       - Backend: Auth routes, JWT, user model
       - Frontend: NextAuth, login page, protected routes
       - Testing: Login flow, API protection

4. Deploy and Test
   └─> Time: 1-2 hours
   └─> Test: Login, logout, protected routes, scripts
```

### For Local Development (Learn First, Auth Later)

```
1. Follow STARTING_SYSTEM.md (skip auth)
   └─> Get system running locally
   └─> Learn how it works

2. When ready for public deployment:
   └─> Return to AUTHENTICATION.md
   └─> Implement Phase 1
```

## ✅ Phase 1 Checklist

### Google Cloud Setup
- [ ] Create Google Cloud project
- [ ] Enable Google+ API
- [ ] Configure OAuth consent screen
- [ ] Add your email as test user
- [ ] Create OAuth Client ID
- [ ] Add authorized redirect URIs
- [ ] Save Client ID and Secret

### Environment Configuration
- [ ] Add `GOOGLE_CLIENT_ID` to `.env`
- [ ] Add `GOOGLE_CLIENT_SECRET` to `.env`
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
- [ ] Protect existing routes (add `Depends(get_current_user)`)
- [ ] Run migration: `python db/migrations/001_add_users.py`

### Frontend Implementation
- [x] Install `next-auth` package
- [x] Create `pages/api/auth/[...nextauth].ts` (NextAuth config)
- [ ] Update `.env.local` (frontend env vars)
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

### Deployment
- [ ] Update production environment variables
- [ ] Add production redirect URI to Google Cloud
- [ ] Deploy backend with gunicorn
- [ ] Deploy frontend (build + start)
- [ ] Configure Nginx reverse proxy
- [ ] Set up SSL certificate (Let's Encrypt)
- [ ] Test production login flow

## 🚀 Phase 2 Checklist (Multi-User)

### Preparation
- [ ] Backup database (`mongodump`)
- [ ] Get your user_id from database
- [ ] Plan downtime for migration

### Database Migration
- [ ] Set `MIGRATION_USER_ID` environment variable
- [ ] Run `db/migrations/002_add_user_id_to_collections.py`
- [ ] Verify migration (check user_id fields added)
- [ ] Test data access (should still work for you)

### Backend Updates
- [ ] Create `db/models/user_settings.py`
- [ ] Update all user-specific routes to filter by `user_id`
  - [ ] `api/routes/strategies.py`
  - [ ] `api/routes/models.py`
  - [ ] `api/routes/experiments.py`
  - [ ] `api/routes/trade.py`
  - [ ] `api/routes/runs.py`
- [ ] Create `api/routes/users.py` (user management - admin only)
- [ ] Update `db/repositories/user_repository.py` (remove whitelist)
- [ ] Add rate limiting (`slowapi`)
- [ ] Add quota checks

### Frontend Updates
- [ ] Update existing pages (filter by user_id)
- [ ] Create `pages/admin/users.tsx` (admin panel)
- [ ] Add admin link to navigation
- [ ] Show user quotas (e.g., "25/50 strategies")

### Configuration
- [ ] Set `ALLOW_SIGNUPS=true` in `.env`
- [ ] Remove or expand `ALLOWED_GOOGLE_EMAILS`

### Testing
- [ ] Create test user accounts
- [ ] Verify data isolation (User A can't see User B's data)
- [ ] Test quotas (create 50 strategies, 51st should fail)
- [ ] Test admin panel (view/deactivate users)
- [ ] Test shared data (both users see same market data)

### Deployment
- [ ] Deploy backend with migration
- [ ] Deploy frontend
- [ ] Verify in production
- [ ] Monitor logs for issues

## 🔧 Common Commands

### Generate Secrets
```bash
# NextAuth secret
python -c "import secrets; print(secrets.token_urlsafe(32))"

# JWT secret
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Admin token
python -c "import secrets; print(secrets.token_hex(32))"
```

### Test Authentication
```bash
# Test login flow (get token)
curl -X POST http://localhost:8000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"token": "GOOGLE_ID_TOKEN"}'

# Test protected endpoint
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8000/api/forecast/BTC-USDT

# Test with admin token
export TOKEN=$(grep SYSTEM_ADMIN_TOKEN .env | cut -d= -f2)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/models/list
```

### Database Operations
```bash
# Get your user_id
python -c "from db.client import mongo_client, get_database_name; client = mongo_client.__enter__(); db = client[get_database_name()]; user = db.users.find_one({'email': 'YOUR_EMAIL'}); print(f'User ID: {user[\"id\"]}') if user else print('Not found')"

# Count your strategies
python -c "from db.client import mongo_client, get_database_name; client = mongo_client.__enter__(); db = client[get_database_name()]; count = db.strategies.count_documents({'user_id': 'YOUR_USER_ID'}); print(f'Strategies: {count}')"

# Backup database
mongodump --uri="mongodb://localhost:27017/lenquant" --out=backup_$(date +%Y%m%d)

# Restore database
mongorestore --uri="mongodb://localhost:27017/lenquant" backup_20241119/
```

## 📞 Getting Help

### Troubleshooting Steps

1. **Check logs**:
   - Backend: Terminal where uvicorn is running
   - Frontend: Browser console (F12)
   - MongoDB: `mongosh` queries

2. **Common issues documented**:
   - [AUTHENTICATION.md#troubleshooting](./AUTHENTICATION.md#troubleshooting)
   - [AUTHENTICATION_PHASE1.md#common-issues](./AUTHENTICATION_PHASE1.md#common-issues--solutions)

3. **Verify configuration**:
   ```bash
   # Check if environment variables are set
   env | grep GOOGLE
   env | grep JWT
   env | grep NEXTAUTH
   ```

4. **Test components individually**:
   - Backend auth endpoint: `curl http://localhost:8000/api/status`
   - Frontend: `http://localhost:3000/login`
   - Database: `mongosh mongodb://localhost:27017/lenquant`

## 🎯 Success Criteria

### Phase 1 Success
- ✅ Can login with Google
- ✅ Cannot access system without login
- ✅ Scripts work with admin token
- ✅ All existing features work
- ✅ Can deploy to public domain securely

### Phase 2 Success
- ✅ Multiple users can sign up
- ✅ Users see only their own data
- ✅ Shared market data works for all
- ✅ Admin can manage users
- ✅ Quotas prevent abuse
- ✅ Rate limiting works

## 📊 Time Estimates

| Task | Time |
|------|------|
| Read documentation | 30-60 min |
| Google Cloud setup | 30-45 min |
| Phase 1 backend | 2-3 hours |
| Phase 1 frontend | 2-3 hours |
| Phase 1 testing | 1 hour |
| Phase 1 deployment | 1-2 hours |
| **Phase 1 Total** | **6-10 hours** |
| | |
| Phase 2 planning | 1 hour |
| Database migration | 1 hour |
| Phase 2 backend | 3-4 hours |
| Phase 2 frontend | 2-3 hours |
| Phase 2 testing | 2 hours |
| Phase 2 deployment | 1-2 hours |
| **Phase 2 Total** | **10-15 hours** |

## 🔐 Security Best Practices

- ✅ Use strong random secrets (never hardcode)
- ✅ Add `.env` to `.gitignore`
- ✅ Enable HTTPS in production (Let's Encrypt)
- ✅ Set `secure: true` for cookies in production
- ✅ Keep secrets in environment variables
- ✅ Rotate secrets regularly
- ✅ Monitor authentication logs
- ✅ Set up rate limiting
- ✅ Implement audit logging
- ✅ Regular security updates

---

**Ready to implement?** Start with **[AUTHENTICATION.md](./AUTHENTICATION.md)** 🚀

