# =============================================================================
# health-check.sh - Comprehensive Health Check Script
# =============================================================================
#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load environment variables
if [[ -f ".env" ]]; then
    source .env
fi

# Detect container runtime
if command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
    COMPOSE_CMD="podman-compose"
elif command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}❌ Neither Docker nor Podman found${NC}"
    exit 1
fi

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}    Wordle Application Health Check${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Check container status
echo -e "${BLUE}🔍 Container Status:${NC}"

services=(
    "wordle-frontend"
    "wordle-api-gateway"
    "wordle-user-service"
    "wordle-game-service"
    "wordle-profile-service"
    "wordle-postgres-main"
    "wordle-postgres-dict"
    "wordle-redis"
)

all_healthy=true

for service in "${services[@]}"; do
    if $CONTAINER_CMD ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$service.*Up"; then
        echo -e "  ✅ $service"
    else
        echo -e "  ❌ $service (not running)"
        all_healthy=false
    fi
done

echo ""

# Check external endpoints
echo -e "${BLUE}🌐 External Endpoint Tests:${NC}"

# Test frontend
FRONTEND_URL="http://${FRONTEND_HOST:-127.0.10.11}:${FRONTEND_PORT:-8080}"
if curl -f -s -o /dev/null --max-time 10 "$FRONTEND_URL"; then
    echo -e "  ✅ Frontend ($FRONTEND_URL)"
else
    echo -e "  ❌ Frontend ($FRONTEND_URL)"
    all_healthy=false
fi

# Test API Gateway health endpoint
API_URL="http://${API_GATEWAY_HOST:-127.0.10.11}:${API_GATEWAY_PORT:-8082}/health"
if curl -f -s -o /dev/null --max-time 10 "$API_URL"; then
    echo -e "  ✅ API Gateway ($API_URL)"
else
    echo -e "  ❌ API Gateway ($API_URL)"
    all_healthy=false
fi

echo ""

# Check database connections
echo -e "${BLUE}🗄️ Database Health:${NC}"

# Test main PostgreSQL
if $CONTAINER_CMD exec wordle-postgres-main pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" > /dev/null 2>&1; then
    echo -e "  ✅ Main PostgreSQL Database"
else
    echo -e "  ❌ Main PostgreSQL Database"
    all_healthy=false
fi

# Test dictionary PostgreSQL
if $CONTAINER_CMD exec wordle-postgres-dict pg_isready -U "${DICT_POSTGRES_USER}" -d "${DICT_POSTGRES_DB}" > /dev/null 2>&1; then
    echo -e "  ✅ Dictionary PostgreSQL Database"
else
    echo -e "  ❌ Dictionary PostgreSQL Database"
    all_healthy=false
fi

# Test Redis
if $CONTAINER_CMD exec wordle-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" ping > /dev/null 2>&1; then
    echo -e "  ✅ Redis Cache"
else
    echo -e "  ❌ Redis Cache"
    all_healthy=false
fi

echo ""

# Check internal service health endpoints
echo -e "${BLUE}🔧 Internal Service Health:${NC}"

internal_services=(
    "user-service:3002"
    "game-service:3001"
    "profile-service:3003"
)

for service_port in "${services[@]}"; do
    service_name=$(echo $service_port | cut -d: -f1)
    port=$(echo $service_port | cut -d: -f2)
    
    if $CONTAINER_CMD exec "wordle-$service_name" curl -f -s -o /dev/null --max-time 5 "http://localhost:$port/health" 2>/dev/null; then
        echo -e "  ✅ $service_name"
    else
        echo -e "  ❌ $service_name"
        all_healthy=false
    fi
done

echo ""

# Resource usage
echo -e "${BLUE}📊 Resource Usage:${NC}"
$CONTAINER_CMD stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep wordle

echo ""

# Network connectivity test
echo -e "${BLUE}🌐 Network Connectivity:${NC}"
if $CONTAINER_CMD exec wordle-api-gateway ping -c 1 wordle-user-service > /dev/null 2>&1; then
    echo -e "  ✅ Inter-service network connectivity"
else
    echo -e "  ❌ Inter-service network connectivity"
    all_healthy=false
fi

echo ""

# Summary
echo -e "${BLUE}=========================================${NC}"
if $all_healthy; then
    echo -e "${GREEN}🎉 All systems healthy!${NC}"
    echo ""
    echo -e "${GREEN}Application URLs:${NC}"
    echo -e "  🌐 Production: http://devstud.imn.htwk-leipzig.de/dev11"
    echo -e "  🔧 Development: $FRONTEND_URL"
    echo -e "  📡 API: $API_URL"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some systems are unhealthy${NC}"
    echo ""
    echo -e "${YELLOW}💡 Troubleshooting commands:${NC}"
    echo -e "  📋 View all logs: $COMPOSE_CMD logs"
    echo -e "  🔍 View service logs: $COMPOSE_CMD logs [service-name]"
    echo -e "  🔄 Restart services: $COMPOSE_CMD restart"
    echo -e "  🛠️ Rebuild services: $COMPOSE_CMD up --build -d"
    echo ""
    exit 1
fi
