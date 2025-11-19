# Deployment Quick Start Guide

## What I Just Set Up ✅

1. **Added `docker-compose.yml` to `.gitignore`** - Your server config won't be overwritten
2. **Created `docker/docker-compose.yml.example`** - Template with updated "lenquant" database names
3. **Removed `ci.yml`** - We'll add tests later
4. **Created `deploy.yml`** - Auto-deployment workflow to your DigitalOcean server
5. **Created documentation** - Complete setup guides

## Next Steps (Do This Now!)

### 1️⃣ Commit and Push These Changes

```bash
cd /c/Users/smikl/Desktop/Work/Crypto/lenxys-trader

# Check what changed
git status

# Add all changes
git add .

# Commit
git commit -m "Setup auto-deployment and gitignore docker-compose.yml"

# Push
git push origin main
```

### 2️⃣ Set Up GitHub Secrets

**Before deployment works, you MUST add these secrets to GitHub:**

1. Go to: `https://github.com/YOUR_USERNAME/lenquant/settings/secrets/actions`

2. Click **"New repository secret"** and add:

   **Secret #1:**
   - Name: `SERVER_HOST`
   - Value: `152.42.168.244`

   **Secret #2:**
   - Name: `SERVER_USER`
   - Value: `cryptotrader`

   **Secret #3:**
   - Name: `SSH_PRIVATE_KEY`
   - Value: Content of your SSH key
   
   To get your SSH key content:
   ```powershell
   type C:\Users\smikl\.ssh\y
   ```
   Copy the **entire output** (including BEGIN and END lines)

### 3️⃣ Test the Deployment

After adding secrets:

```bash
# Make a small test change
echo "# Deployment test" >> README.md

# Commit and push
git add README.md
git commit -m "Test auto-deployment"
git push origin main
```

Then:
1. Go to GitHub → Your repository → **Actions** tab
2. Watch the "Deploy to DigitalOcean" workflow run
3. It should complete successfully ✅

### 4️⃣ Verify on Your Server

SSH into your server to confirm:

```bash
ssh -i C:\Users\smikl\.ssh\y cryptotrader@152.42.168.244
cd ~/CrypTrader
git log -1  # Should show your latest commit
docker-compose ps  # Should show running containers
```

## How It Works

**Every time you push to `main` branch:**

1. GitHub Actions triggers the deployment workflow
2. It SSHs into your DigitalOcean server (`152.42.168.244`)
3. Navigates to `~/CrypTrader`
4. Runs `git pull origin main`
5. Runs `docker-compose down`
6. Runs `docker-compose build --no-cache`
7. Runs `docker-compose up -d`
8. Shows logs and status

**Your server's `docker-compose.yml` is NOT touched!** ✅

## Important Notes

### Your Server Setup

- **Directory**: `~/CrypTrader` (Note: NOT `~/lenxys-trader`)
- **User**: `cryptotrader`
- **IP**: `152.42.168.244`
- **SSH Key**: `C:\Users\smikl\.ssh\y`

### Docker Compose

- ✅ Your server's `docker/docker-compose.yml` stays as-is
- ✅ Won't be overwritten by git pull (it's gitignored)
- ✅ Only code changes are pulled
- ✅ Containers are rebuilt with new code

### Database Names

The example file uses "lenquant" for database names, but **your server will keep using whatever you have configured** in your local `docker-compose.yml`.

If you want to update to "lenquant":
1. SSH into server
2. Edit `~/CrypTrader/docker/docker-compose.yml`
3. Change database names from "cryptotrader" to "lenquant"
4. Restart: `docker-compose down && docker-compose up -d`

## Troubleshooting

### "Permission denied (publickey)"

**Problem**: SSH key not set up correctly in GitHub secrets

**Solution**:
1. Get your private key: `type C:\Users\smikl\.ssh\y`
2. Copy **ENTIRE** output (including `-----BEGIN` and `-----END`)
3. Add to GitHub Secrets as `SSH_PRIVATE_KEY`

### "Directory not found"

**Problem**: Workflow can't find the project directory

**Solution**:
1. Verify directory on server:
   ```bash
   ssh -i C:\Users\smikl\.ssh\y cryptotrader@152.42.168.244
   pwd  # Should show /home/cryptotrader
   ls -la  # Should show CrypTrader folder
   ```
2. If different, update `.github/workflows/deploy.yml` line 20:
   ```yaml
   cd ~/YOUR_ACTUAL_DIRECTORY_NAME
   ```

### Deployment succeeds but site doesn't update

**Possible issues**:
1. Docker containers didn't restart properly
2. Build failed but workflow didn't catch it
3. Cached Docker images

**Solution**:
```bash
# SSH into server
ssh -i C:\Users\smikl\.ssh\y cryptotrader@152.42.168.244
cd ~/CrypTrader

# Check logs
docker-compose logs --tail=100

# Force rebuild
docker-compose down
docker-compose build --no-cache --pull
docker-compose up -d
```

## Manual Deployment (If GitHub Actions Fails)

```bash
# SSH into server
ssh -i C:\Users\smikl\.ssh\y cryptotrader@152.42.168.244

# Navigate to project
cd ~/CrypTrader

# Pull latest
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs --tail=50
```

## Complete Documentation

- **Full Setup Guide**: `docs/DEPLOYMENT_SETUP.md`
- **Docker Guide**: `docker/README.md`
- **Infrastructure Guide**: `docs/INFRASTRUCTURE.md`

---

**🚀 You're all set! Just add the GitHub secrets and push to deploy automatically.**

