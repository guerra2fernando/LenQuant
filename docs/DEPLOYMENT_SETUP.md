# Automatic Deployment Setup

This guide explains how to set up automatic deployment to your DigitalOcean server using GitHub Actions.

## Overview

When you push code to the `main` branch, GitHub Actions will automatically:
1. SSH into your DigitalOcean server
2. Pull the latest code
3. Rebuild Docker containers
4. Restart services

## Setup Instructions

### Step 1: Prepare Your Server

1. **Ensure your server has the project:**
   ```bash
   ssh -i C:\Users\smikl\.ssh\y cryptotrader@152.42.168.244
   cd ~/CrypTrader
   ```

2. **Verify Docker is installed:**
   ```bash
   docker --version
   docker-compose --version
   ```

3. **Create your local docker-compose.yml:**
   ```bash
   cd docker
   cp docker-compose.yml.example docker-compose.yml
   # Edit with your specific configurations
   nano docker-compose.yml
   ```

4. **Set up git to track the main branch:**
   ```bash
   cd ~/CrypTrader
   git remote -v  # Verify remote is set
   git branch --set-upstream-to=origin/main main
   ```

### Step 2: Configure GitHub Secrets

You need to add three secrets to your GitHub repository:

#### 2.1 Get Your SSH Private Key Content

On your Windows PC:
```powershell
# Read your SSH private key
type C:\Users\smikl\.ssh\y
```

Copy the **entire content** (including `-----BEGIN ... KEY-----` and `-----END ... KEY-----`)

#### 2.2 Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

Add these three secrets:

**Secret 1: `SERVER_HOST`**
- Name: `SERVER_HOST`
- Value: `152.42.168.244`

**Secret 2: `SERVER_USER`**
- Name: `SERVER_USER`
- Value: `cryptotrader`

**Secret 3: `SSH_PRIVATE_KEY`**
- Name: `SSH_PRIVATE_KEY`
- Value: Paste your entire SSH private key content from step 2.1

### Step 3: Test the Workflow

1. **Make a small change to test:**
   ```bash
   # On your local machine
   cd /path/to/lenxys-trader
   
   # Make a small change (e.g., add a comment in README)
   echo "# Test deployment" >> README.md
   
   # Commit and push
   git add README.md
   git commit -m "Test automatic deployment"
   git push origin main
   ```

2. **Watch the deployment:**
   - Go to your GitHub repository
   - Click **Actions** tab
   - You should see "Deploy to DigitalOcean" workflow running
   - Click on it to see live logs

3. **Verify on server:**
   ```bash
   ssh -i C:\Users\smikl\.ssh\y cryptotrader@152.42.168.244
   cd ~/CrypTrader
   git log -1  # Should show your latest commit
   docker-compose ps  # Should show running containers
   ```

## Workflow Details

### What the workflow does:

1. **Triggers**: Runs on every push to `main` branch
2. **Connects**: Uses SSH to connect to your server
3. **Updates**: Pulls latest code from GitHub
4. **Rebuilds**: Rebuilds Docker images with new code
5. **Restarts**: Restarts all services
6. **Verifies**: Checks service status and shows logs

### Workflow file location:
`.github/workflows/deploy.yml`

## Customizing the Deployment

### Change Deployment Branch

Edit `.github/workflows/deploy.yml`:
```yaml
on:
  push:
    branches:
      - main       # Change this to your branch
      - production # Or add more branches
```

### Add Pre-deployment Steps

Edit the workflow to add steps before deployment:
```yaml
- name: Run tests
  run: pytest
  
- name: Build assets
  run: npm run build
```

### Add Post-deployment Health Checks

Edit the script section in `deploy.yml`:
```yaml
script: |
  cd ~/CrypTrader
  git pull origin main
  docker-compose down
  docker-compose build --no-cache
  docker-compose up -d
  
  # Wait and check health
  sleep 30
  curl -f http://localhost:8000/api/status || exit 1
  echo "✅ API is healthy"
```

### Change Deployment Directory

If your project is in a different location:
```yaml
script: |
  cd ~/your-directory-name  # Change this
  git pull origin main
  ...
```

## Troubleshooting

### Deployment fails with "Permission denied"

**Problem**: SSH key authentication failed

**Solution**:
1. Verify your SSH key works manually:
   ```bash
   ssh -i C:\Users\smikl\.ssh\y cryptotrader@152.42.168.244
   ```
2. If it works, check GitHub secret `SSH_PRIVATE_KEY`:
   - Must include `-----BEGIN` and `-----END` lines
   - Must not have extra spaces or line breaks
   - Must be the **private** key (not .pub)

### Deployment fails with "Directory not found"

**Problem**: Project directory doesn't exist or is named differently

**Solution**:
1. SSH into server and check:
   ```bash
   ssh -i C:\Users\smikl\.ssh\y cryptotrader@152.42.168.244
   pwd  # Check current directory
   ls -la  # List directories
   ```
2. Update `deploy.yml` with correct path:
   ```yaml
   cd ~/correct-directory-name
   ```

### Deployment succeeds but services don't start

**Problem**: Docker compose configuration issue

**Solution**:
1. Check logs on server:
   ```bash
   ssh -i C:\Users\smikl\.ssh\y cryptotrader@152.42.168.244
   cd ~/CrypTrader
   docker-compose logs
   ```
2. Check your `docker-compose.yml` configuration
3. Verify all environment variables are set

### Git pull fails with "merge conflict"

**Problem**: Local changes on server conflict with remote changes

**Solution**:
1. SSH into server:
   ```bash
   ssh -i C:\Users\smikl\.ssh\y cryptotrader@152.42.168.244
   cd ~/CrypTrader
   ```
2. Stash or commit local changes:
   ```bash
   git stash  # Save local changes
   git pull origin main
   git stash pop  # Restore local changes if needed
   ```
3. Or reset to remote:
   ```bash
   git fetch origin
   git reset --hard origin/main  # ⚠️ Discards local changes
   ```

### Docker build fails

**Problem**: Build errors or missing dependencies

**Solution**:
1. Check build logs in GitHub Actions
2. SSH into server and build manually to see full error:
   ```bash
   cd ~/CrypTrader
   docker-compose build
   ```
3. Fix issues in Dockerfile or dependencies

## Security Best Practices

### 1. Use Deploy Keys (Alternative to SSH key)

Instead of using your personal SSH key:

1. Generate a deploy key on your server:
   ```bash
   ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy
   ```

2. Add public key to GitHub:
   - Repository Settings → Deploy keys → Add deploy key
   - Paste content of `~/.ssh/github_deploy.pub`

3. Update GitHub secret `SSH_PRIVATE_KEY` with `~/.ssh/github_deploy`

### 2. Limit Deployment Access

- Create a separate user with limited permissions for deployments
- Use SSH key with passphrase
- Rotate SSH keys regularly

### 3. Add Deployment Notifications

Add notification steps to your workflow:
```yaml
- name: Notify deployment
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Deployment completed!'
  if: always()
```

## Manual Deployment

If you need to deploy manually (GitHub Actions is down):

```bash
# SSH into server
ssh -i C:\Users\smikl\.ssh\y cryptotrader@152.42.168.244

# Navigate to project
cd ~/CrypTrader

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs --tail=50
```

## Rollback

If a deployment breaks something:

```bash
# SSH into server
ssh -i C:\Users\smikl\.ssh\y cryptotrader@152.42.168.244
cd ~/CrypTrader

# Find previous commit
git log --oneline -10

# Rollback to previous commit
git reset --hard <commit-hash>

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Advanced: Blue-Green Deployment

For zero-downtime deployments, see `docs/INFRASTRUCTURE.md` for setting up:
- Load balancer
- Multiple container instances
- Health checks
- Gradual rollout

---

**🎉 Your automatic deployment is now set up!**

Every time you push to `main`, your server will automatically update. Monitor deployments in the GitHub Actions tab.

