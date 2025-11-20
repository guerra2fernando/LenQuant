# Infrastructure Deployment Guide

Complete guide to deploying LenQuant for 24/7 operation with three deployment strategies: Almost Free, Budget-Friendly, and Enterprise (AWS).

## Table of Contents

1. [Overview](#overview)
2. [Deployment Option 1: Almost Free (Oracle Cloud + Free Tier Services)](#deployment-option-1-almost-free-oracle-cloud--free-tier-services)
3. [Deployment Option 2: Budget-Friendly ($10-20/month)](#deployment-option-2-budget-friendly-10-20month)
4. [Deployment Option 3: Enterprise AWS ($50-150/month)](#deployment-option-3-enterprise-aws-50-150month)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Security Best Practices](#security-best-practices)

---

## Overview

### Why 24/7 Operation?

The cryptocurrency market operates **24 hours a day, 7 days a week**. To effectively trade and capitalize on opportunities, your system needs to:

- **Monitor markets continuously** - Price movements happen at any time
- **Execute trades instantly** - Opportunities can disappear in seconds
- **Update models regularly** - New data requires model retraining
- **Collect data consistently** - Gaps in data reduce prediction accuracy
- **Respond to alerts** - Stop losses and risk management are critical

**Running on your local computer is not sufficient** because:
- ❌ Computer shutdowns stop trading
- ❌ Internet outages halt operations
- ❌ Power failures cause downtime
- ❌ Sleep mode stops processes
- ❌ High electricity costs (24/7 operation)

### System Requirements

**Minimum Specifications:**
- **CPU**: 2 cores (4 cores recommended)
- **RAM**: 4GB (8GB recommended)
- **Storage**: 40GB SSD (100GB recommended)
- **Network**: Stable internet connection
- **OS**: Linux (Ubuntu 22.04 LTS recommended)

**Resource Usage:**
- **Backend API**: ~500MB RAM, 20% CPU (idle), 50% CPU (active)
- **Celery Worker**: ~800MB RAM, 30% CPU (training), 10% CPU (idle)
- **MongoDB**: ~1GB RAM, 5-10% CPU
- **Redis**: ~100MB RAM, 5% CPU
- **Frontend**: ~300MB RAM, 5% CPU

**Total**: ~2.7GB RAM, 2-4 cores CPU

### Deployment Strategies Comparison

| Feature | Almost Free | Budget ($10-20/mo) | Enterprise (AWS $50-150/mo) |
|---------|-------------|-------------------|---------------------------|
| **Cost** | $0-5/month | $10-20/month | $50-150/month |
| **Setup Difficulty** | Medium | Easy | Easy |
| **Performance** | Good | Very Good | Excellent |
| **Reliability** | Good (99% uptime) | Very Good (99.5% uptime) | Excellent (99.9% uptime) |
| **Scalability** | Limited | Moderate | Unlimited |
| **Support** | Community | Email | 24/7 Phone |
| **Best For** | Testing, Learning | Solo traders | Professional traders |

---

## Deployment Option 1: Almost Free (Oracle Cloud + Free Tier Services)

**Total Cost: $0-5/month**

This option uses free tier services from multiple providers to create a fully functional 24/7 trading system at virtually no cost.

### Architecture Overview

```
┌─────────────────────────────────────────────┐
│         Oracle Cloud Free Tier VM           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Backend  │  │  Worker  │  │ Frontend │  │
│  │ FastAPI  │  │  Celery  │  │  Next.js │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌──────────┐                │
│  │  Redis   │  │ MongoDB  │                │
│  └──────────┘  └──────────┘                │
└─────────────────────────────────────────────┘
         ↓                    ↑
   MongoDB Atlas         Cloudflare
   (Free 512MB)      (Free CDN & DNS)
```

### Step-by-Step Setup

#### Part 1: Create Oracle Cloud Account

**Why Oracle Cloud?**
- **Always Free** tier includes 2 AMD VMs with 1GB RAM each OR 1 ARM VM with 24GB RAM
- No credit card required (in some regions)
- No time limit (truly always free)
- Better specs than AWS/GCP free tiers

**Steps:**

1. **Sign Up**:
   - Go to [oracle.com/cloud/free](https://www.oracle.com/cloud/free/)
   - Click "Start for free"
   - Fill in details:
     - Email address
     - Country (choose carefully, affects available services)
     - Account name (unique identifier)
   - Complete phone verification
   - **Note**: Some regions may require credit card, but it won't be charged

2. **Wait for Account Activation**:
   - Activation takes 15 minutes to 24 hours
   - You'll receive email confirmation
   - Some accounts require manual verification

3. **Login to Console**:
   - Go to [cloud.oracle.com](https://cloud.oracle.com)
   - Sign in with your credentials
   - You'll see the OCI Console dashboard

#### Part 2: Create Free VM Instance

1. **Navigate to Compute**:
   - Click hamburger menu (☰)
   - Select "Compute" → "Instances"
   - Click "Create Instance"

2. **Configure Instance**:
   ```
   Name: lenquant-prod
   
   Placement:
   - Availability Domain: Any available
   
   Image and Shape:
   - Image: Ubuntu 22.04 (Minimal)
   - Shape: 
     Option A: VM.Standard.E2.1.Micro (AMD) - 1GB RAM, 1 OCPU
     Option B: VM.Standard.A1.Flex (ARM) - 4 OCPU, 24GB RAM (RECOMMENDED)
   
   Note: ARM option is better but sometimes out of capacity.
   If ARM unavailable, use 2x AMD instances.
   ```

3. **Configure Networking**:
   ```
   Create new virtual cloud network (VCN):
   Name: lenquant-vcn
   
   Create new subnet:
   Name: public-subnet
   
   Assign public IP: Yes ✓
   ```

4. **Add SSH Keys**:
   - **Option A**: Generate new key pair (OCI will create and download)
     - Click "Generate SSH key pair"
     - Click "Save Private Key" (save as `lenquant.key`)
     - Click "Save Public Key" (optional)
   
   - **Option B**: Use existing SSH key
     - Paste your public key content

5. **Configure Boot Volume**:
   ```
   Size: 50GB (100GB available on free tier)
   ```

6. **Click "Create"**:
   - Instance will be in "Provisioning" state (2-5 minutes)
   - Wait until status changes to "Running"
   - Note down the **Public IP address** (e.g., 150.136.245.123)

#### Part 3: Configure Firewall Rules

1. **Configure VCN Security List**:
   - Go to "Networking" → "Virtual Cloud Networks"
   - Click your VCN (lenquant-vcn)
   - Click "Security Lists" → "Default Security List"
   - Click "Add Ingress Rules"

2. **Add Rules**:
   ```
   Rule 1: SSH
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Destination Port: 22
   Description: SSH access
   
   Rule 2: HTTP
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Destination Port: 80
   Description: HTTP web access
   
   Rule 3: HTTPS
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Destination Port: 443
   Description: HTTPS web access
   
   Rule 4: Backend API
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Destination Port: 8000
   Description: FastAPI backend
   
   Rule 5: Frontend
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Destination Port: 3000
   Description: Next.js frontend
   ```

3. **Click "Add Ingress Rules"**

#### Part 4: Connect to VM

**On Windows:**
```powershell
# Convert .key to .ppk if using PuTTY (optional)
# Or use native OpenSSH in PowerShell:

# Set correct permissions
icacls lenquant.key /inheritance:r
icacls lenquant.key /grant:r "%username%:R"

# Connect
ssh -i lenquant.key ubuntu@150.136.245.123
```

**On macOS/Linux:**
```bash
# Set correct permissions
chmod 400 lenquant.key

# Connect
ssh -i lenquant.key ubuntu@150.136.245.123
```

**Note**: Replace `150.136.245.123` with your actual public IP.

#### Part 5: Configure Ubuntu Firewall

Once connected to the VM:

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Configure UFW firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8000/tcp  # Backend API
sudo ufw allow 3000/tcp  # Frontend

# Enable firewall
sudo ufw --force enable

# Check status
sudo ufw status
```

#### Part 6: Install Dependencies

```bash
# Install Python 3.11
sudo apt install -y software-properties-common
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3.11-dev

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install build essentials
sudo apt install -y build-essential git curl wget

# Install Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verify installations
python3.11 --version
node --version
npm --version
redis-cli ping  # Should return PONG
```

#### Part 7: Setup MongoDB Atlas (Free Cloud Database)

**Why MongoDB Atlas?**
- 512MB free tier (enough for 6-12 months of data)
- Managed service (no maintenance)
- Automatic backups
- Better than running MongoDB on small VM

**Steps:**

1. **Create Account**:
   - Go to [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)
   - Sign up with email or Google
   - No credit card required

2. **Create Free Cluster**:
   - Click "Build a Database"
   - Select "M0 Free" tier
   - Choose provider: AWS
   - Choose region: Closest to your Oracle Cloud region
   - Cluster name: `lenquant-cluster`
   - Click "Create"

3. **Setup Database Access**:
   - Click "Database Access" in left menu
   - Click "Add New Database User"
   - Authentication Method: Password
   - Username: `lenquant`
   - Password: Generate secure password (save it!)
   - Database User Privileges: "Read and write to any database"
   - Click "Add User"

4. **Setup Network Access**:
   - Click "Network Access" in left menu
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Click "Confirm"
   - **Note**: For production, restrict to your VM IP only

5. **Get Connection String**:
   - Click "Database" in left menu
   - Click "Connect" on your cluster
   - Click "Connect your application"
   - Driver: Python, Version: 3.12 or later
   - Copy connection string:
     ```
     mongodb+srv://lenquant:<password>@lenquant-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<password>` with your actual password

#### Part 8: Deploy Application

```bash
# Clone repository
cd /home/ubuntu
git clone <your-repo-url> cryptotrader
cd cryptotrader

# Create virtual environment
python3.11 -m venv .venv
source .venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Install frontend dependencies
cd web/next-app
npm install
npm run build  # Build for production
cd ../..

# Create .env file
nano .env
```

**Configure .env**:
```env
# MongoDB Atlas connection
MONGO_URI=mongodb+srv://lenquant:YOUR_PASSWORD@lenquant-cluster.xxxxx.mongodb.net/lenquant?retryWrites=true&w=majority

# Redis (local)
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
CELERY_EXPERIMENT_QUEUE=experiments

# Trading symbols
DEFAULT_SYMBOLS=BTC/USDT,ETH/USDT,SOL/USDT,BNB/USDT
FEATURE_INTERVALS=1m,1h,1d

# Exchange API (add your keys)
BINANCE_API_KEY=
BINANCE_API_SECRET=

# AI Assistant (optional)
ASSISTANT_LLM_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Reports
REPORT_OUTPUT_DIR=/home/ubuntu/cryptotrader/reports/output
```

Save: `Ctrl+X`, then `Y`, then `Enter`

#### Part 9: Setup Systemd Services (Auto-start on boot)

**Create Backend Service:**
```bash
sudo nano /etc/systemd/system/lenquant-api.service
```

```ini
[Unit]
Description=LenQuant FastAPI Backend
After=network.target redis-server.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/cryptotrader
Environment="PATH=/home/ubuntu/cryptotrader/.venv/bin"
ExecStart=/home/ubuntu/cryptotrader/.venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Create Worker Service:**
```bash
sudo nano /etc/systemd/system/lenquant-worker.service
```

```ini
[Unit]
Description=LenQuant Celery Worker
After=network.target redis-server.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/cryptotrader
Environment="PATH=/home/ubuntu/cryptotrader/.venv/bin"
ExecStart=/home/ubuntu/cryptotrader/.venv/bin/celery -A manager.tasks:celery_app worker --loglevel=info
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Create Frontend Service:**
```bash
sudo nano /etc/systemd/system/lenquant-frontend.service
```

```ini
[Unit]
Description=LenQuant Next.js Frontend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/cryptotrader/web/next-app
Environment="PATH=/usr/bin:/usr/local/bin"
Environment="NODE_ENV=production"
Environment="NEXT_PUBLIC_API_URL=http://localhost:8000"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and Start Services:**
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable services (start on boot)
sudo systemctl enable lenquant-api
sudo systemctl enable lenquant-worker
sudo systemctl enable lenquant-frontend

# Start services
sudo systemctl start lenquant-api
sudo systemctl start lenquant-worker
sudo systemctl start lenquant-frontend

# Check status
sudo systemctl status lenquant-api
sudo systemctl status lenquant-worker
sudo systemctl status lenquant-frontend

# View logs
sudo journalctl -u lenquant-api -f
```

#### Part 10: Setup Nginx Reverse Proxy (Optional but Recommended)

**Why Nginx?**
- SSL/TLS termination (HTTPS)
- Better performance
- Load balancing
- Security headers

```bash
# Install Nginx
sudo apt install -y nginx

# Create configuration
sudo nano /etc/nginx/sites-available/lenquant
```

```nginx
server {
    listen 80;
    server_name _;  # Replace with your domain if you have one

    # Increase timeouts for long-running requests
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket endpoints
    location /ws/ {
        proxy_pass http://localhost:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/lenquant /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

#### Part 11: Setup SSL with Let's Encrypt (Optional)

**Note**: Requires a domain name. You can get a free domain from [freenom.com](https://www.freenom.com) or use [duckdns.org](https://www.duckdns.org).

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (replace yourdomain.com)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certificate will auto-renew
# Test renewal:
sudo certbot renew --dry-run
```

#### Part 12: Setup Automated Data Collection

```bash
# Create cron job for data fetching
crontab -e

# Add this line (fetch data every hour)
0 * * * * cd /home/ubuntu/cryptotrader && /home/ubuntu/cryptotrader/.venv/bin/python -m data_ingest.fetcher >> /home/ubuntu/logs/data-fetch.log 2>&1

# Add model retraining (daily at 2 AM)
0 2 * * * cd /home/ubuntu/cryptotrader && /home/ubuntu/cryptotrader/.venv/bin/python scripts/run_retraining.py >> /home/ubuntu/logs/training.log 2>&1

# Create logs directory
mkdir -p /home/ubuntu/logs
```

#### Part 13: Initial Data Load & Testing

```bash
# Activate virtual environment
cd /home/ubuntu/cryptotrader
source .venv/bin/activate

# Seed symbols
python scripts/seed_symbols.py

# Fetch initial data (30 days)
python -m data_ingest.fetcher --lookback-days 30

# Train models
python scripts/run_retraining.py

# Test API
curl http://localhost:8000/api/status

# Test frontend
curl http://localhost
```

#### Part 14: Access Your System

**Direct Access:**
- Frontend: `http://YOUR_VM_IP/` (e.g., http://150.136.245.123/)
- Backend API: `http://YOUR_VM_IP/api/status`

**With Domain:**
- Frontend: `https://yourdomain.com/`
- Backend API: `https://yourdomain.com/api/status`

#### Part 15: Setup Cloudflare (Optional - Free CDN)

**Benefits:**
- Free SSL/TLS
- DDoS protection
- Global CDN
- Better performance
- Hide your server IP

**Steps:**

1. **Sign up**: [cloudflare.com](https://www.cloudflare.com)
2. **Add site**: Enter your domain
3. **Update nameservers**: Update at your domain registrar
4. **Add DNS records**:
   ```
   Type: A
   Name: @
   Content: YOUR_VM_IP
   Proxy: Enabled (orange cloud)
   
   Type: A
   Name: www
   Content: YOUR_VM_IP
   Proxy: Enabled (orange cloud)
   ```
5. **SSL/TLS settings**:
   - Mode: Full (strict)
   - Always Use HTTPS: On
   - Automatic HTTPS Rewrites: On

---

### Oracle Cloud Free Tier - Cost Breakdown

| Service | Free Tier Allowance | Value | Our Usage |
|---------|-------------------|-------|-----------|
| Compute | 2x AMD VMs (1GB RAM) OR 1x ARM VM (24GB RAM) | $50-100/mo | ARM VM |
| Block Storage | 200GB | $20/mo | 50GB |
| Network | 10TB outbound/month | $100/mo | ~100GB/mo |
| MongoDB Atlas | 512MB storage | $0-10/mo | 512MB |
| Redis | Self-hosted on VM | $10/mo | Included |
| **Total Cost** | | **~$180-240/mo** | **$0/month** |

---

### Monitoring Your Free Deployment

```bash
# Check system resources
htop  # Install with: sudo apt install htop

# Check disk usage
df -h

# Check memory usage
free -h

# View service logs
sudo journalctl -u lenquant-api -f
sudo journalctl -u lenquant-worker -f
sudo journalctl -u lenquant-frontend -f

# Check MongoDB Atlas usage
# Login to cloud.mongodb.com → Clusters → Metrics
```

---

## Deployment Option 2: Budget-Friendly ($10-20/month)

**Total Cost: $10-20/month**

This option provides better performance and easier management using affordable cloud providers.

### Recommended Providers

**Option A: DigitalOcean** ($12/month)
**Option B: Hetzner Cloud** (€9/month ~ $10/month)
**Option C: Linode** ($12/month)

**Why these providers?**
- Simple pricing
- Good performance
- Excellent documentation
- Great support
- Easy to scale
- Predictable costs

### Architecture (DigitalOcean Example)

```
┌─────────────────────────────────────────┐
│    DigitalOcean Droplet ($12/mo)        │
│    2 vCPU, 4GB RAM, 80GB SSD            │
│  ┌────────┐ ┌────────┐ ┌─────────────┐ │
│  │Backend │ │Worker  │ │  Frontend   │ │
│  │FastAPI │ │Celery  │ │   Next.js   │ │
│  └────────┘ └────────┘ └─────────────┘ │
│  ┌────────┐ ┌────────────────────────┐ │
│  │ Redis  │ │      MongoDB           │ │
│  └────────┘ └────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Step-by-Step Setup (DigitalOcean)

#### Part 1: Create DigitalOcean Account

1. **Sign Up**:
   - Go to [digitalocean.com](https://www.digitalocean.com)
   - Sign up with email or GitHub
   - Add payment method (credit card)
   - **Note**: Often have promos like "$200 credit for 60 days"

2. **Verify Email**:
   - Check email for verification link
   - Complete verification

#### Part 2: Create Droplet

1. **Click "Create" → "Droplets"**

2. **Choose Image**:
   ```
   Distributions → Ubuntu 22.04 (LTS) x64
   ```

3. **Choose Plan**:
   ```
   Basic Plan
   CPU Options: Regular Intel ($12/mo)
   
   Configuration:
   - 2 GB RAM / 2 vCPUs
   - 60 GB SSD
   - 3 TB transfer
   
   Price: $12/month
   
   OR for better performance:
   
   Premium Intel ($18/mo):
   - 2 GB RAM / 2 vCPUs
   - 50 GB SSD
   - 3 TB transfer
   - NVMe SSD (faster)
   ```

4. **Choose Datacenter Region**:
   - Select closest to your location
   - Or closest to your exchange (e.g., Singapore for Binance)

5. **Authentication**:
   - **Recommended**: SSH Key
     - Click "New SSH Key"
     - On your computer:
       ```bash
       # Generate key
       ssh-keygen -t ed25519 -C "lenquant"
       # Save to: ~/.ssh/lenquant_ed25519
       
       # Copy public key
       # Windows:
       type %USERPROFILE%\.ssh\lenquant_ed25519.pub
       # macOS/Linux:
       cat ~/.ssh/lenquant_ed25519.pub
       ```
     - Paste public key into DigitalOcean
     - Name: "LenQuant Key"
   
   - **Alternative**: Password (less secure)

6. **Additional Options**:
   - ✓ Enable IPv6
   - ✓ Enable Monitoring (free)
   - User data: Leave blank

7. **Finalize**:
   - Hostname: `lenquant-prod`
   - Tags: `production`, `trading`
   - Backups: ❌ (costs extra $2.40/mo, optional)
   - Click "Create Droplet"

8. **Wait for Creation** (30-60 seconds)
   - Note the IP address (e.g., 142.93.123.45)

#### Part 3: Initial Server Setup

```bash
# Connect to droplet
ssh root@142.93.123.45

# Update system
apt update && apt upgrade -y

# Create non-root user
adduser lenquant
usermod -aG sudo lenquant

# Setup SSH for new user
rsync --archive --chown=lenquant:lenquant ~/.ssh /home/lenquant

# Switch to new user
su - lenquant

# From now on, use this user
```

#### Part 4: Install Docker & Docker Compose

**Why Docker on DigitalOcean?**
- Easier management
- Better resource isolation
- Simpler updates
- Consistent environment

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Start Docker on boot
sudo systemctl enable docker

# Logout and login again for group changes
exit
ssh lenquant@142.93.123.45

# Verify Docker
docker --version
docker run hello-world
```

#### Part 5: Deploy Application with Docker Compose

```bash
# Clone repository
cd ~
git clone <your-repo-url> cryptotrader
cd cryptotrader

# Create .env file
nano .env
```

**Configure .env**:
```env
# MongoDB (local Docker)
MONGO_URI=mongodb://mongo:27017/lenquant

# Redis (local Docker)
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
CELERY_EXPERIMENT_QUEUE=experiments

# Trading
DEFAULT_SYMBOLS=BTC/USDT,ETH/USDT,SOL/USDT,BNB/USDT
FEATURE_INTERVALS=1m,1h,1d

# Exchange API
BINANCE_API_KEY=your_key_here
BINANCE_API_SECRET=your_secret_here

# AI Assistant (optional)
ASSISTANT_LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini

# Reports
REPORT_OUTPUT_DIR=/app/reports/output
```

**Update docker-compose.yml for production**:
```bash
cd docker
nano docker-compose.yml
```

Add persistent volumes and restart policies:
```yaml
version: '3.8'

services:
  redis:
    image: redis:7.2-alpine
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  mongo:
    image: mongo:8.2
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=lenquant

  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile.python
    restart: always
    environment:
      - MONGO_URI=mongodb://mongo:27017/lenquant
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/0
      - CELERY_EXPERIMENT_QUEUE=experiments
    ports:
      - "8000:8000"
    depends_on:
      - mongo
      - redis
    env_file:
      - ../.env

  web:
    build:
      context: ..
      dockerfile: docker/Dockerfile.next
    restart: always
    environment:
      - NEXT_PUBLIC_API_URL=http://152.42.168.244:8000
    ports:
      - "3000:3000"
    depends_on:
      - api

  worker:
    build:
      context: ..
      dockerfile: docker/Dockerfile.python
    restart: always
    command: celery -A manager.tasks:celery_app worker --loglevel=info
    environment:
      - MONGO_URI=mongodb://mongo:27017/lenquant
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/0
      - CELERY_EXPERIMENT_QUEUE=experiments
    depends_on:
      - mongo
      - redis
    env_file:
      - ../.env

volumes:
  mongo-data:
  redis-data:
```

**Start services**:
```bash
# Build and start all services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Check specific service
docker-compose logs -f api
```

#### Part 6: Setup Nginx with SSL

```bash
# Exit docker directory
cd ~

# Install Nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/lenquant
```

**Nginx configuration**:
```nginx
server {
    listen 80;
    server_name 142.93.123.45;  # Replace with your domain if you have one

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    location /ws/ {
        proxy_pass http://localhost:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/lenquant /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### Part 7: Setup Automated Backups

**DigitalOcean Automated Backups** ($2.40/mo):
- Navigate to Droplet → Backups → Enable

**Manual Backup Script**:
```bash
# Create backup script
nano ~/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/lenquant/backups"
mkdir -p $BACKUP_DIR

# Backup MongoDB
docker exec cryptotrader-mongo-1 mongodump --out /tmp/backup
docker cp cryptotrader-mongo-1:/tmp/backup $BACKUP_DIR/mongo_$DATE

# Backup environment files
cp ~/.env $BACKUP_DIR/env_$DATE

# Compress
cd $BACKUP_DIR
tar -czf backup_$DATE.tar.gz mongo_$DATE env_$DATE
rm -rf mongo_$DATE env_$DATE

# Keep only last 7 backups
ls -t backup_*.tar.gz | tail -n +8 | xargs -r rm

echo "Backup completed: backup_$DATE.tar.gz"
```

```bash
# Make executable
chmod +x ~/backup.sh

# Schedule daily backups
crontab -e

# Add this line (backup at 3 AM daily)
0 3 * * * /home/lenquant/backup.sh >> /home/lenquant/backup.log 2>&1
```

#### Part 8: Setup Monitoring

**Install monitoring tools**:
```bash
# Install htop, iotop, nethogs
sudo apt install -y htop iotop nethogs

# Setup Docker monitoring
docker run -d \
  --name=cadvisor \
  --restart=always \
  --volume=/:/rootfs:ro \
  --volume=/var/run:/var/run:ro \
  --volume=/sys:/sys:ro \
  --volume=/var/lib/docker/:/var/lib/docker:ro \
  --publish=8080:8080 \
  --detach=true \
  google/cadvisor:latest

# Access monitoring at: http://YOUR_IP:8080
```

**Setup alerts with Uptime Robot** (free):
1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. Add monitor:
   - Monitor Type: HTTP(s)
   - URL: http://YOUR_IP/api/status
   - Monitoring Interval: 5 minutes
3. Setup alerts:
   - Email notifications
   - SMS (paid feature)

#### Part 9: Access Your System

- Frontend: `http://142.93.123.45/`
- Backend API: `http://142.93.123.45/api/status`
- Monitoring: `http://142.93.123.45:8080/`

---

### Budget Option Cost Breakdown

| Provider | Plan | Specs | Price |
|----------|------|-------|-------|
| **DigitalOcean** | Basic | 2 vCPU, 4GB RAM, 80GB SSD | $12/mo |
| **Hetzner** | CX21 | 2 vCPU, 4GB RAM, 40GB SSD | €4.49/mo (~$5/mo) |
| **Linode** | Nanode 1GB → 4GB | 2 vCPU, 4GB RAM, 80GB SSD | $12/mo |
| **Vultr** | Regular Performance | 2 vCPU, 4GB RAM, 80GB SSD | $12/mo |

**Additional costs (optional)**:
- Domain name: $10-15/year (~$1/mo)
- Backups: $2-3/mo
- Cloudflare CDN: Free

**Total: $10-20/month**

---

## Deployment Option 3: Enterprise AWS ($50-150/month)

**Total Cost: $50-150/month**

Enterprise-grade deployment with high availability, auto-scaling, and managed services.

### Architecture

```
                     ┌──────────────────┐
                     │  Route 53 (DNS)  │
                     └────────┬─────────┘
                              │
                     ┌────────▼─────────┐
                     │ CloudFront (CDN) │
                     └────────┬─────────┘
                              │
                     ┌────────▼─────────┐
                     │  Load Balancer   │
                     └────────┬─────────┘
                              │
         ┌────────────────────┴────────────────────┐
         │                                         │
    ┌────▼─────┐                         ┌────────▼────────┐
    │  EC2 #1  │                         │     EC2 #2      │
    │(Backend) │                         │   (Replica)     │
    └────┬─────┘                         └─────────────────┘
         │
    ┌────▼──────────────────────────────────┐
    │                                        │
┌───▼───────┐  ┌──────────────┐  ┌─────────▼──────┐
│ RDS       │  │  ElastiCache │  │   ECS Fargate  │
│ MongoDB   │  │  (Redis)     │  │  (Containers)  │
│ Atlas     │  └──────────────┘  └────────────────┘
└───────────┘
```

### Prerequisites

- AWS Account
- AWS CLI installed
- Basic understanding of AWS services

### Step-by-Step Setup

#### Part 1: Create AWS Account

1. **Sign Up**:
   - Go to [aws.amazon.com](https://aws.amazon.com)
   - Click "Create an AWS Account"
   - Enter email and account name
   - Add payment method

2. **Setup MFA** (Multi-Factor Authentication):
   - Go to IAM → Users → Security credentials
   - Enable MFA for root account
   - Use Google Authenticator or Authy

3. **Create IAM User** (Don't use root):
   - Go to IAM → Users → Add user
   - Username: `lenquant-admin`
   - Access type: Both (Programmatic + Console)
   - Permissions: AdministratorAccess (for setup)
   - Download credentials CSV

#### Part 2: Install AWS CLI

**Windows**:
```powershell
# Download and install from:
# https://awscli.amazonaws.com/AWSCLIV2.msi

# Verify
aws --version
```

**macOS**:
```bash
brew install awscli

# Verify
aws --version
```

**Linux**:
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify
aws --version
```

**Configure AWS CLI**:
```bash
aws configure

# Enter:
AWS Access Key ID: YOUR_ACCESS_KEY
AWS Secret Access Key: YOUR_SECRET_KEY
Default region name: us-east-1  # or your preferred region
Default output format: json
```

#### Part 3: Setup VPC & Security Groups

**Create VPC**:
```bash
# Create VPC
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=lenquant-vpc}]'

# Note the VpcId from output
VPC_ID=vpc-xxxxxxxxxx

# Create Internet Gateway
aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=lenquant-igw}]'

IGW_ID=igw-xxxxxxxxxx

# Attach Internet Gateway to VPC
aws ec2 attach-internet-gateway \
  --vpc-id $VPC_ID \
  --internet-gateway-id $IGW_ID

# Create Subnet
aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=lenquant-subnet}]'

SUBNET_ID=subnet-xxxxxxxxxx

# Create Route Table
aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=lenquant-rt}]'

RT_ID=rtb-xxxxxxxxxx

# Create route to Internet Gateway
aws ec2 create-route \
  --route-table-id $RT_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID

# Associate subnet with route table
aws ec2 associate-route-table \
  --route-table-id $RT_ID \
  --subnet-id $SUBNET_ID
```

**Create Security Group**:
```bash
aws ec2 create-security-group \
  --group-name lenquant-sg \
  --description "Security group for LenQuant" \
  --vpc-id $VPC_ID

SG_ID=sg-xxxxxxxxxx

# Allow SSH (port 22)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

# Allow HTTP (port 80)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# Allow HTTPS (port 443)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Allow Backend API (port 8000)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 8000 \
  --cidr 0.0.0.0/0
```

#### Part 4: Create EC2 Instance

**Create Key Pair**:
```bash
aws ec2 create-key-pair \
  --key-name lenquant-key \
  --query 'KeyMaterial' \
  --output text > lenquant-key.pem

# Set permissions
chmod 400 lenquant-key.pem
```

**Launch EC2 Instance**:
```bash
# Find latest Ubuntu AMI
aws ec2 describe-images \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
  --query 'Images[*].[ImageId,Name,CreationDate]' \
  --output table

AMI_ID=ami-xxxxxxxxxx  # Use latest from above

# Launch instance
aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t3.medium \
  --key-name lenquant-key \
  --security-group-ids $SG_ID \
  --subnet-id $SUBNET_ID \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=lenquant-prod}]' \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=100,VolumeType=gp3}' \
  --associate-public-ip-address

INSTANCE_ID=i-xxxxxxxxxx

# Wait for instance to be running
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Get public IP
aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text

PUBLIC_IP=xx.xx.xx.xx
```

#### Part 5: Setup Managed MongoDB (Atlas)

**Alternative: AWS DocumentDB** (more expensive)

Use MongoDB Atlas (same as free tier option):
1. Create M10 cluster ($57/month)
2. Better performance than free tier
3. Automated backups
4. Point-in-time recovery
5. Multi-region support

**Setup**:
- Follow MongoDB Atlas setup from Option 1
- Choose M10 plan instead of M0
- Enable backups and monitoring

#### Part 6: Setup ElastiCache (Managed Redis)

```bash
# Create ElastiCache subnet group
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name lenquant-redis-subnet \
  --cache-subnet-group-description "Redis subnet group" \
  --subnet-ids $SUBNET_ID

# Create ElastiCache cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id lenquant-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1 \
  --cache-subnet-group-name lenquant-redis-subnet \
  --security-group-ids $SG_ID

# Get Redis endpoint
aws elasticache describe-cache-clusters \
  --cache-cluster-id lenquant-redis \
  --show-cache-node-info \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
  --output text

REDIS_ENDPOINT=lenquant-redis.xxxxxx.cache.amazonaws.com
```

#### Part 7: Deploy Application to EC2

```bash
# Connect to EC2
ssh -i lenquant-key.pem ubuntu@$PUBLIC_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit

# Reconnect
ssh -i lenquant-key.pem ubuntu@$PUBLIC_IP

# Clone repository
git clone <your-repo-url> cryptotrader
cd cryptotrader

# Create .env file
nano .env
```

```env
# MongoDB Atlas
MONGO_URI=mongodb+srv://lenquant:password@cluster.mongodb.net/lenquant

# AWS ElastiCache Redis
CELERY_BROKER_URL=redis://lenquant-redis.xxxxxx.cache.amazonaws.com:6379/0
CELERY_RESULT_BACKEND=redis://lenquant-redis.xxxxxx.cache.amazonaws.com:6379/0
CELERY_EXPERIMENT_QUEUE=experiments

# Trading
DEFAULT_SYMBOLS=BTC/USDT,ETH/USDT,SOL/USDT,BNB/USDT
FEATURE_INTERVALS=1m,1h,1d

# Exchange API
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret

# AI Assistant
ASSISTANT_LLM_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini

REPORT_OUTPUT_DIR=/home/ubuntu/cryptotrader/reports/output
```

```bash
# Build and start with Docker Compose
cd docker
docker-compose up -d --build

# Verify
docker-compose ps
```

#### Part 8: Setup Application Load Balancer (Optional)

**For high availability and auto-scaling**:

```bash
# Create target group
aws elbv2 create-target-group \
  --name lenquant-tg \
  --protocol HTTP \
  --port 80 \
  --vpc-id $VPC_ID \
  --health-check-path /api/status

TG_ARN=arn:aws:elasticloadbalancing:...

# Create load balancer
aws elbv2 create-load-balancer \
  --name lenquant-alb \
  --subnets $SUBNET_ID \
  --security-groups $SG_ID

ALB_ARN=arn:aws:elasticloadbalancing:...

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN

# Register instance
aws elbv2 register-targets \
  --target-group-arn $TG_ARN \
  --targets Id=$INSTANCE_ID
```

#### Part 9: Setup CloudWatch Monitoring

```bash
# Create CloudWatch alarms
aws cloudwatch put-metric-alarm \
  --alarm-name lenquant-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=InstanceId,Value=$INSTANCE_ID

# Create SNS topic for alerts
aws sns create-topic --name lenquant-alerts

# Subscribe email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789:lenquant-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

#### Part 10: Setup Auto-Scaling (Optional)

```bash
# Create launch template
aws ec2 create-launch-template \
  --launch-template-name lenquant-template \
  --version-description "LenQuant v1" \
  --launch-template-data '{
    "ImageId":"'$AMI_ID'",
    "InstanceType":"t3.medium",
    "KeyName":"lenquant-key",
    "SecurityGroupIds":["'$SG_ID'"],
    "UserData":"BASE64_ENCODED_STARTUP_SCRIPT"
  }'

# Create auto-scaling group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name lenquant-asg \
  --launch-template LaunchTemplateName=lenquant-template \
  --min-size 1 \
  --max-size 3 \
  --desired-capacity 1 \
  --vpc-zone-identifier $SUBNET_ID \
  --target-group-arns $TG_ARN

# Create scaling policies
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name lenquant-asg \
  --policy-name scale-up \
  --scaling-adjustment 1 \
  --adjustment-type ChangeInCapacity
```

#### Part 11: Setup S3 for Backups

```bash
# Create S3 bucket
aws s3 mb s3://lenquant-backups-$(date +%s)

BUCKET_NAME=lenquant-backups-1234567890

# Create backup script on EC2
ssh -i lenquant-key.pem ubuntu@$PUBLIC_IP

# Create script
nano ~/backup-to-s3.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)

# Backup MongoDB
docker exec cryptotrader-mongo-1 mongodump --archive=/tmp/backup_$DATE.archive

# Upload to S3
aws s3 cp /tmp/backup_$DATE.archive s3://lenquant-backups/backups/mongo_$DATE.archive

# Cleanup old backups (keep 30 days)
aws s3 ls s3://lenquant-backups/backups/ | \
  awk '{print $4}' | \
  sort | \
  head -n -30 | \
  xargs -I {} aws s3 rm s3://lenquant-backups/backups/{}

echo "Backup completed: mongo_$DATE.archive"
```

```bash
# Make executable
chmod +x ~/backup-to-s3.sh

# Schedule daily backups
crontab -e
0 3 * * * /home/ubuntu/backup-to-s3.sh >> /home/ubuntu/backup.log 2>&1
```

#### Part 12: Setup CloudFront CDN (Optional)

```bash
# Create CloudFront distribution for frontend
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json

# cloudfront-config.json:
{
  "CallerReference": "lenquant-$(date +%s)",
  "Comment": "LenQuant Frontend CDN",
  "Enabled": true,
  "Origins": {
    "Items": [{
      "Id": "lenquant-origin",
      "DomainName": "YOUR_ALB_DNS",
      "CustomOriginConfig": {
        "HTTPPort": 80,
        "OriginProtocolPolicy": "http-only"
      }
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "lenquant-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    }
  }
}
```

---

### AWS Cost Breakdown

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| **EC2 Instance** | t3.medium (2 vCPU, 4GB RAM) | $30 |
| **EBS Storage** | 100GB gp3 SSD | $8 |
| **ElastiCache** | cache.t3.micro (Redis) | $12 |
| **MongoDB Atlas** | M10 cluster | $57 |
| **Data Transfer** | ~500GB/month | $45 |
| **CloudWatch** | Metrics + Logs | $5 |
| **Load Balancer** | Application LB (optional) | $16 |
| **S3 Backups** | 50GB storage + requests | $2 |
| **Route 53** | Hosted zone (optional) | $0.50 |
| **Total (Basic)** | Without ALB | **~$112/mo** |
| **Total (Full)** | With all features | **~$175/mo** |

**Cost Optimization Tips**:
- Use Reserved Instances (30-60% savings)
- Use Spot Instances for workers (70% savings)
- Use S3 Intelligent-Tiering for backups
- Setup CloudWatch billing alerts

---

## Monitoring & Maintenance

### Health Checks

**Daily Checks**:
```bash
# Check system resources
htop
df -h
free -h

# Check service status
sudo systemctl status lenquant-*  # systemd
docker-compose ps  # Docker

# Check logs for errors
sudo journalctl -u lenquant-api --since "1 hour ago"
docker-compose logs --tail=100

# Check database connectivity
mongosh $MONGO_URI --eval "db.serverStatus().ok"
redis-cli -h $REDIS_HOST ping

# Check API health
curl http://localhost:8000/api/status
```

**Weekly Checks**:
- Review trading performance
- Check disk space usage
- Review error logs
- Verify backups are working
- Check for system updates

**Monthly Checks**:
- Security updates
- Cost analysis
- Performance optimization
- Database cleanup
- Strategy performance review

### Logging

**Centralized Logging Setup**:
```bash
# Install Loki + Promtail (log aggregation)
wget https://github.com/grafana/loki/releases/download/v2.9.0/loki-linux-amd64.zip
unzip loki-linux-amd64.zip
sudo mv loki-linux-amd64 /usr/local/bin/loki

# Create Loki config
sudo nano /etc/loki/config.yml
```

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 5m
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2020-05-15
      store: boltdb
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 168h

storage_config:
  boltdb:
    directory: /tmp/loki/index
  filesystem:
    directory: /tmp/loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s
```

### Performance Tuning

**MongoDB Optimization**:
```javascript
// Create indexes for frequently queried fields
db.ohlcv.createIndex({ symbol: 1, interval: 1, timestamp: -1 });
db.trades.createIndex({ timestamp: -1 });
db.positions.createIndex({ status: 1, updated_at: -1 });

// Enable compression
db.runCommand({ setParameter: 1, storageEngine: "wiredTiger" });
```

**Redis Optimization**:
```bash
# Edit redis.conf
nano /etc/redis/redis.conf

# Add these settings:
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
```

**Application Optimization**:
```bash
# Increase worker concurrency
celery -A manager.tasks:celery_app worker --concurrency=4

# Use multiple queues
celery -A manager.tasks:celery_app worker \
  -Q training,experiments,default \
  --concurrency=2
```

---

## Security Best Practices

### 1. Firewall Configuration

```bash
# Minimal open ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH only from your IP
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 2. SSH Hardening

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Change these settings:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 2222  # Use non-standard port
AllowUsers lenquant

# Restart SSH
sudo systemctl restart sshd
```

### 3. API Key Security

```bash
# Never commit .env files
echo ".env" >> .gitignore

# Use AWS Secrets Manager (AWS)
aws secretsmanager create-secret \
  --name lenquant/api-keys \
  --secret-string '{"binance_key":"xxx","binance_secret":"yyy"}'

# Retrieve in code:
import boto3
client = boto3.client('secretsmanager')
response = client.get_secret_value(SecretId='lenquant/api-keys')
secrets = json.loads(response['SecretString'])
```

### 4. Regular Updates

```bash
# Enable automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades

# Manual update schedule (weekly)
sudo apt update
sudo apt upgrade
sudo reboot  # If kernel updated
```

### 5. Monitoring & Alerts

**Setup fail2ban** (brute force protection):
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

**Setup intrusion detection**:
```bash
# Install OSSEC
wget https://github.com/ossec/ossec-hids/archive/3.7.0.tar.gz
tar -xvzf 3.7.0.tar.gz
cd ossec-hids-3.7.0
sudo ./install.sh
```

---

## Comparison Summary

### Quick Decision Matrix

**Choose Almost Free** if:
- ✓ You're testing/learning
- ✓ Trading with small capital (<$1000)
- ✓ Don't mind some setup complexity
- ✓ Want to minimize costs
- ✓ Can tolerate occasional downtime

**Choose Budget ($10-20/mo)** if:
- ✓ Serious about trading
- ✓ Trading with moderate capital ($1000-$10000)
- ✓ Want good performance
- ✓ Need reliable uptime
- ✓ Want easy management
- ✓ **Best value for most users**

**Choose AWS Enterprise** if:
- ✓ Professional trader
- ✓ Trading with large capital (>$10000)
- ✓ Need maximum uptime (99.9%)
- ✓ Want scalability
- ✓ Need compliance/audit
- ✓ Want managed services
- ✓ Company/team usage

---

## Next Steps After Deployment

1. ✅ **System Deployed**: Running 24/7 in cloud
2. ✅ **Monitoring Active**: Alerts configured
3. ✅ **Backups Enabled**: Data protected
4. ✅ **Security Hardened**: System secured

**Now Focus On**:
- **Trading Strategy**: Optimize and refine strategies
- **Risk Management**: Monitor and adjust limits
- **Performance**: Track and improve ROI
- **Learning**: Let system learn from data
- **Scaling**: Add more symbols and strategies

---

**🎉 Congratulations! Your LenQuant system is now deployed for 24/7 operation.**

For system startup instructions, see [STARTING_SYSTEM.md](./STARTING_SYSTEM.md).

