# LenQuant Rebranding Summary

## Overview
Successfully rebranded from **CryptoTrader** to **LenQuant** across the entire codebase.

## What Was Changed

### 📚 Documentation Files (Updated)
1. **README.md** - Main project description and title
2. **docs/STARTING_SYSTEM.md** - System startup guide
3. **docs/INFRASTRUCTURE.md** - Deployment and infrastructure guide
4. **docs/AUTHENTICATION.md** - Authentication setup guide
5. **docs/AUTHENTICATION_PHASE1.md** - Phase 1 auth implementation
6. **docs/AUTHENTICATION_PHASE2.md** - Phase 2 auth implementation  
7. **docs/AUTHENTICATION_QUICK_REFERENCE.md** - Quick auth reference
8. **macro_analysis_integration.md** - Macro analysis documentation
9. **REGIME_UI_QUICKSTART.md** - Regime UI quickstart guide

### 💻 Code Files (Updated)
1. **api/main.py** - FastAPI app title changed to "LenQuant Core API"
2. **web/next-app/pages/index.tsx** - Homepage title changed to "LenQuant"
3. **web/next-app/package.json** - Package name changed to "lenquant"
4. **web/next-app/lib/mode-context.tsx** - Storage key changed to "lenquant-user-mode"

### 📝 New Documentation
- **docs/GITHUB_RENAME_GUIDE.md** - Complete guide for renaming your GitHub repository

## Changes Made

### Database Names
- **Old**: `cryptotrader` / `mongodb://localhost:27017/cryptotrader`
- **New**: `lenquant` / `mongodb://localhost:27017/lenquant`

### Container Names  
- **Old**: `cryptotrader-mongo`, `cryptotrader-redis`
- **New**: `lenquant-mongo`, `lenquant-redis`

### Service Names
- **Old**: `cryptotrader-api`, `cryptotrader-worker`, `cryptotrader-frontend`
- **New**: `lenquant-api`, `lenquant-worker`, `lenquant-frontend`

### Cloud Resources (Example names in docs)
- **Old**: `cryptotrader-cluster`, `cryptotrader-prod`, `cryptotrader-vpc`
- **New**: `lenquant-cluster`, `lenquant-prod`, `lenquant-vpc`

### Package Names
- **Old**: NPM package `cryptotrader`
- **New**: NPM package `lenquant`

### Storage Keys
- **Old**: `cryptotrader-user-mode`
- **New**: `lenquant-user-mode`

## Next Steps for You

### 1. Review the Changes
- Read through the updated files to ensure everything looks correct
- Pay special attention to README.md and main documentation

### 2. Update Your Local Environment

#### Update Database Name
If you have existing data:
```bash
# In MongoDB shell
use admin
db.copyDatabase("cryptotrader", "lenquant")

# Verify
use lenquant
db.getCollectionNames()

# Optional: Drop old database after confirming data copied
use cryptotrader
db.dropDatabase()
```

Or use your existing MongoDB with the new connection string in `.env`:
```env
MONGO_URI=mongodb://localhost:27017/lenquant
```

#### Update Docker Containers
```bash
# Stop old containers
docker stop cryptotrader-mongo cryptotrader-redis

# Remove old containers (data in volumes is preserved)
docker rm cryptotrader-mongo cryptotrader-redis

# Start with new names (see docs/STARTING_SYSTEM.md)
docker run -d -p 27017:27017 --name lenquant-mongo mongo:8.2
docker run -d -p 6379:6379 --name lenquant-redis redis:7.2-alpine
```

#### Update Systemd Services (if you deployed)
```bash
# Rename service files
sudo mv /etc/systemd/system/cryptotrader-api.service /etc/systemd/system/lenquant-api.service
sudo mv /etc/systemd/system/cryptotrader-worker.service /etc/systemd/system/lenquant-worker.service
sudo mv /etc/systemd/system/cryptotrader-frontend.service /etc/systemd/system/lenquant-frontend.service

# Update service file contents (edit Description lines)
sudo nano /etc/systemd/system/lenquant-api.service
sudo nano /etc/systemd/system/lenquant-worker.service
sudo nano /etc/systemd/system/lenquant-frontend.service

# Reload systemd
sudo systemctl daemon-reload

# Enable and start new services
sudo systemctl enable lenquant-api lenquant-worker lenquant-frontend
sudo systemctl start lenquant-api lenquant-worker lenquant-frontend

# Disable old services
sudo systemctl disable cryptotrader-api cryptotrader-worker cryptotrader-frontend
```

### 3. Update Your GitHub Repository
Follow the comprehensive guide in `docs/GITHUB_RENAME_GUIDE.md`:

**Quick steps:**
1. Go to GitHub repository → Settings
2. Scroll to "Repository name"
3. Enter: `lenquant`
4. Click "Rename"
5. Update local remote:
   ```bash
   git remote set-url origin https://github.com/YOUR_USERNAME/lenquant.git
   ```

### 4. Update External Services (if applicable)

#### Google OAuth (if using authentication)
1. Go to Google Cloud Console
2. Update OAuth consent screen:
   - App name: Change to "LenQuant"
3. No need to update redirect URIs (they're domain-based)

#### MongoDB Atlas (if using cloud)
1. Update cluster name (optional, can keep as-is)
2. Update database name in connection string to `lenquant`

#### Cloud Providers (AWS/DigitalOcean/Oracle)
- Update resource tags and names as you recreate/update resources
- Follow examples in docs/INFRASTRUCTURE.md

#### CI/CD Services
- GitHub Actions should work automatically
- Update any hardcoded repository URLs

### 5. Update Team Members
If you have collaborators:
```
📢 Project Rebranded: CryptoTrader → LenQuant

The project has been rebranded to LenQuant. Please:
1. Pull latest changes: git pull
2. Update .env database name to "lenquant"
3. Restart services
4. Update remote URL after I rename the GitHub repo

Questions? Let me know!
```

### 6. Rebuild NPM Packages
```bash
cd web/next-app

# Clear cache
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Rebuild
npm run build
```

## What Doesn't Need Changing

✅ **Your local git history** - All commits, branches, and tags remain unchanged  
✅ **Environment variables** - Just update database names in `.env`  
✅ **Python package names** - Internal package structure unchanged  
✅ **API endpoints** - All `/api/*` endpoints remain the same  
✅ **Database schemas** - Collection structures unchanged  
✅ **Exchange integrations** - ccxt and API keys unchanged  
✅ **ML models** - Model files and training unchanged  
✅ **Docker images** - Base images unchanged  

## Important Notes

### ⚠️ Breaking Changes
- **Database name**: Update from `cryptotrader` to `lenquant` in `.env`
- **Container names**: If you reference containers by name, update them
- **Service names**: If you have systemd services, rename them
- **Local storage**: Browser localStorage key changed (users will reset to "easy" mode)

### ✅ Non-Breaking Changes
- GitHub will redirect old URLs temporarily
- Old systemd services can coexist with new ones
- Old database can be kept alongside new one during migration

## Verification Checklist

After making changes, verify:

- [ ] Backend starts: `cd lenxys-trader && python -m api.main`
- [ ] Frontend starts: `cd web/next-app && npm run dev`
- [ ] Title shows "LenQuant" on homepage
- [ ] Database connects to `lenquant` database
- [ ] Can create new data (test with data fetch)
- [ ] All documentation references updated
- [ ] GitHub repository renamed (when ready)
- [ ] Team members notified (if applicable)

## Support

If you encounter issues:

1. **Database connection issues**: Verify `MONGO_URI` in `.env` uses `lenquant`
2. **Service not starting**: Check service file paths and names
3. **Frontend shows old name**: Clear browser cache and rebuild frontend
4. **GitHub issues**: Follow `docs/GITHUB_RENAME_GUIDE.md` carefully

## Rollback (if needed)

If you need to revert temporarily:

1. **Code**: `git checkout <commit-before-rebrand>`
2. **Database**: Keep using `cryptotrader` name in `.env`
3. **Services**: Keep old service names

However, it's recommended to move forward with the rebrand rather than rolling back.

---

**🎉 Rebranding Complete!**

Your project is now LenQuant. All documentation, code, and references have been updated. Follow the "Next Steps" above to update your local environment and GitHub repository.

