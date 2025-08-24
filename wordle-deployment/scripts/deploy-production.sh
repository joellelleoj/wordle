# =============================================================================
# deploy-production.sh - Zero-Downtime Production Deployment
# =============================================================================

#!/bin/bash

set -e

echo "🚀 Starting zero-downtime production deployment..."

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

cd "$SCRIPT_DIR"

# Detect compose command
if command -v podman-compose &> /dev/null; then
    COMPOSE_CMD="podman-compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Neither docker-compose nor podman-compose found"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "📋 Pre-deployment checks..."

# Check if current deployment is healthy
if ! ./health-check.sh > /dev/null 2>&1; then
    echo "⚠️ Current deployment is not healthy, proceeding with caution..."
fi

# Backup current configuration
echo "💾 Creating configuration backup..."
cp .env "${BACKUP_DIR}/.env.${TIMESTAMP}"
cp docker-compose.yml "${BACKUP_DIR}/docker-compose.yml.${TIMESTAMP}"

# Database backup
echo "🗄️ Creating database backup..."
if docker-compose ps postgres-main | grep -q "Up"; then
    docker-compose exec -T postgres-main pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" | gzip > "${BACKUP_DIR}/main-db-${TIMESTAMP}.sql.gz"
    echo "✅ Main database backed up"
fi

if docker-compose ps postgres-dict | grep -q "Up"; then
    docker-compose exec -T postgres-dict pg_dump -U "${DICT_POSTGRES_USER}" -d "${DICT_POSTGRES_DB}" | gzip > "${BACKUP_DIR}/dict-db-${TIMESTAMP}.sql.gz"
    echo "✅ Dictionary database backed up"
fi

# Rolling deployment strategy
echo "🔄 Starting rolling deployment..."

# Update services one by one to maintain availability
services=("user-service" "game-service" "profile-service" "api-gateway" "frontend")

for service in "${services[@]}"; do
    echo "🔄 Updating $service..."
    
    # Build new image
    $COMPOSE_CMD build --no-cache "$service"
    
    # Rolling update
    $COMPOSE_CMD up -d --no-deps "$service"
    
    # Wait for service to be healthy
    sleep 10
    
    # Health check for the specific service
    max_attempts=30
    attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if $COMPOSE_CMD exec -T "$service" curl -f http://localhost:*/health > /dev/null 2>&1; then
            echo "✅ $service is healthy"
            break
        fi
        
        echo "⏳ Waiting for $service to be healthy... (attempt $((attempt + 1))/$max_attempts)"
        sleep 5
        ((attempt++))
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        echo "❌ $service failed to become healthy, rolling back..."
        
        # Rollback this service
        git checkout HEAD~1 -- "../wordle-$service"
        $COMPOSE_CMD build "$service"
        $COMPOSE_CMD up -d --no-deps "$service"
        
        echo "💥 Deployment failed, rolled back $service"
        exit 1
    fi
done

# Final health check
echo "🔍 Final health check..."
sleep 10

if ./health-check.sh; then
    echo "🎉 Deployment successful!"
    
    # Clean up old backups (keep last 10)
    ls -t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | tail -n +11 | xargs rm -f
    ls -t "${BACKUP_DIR}"/.env.* 2>/dev/null | tail -n +11 | xargs rm -f
    
    echo "📊 Deployment summary:"
    echo "  • Timestamp: $TIMESTAMP"
    echo "  • Services updated: ${#services[@]}"
    echo "  • Backup location: $BACKUP_DIR"
    echo "  • Frontend: http://devstud.imn.htwk-leipzig.de/dev11"
    echo "  • API: http://devstud.imn.htwk-leipzig.de/dev11/api"
    
else
    echo "❌ Deployment verification failed!"
    echo "🔄 Consider rolling back using: git checkout HEAD~1 && ./start-all.sh"
    exit 1
fi