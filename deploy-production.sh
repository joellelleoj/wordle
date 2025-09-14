🚀 Starting Complete Wordle Application Stack
==============================================
✅ Using: podman with docker-compose
📄 Loading environment variables from .env.prod
🔍 Verifying environment variables...
NODE_ENV: production
./deploy.sh: line 165: unexpected EOF while lookin

dev11@devstud:~/wordle-project/wordle-deployment$ cat deploy.sh
#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🚀 Starting Complete Wordle Application Stack"
echo "=============================================="

COMPOSE_FILE="docker-compose.prod.yml"

# Copy environment file
if [ ! -f ".env.prod" ]; then
    echo -e "${RED}❌ Missing .env.prod file${NC}"
    exit 1
fi

# Check for container runtime
CONTAINER_CMD=""
COMPOSE_CMD=""

if command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
    if command -v podman-compose &> /dev/null; then
        COMPOSE_CMD="podman-compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        echo -e "${RED}❌ No compose command found${NC}"
        exit 1
    fi
elif command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        echo -e "${RED}❌ No compose command found${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Neither Docker nor Podman is installed${NC}"
    exit 1
fi

echo -e "${BLUE}✅ Using: $CONTAINER_CMD with $COMPOSE_CMD${NC}"

# Check if container runtime is running
if ! $CONTAINER_CMD info &> /dev/null; then
    echo -e "${RED}❌ $CONTAINER_CMD is not running${NC}"
    exit 1
fi

# Check if we're in the correct directory
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ $COMPOSE_FILE not found. Please run from the deployment directory.${NC}"
    exit 1
fi

# Load environment variables
echo -e "${BLUE}📄 Loading environment variables from .env.prod${NC}"
set -a
source .env.prod
set +a

# Verify critical variables are loaded
echo -e "${BLUE}🔍 Verifying environment variables...${NC}"
echo "NODE_ENV: ${NODE_ENV:-NOT_SET}"
echo "EXTERNAL_FRONTEND_PORT: ${EXTERNAL_FRONTEND_PORT"
echo "EXTERNAL_USER_SERVICE_PORT: ${EXTERNAL_USER_SERVICE_PORT"
echo "POSTGRES_DB: ${POSTGRES_DB:-NOT_SET}"

# Stop any running containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE down --remove-orphans 2>/dev/null || true

# Clean up any orphaned containers
$CONTAINER_CMD container prune -f 2>/dev/null || true
$CONTAINER_CMD network prune -f 2>/dev/null || true

echo -e "${BLUE}🔨 Building and starting services in correct order...${NC}"

# Start services in dependency order
echo -e "${YELLOW}📅 Step 1: Starting PostgreSQL database...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE up -d postgres
sleep 15

echo -e "${YELLOW}📅 Step 2: Running database setup...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE up --build database-setup
sleep 10

echo -e "${YELLOW}📅 Step 3: Starting core services...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE up --build -d user-service game-service profile-service
sleep 20

echo -e "${YELLOW}📅 Step 4: Starting API gateway...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE up --build -d api-gateway
sleep 15

echo -e "${YELLOW}📅 Step 5: Starting frontend...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE up --build -d frontend
sleep 15

# Wait for all services to be ready
echo -e "${YELLOW}⏳ Waiting for services to fully initialize...${NC}"
sleep 30

# Check service health
echo -e "${BLUE}🏥 Checking service health...${NC}"

# Production URLs
echo -e "${BLUE}🌐 Production URLs:${NC}"
echo -e "${BLUE}📱 Frontend:${NC} https://devstud.imn.htwk-leipzig.de/dev11"
echo -e "${BLUE}🔗 API Gateway:${NC} https://devstud.imn.htwk-leipzig.de/dev11/api2"

# Test endpoints
echo -e "${YELLOW}🔍 Testing local endpoints...${NC}"

if curl -f -s http://127.0.10.11:8080 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is healthy at 127.0.10.11:8080${NC}"
else
    echo -e "${YELLOW}⚠️ Frontend may still be starting up at 127.0.10.11:8080${NC}"
fi

if curl -f -s http://127.0.10.11:8081/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API Gateway is healthy at 127.0.10.11:8081${NC}"
else
    echo -e "${YELLOW}⚠️ API Gateway may still be starting up at 127.0.10.11:8081${NC}"
fi

# Show final status
echo ""
echo -e "${GREEN}🎉 Wordle Application Stack Started!${NC}"
echo "=============================================="

echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE ps

echo ""
echo -e "${BLUE}📋 Useful Commands:${NC}"
echo "  $COMPOSE_CMD -f $COMPOSE_FILE logs -f [service]     # View logs"
echo "  $COMPOSE_CMD -f $COMPOSE_FILE logs -f              # View all logs"
echo "  $COMPOSE_CMD -f $COMPOSE_FILE stop                 # Stop all services"
echo "  $COMPOSE_CMD -f $COMPOSE_FILE down                 # Stop and remove"
echo "  $COMPOSE_CMD -f $COMPOSE_FILE restart [service]    # Restart service"

echo ""
echo -e "${BLUE}🧪 Quick Tests:${NC}"
echo "curl http://127.0.10.11:8080         # Frontend"
echo "curl http://127.0.10.11:8081/health  # API Gateway health"
echo "curl https://devstud.imn.htwk-leipzig.de/dev11"
echo "curl https://devstud.imn.htwk-leipzig.de/dev11/api2/health"

echo ""
echo -e "${BLUE}📝 Environment Configuration:${NC}"
echo "  Environment: $NODE_ENV"
echo "  Database: ${POSTGRES_DB}"
echo "  Frontend Port: ${FRONTEND_PORT}"
echo "  API Gateway Port: ${API_GATEWAY_PORT}"