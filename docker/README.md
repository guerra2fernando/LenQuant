# Docker Configuration

## Setup

### First Time Setup

1. **Copy the example docker-compose file:**
   ```bash
   cp docker-compose.yml.example docker-compose.yml
   ```

2. **Edit `docker-compose.yml` for your environment:**
   - Update database names
   - Update ports if needed
   - Add your specific environment variables
   - Configure volumes and networks

3. **Start services:**
   ```bash
   docker-compose up -d
   ```

## Files

- **`docker-compose.yml.example`** - Template configuration file
- **`docker-compose.yml`** - Your local configuration (gitignored)
- **`Dockerfile.python`** - Python/FastAPI service container
- **`Dockerfile.next`** - Next.js frontend container

## Why docker-compose.yml is gitignored

The `docker-compose.yml` file is ignored in git because:
- It contains server-specific configurations
- Different environments (dev/staging/production) need different settings
- Prevents accidental overwrites of production configurations
- Keeps sensitive information out of version control

## Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### Rebuild containers
```bash
docker-compose build --no-cache
docker-compose up -d
```

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f worker
```

### Check status
```bash
docker-compose ps
```

### Restart a service
```bash
docker-compose restart api
docker-compose restart web
docker-compose restart worker
```

## Production Notes

For production deployments:
1. Use proper `.env` files for secrets
2. Configure proper volumes for data persistence
3. Set up health checks
4. Use specific image versions (not `latest`)
5. Configure resource limits
6. Set up logging drivers
7. Use networks for service isolation

See `docs/INFRASTRUCTURE.md` for complete production deployment guide.

