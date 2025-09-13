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

# Detect environment mode
ENVIRONMENT="${ENVIRONMENT:-development}"
COMPOSE_FILE="docker-compose.yml"

if [ "$ENVIRONMENT" = "production" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    echo -e "${BLUE}🏭 Production mode detected${NC}"
else
    echo -e "${BLUE}🔧 Development mode detected${NC}"
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

# Check for .env file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating template...${NC}"
    cat > .env << 'EOF'
# ==============================================================================
# WORDLE APPLICATION - ENVIRONMENT VARIABLES
# ==============================================================================
NODE_ENV=development
DOCKER_ENV=true

# Database Configuration
POSTGRES_DB=wordle_users
POSTGRES_USER=wordle_user
POSTGRES_PASSWORD=secure_password_change_this
DB_HOST=postgres
DB_PORT=5432
DATABASE_URL=postgresql://wordle_user:secure_password_change_this@postgres:5432/wordle_users

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-super-secret-jwt-refresh-key-change-this

# GitLab OAuth Configuration  
GITLAB_CLIENT_ID=your_gitlab_client_id
GITLAB_CLIENT_SECRET=your_gitlab_client_secret
GITLAB_BASE_URL=https://git.imn.htwk-leipzig.de
GITLAB_REDIRECT_URI=http://localhost:3003/api/v1/auth/callback

# Service Ports
GAME_SERVICE_PORT=3002
USER_SERVICE_PORT=3003
PROFILE_SERVICE_PORT=3004
API_GATEWAY_PORT=8002
FRONTEND_PORT=3000
POSTGRES_EXTERNAL_PORT=5433

# Service URLs
GAME_SERVICE_URL=http://localhost:3002
USER_SERVICE_URL=http://localhost:3003
PROFILE_SERVICE_URL=http://localhost:3004
API_GATEWAY_URL=http://api-gateway:8002

# CORS Configuration
CLIENT_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000,http://localhost:8002
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.10.11:8080,https://devstud.imn.htwk-leipzig.de

# Frontend Environment Variables
VITE_API_BASE_URL=http://localhost:3000
VITE_ENVIRONMENT=development
VITE_API_URL=/api
VITE_GITLAB_CLIENT_ID=your_gitlab_client_id
VITE_GITLAB_BASE_URL=https://git.imn.htwk-leipzig.de
VITE_REDIRECT_URI=http://localhost:3003/api/v1/auth/callback
EOF
    echo -e "${YELLOW}⚠️  Please edit .env file with your actual values before continuing${NC}"
    exit 1
fi

# Load environment variables
echo -e "${BLUE}📄 Loading environment variables from .env${NC}"
export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)

# Verify expected directories exist
if [ "$ENVIRONMENT" = "development" ]; then
    expected_dirs=("database" "wordle-user-service" "wordle-game-service" "wordle-profile-service" "wordle-api-gateway" "wordle-frontend")
    base_path="../"
else
    expected_dirs=("database" "wordle-user-service" "wordle-game-service" "wordle-profile-service" "wordle-api-gateway" "wordle-frontend")
    base_path="./"
fi

missing_dirs=()

for dir in "${expected_dirs[@]}"; do
    if [ ! -d "${base_path}$dir" ]; then
        missing_dirs+=("$dir")
    fi
done

if [ ${#missing_dirs[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required directories: ${missing_dirs[*]}${NC}"
    echo -e "${YELLOW}Expected directory structure:${NC}"
    if [ "$ENVIRONMENT" = "development" ]; then
        echo "  project-root/"
        echo "  ├── database/"
        echo "  ├── wordle-user-service/"
        echo "  ├── wordle-game-service/"
        echo "  ├── wordle-profile-service/"
        echo "  ├── wordle-api-gateway/"
        echo "  ├── wordle-frontend/"
        echo "  └── wordle-deployment/"
        echo "      ├── docker-compose.yml"
        echo "      ├── .env"
        echo "      └── start-all.sh (this script)"
    else
        echo "  deployment-root/"
        echo "  ├── database/"
        echo "  ├── wordle-user-service/"
        echo "  ├── wordle-game-service/"
        echo "  ├── wordle-profile-service/"
        echo "  ├── wordle-api-gateway/"
        echo "  ├── wordle-frontend/"
        echo "  ├── docker-compose.prod.yml"
        echo "  ├── .env"
        echo "      └── start-all.sh (this script)"
    fi
    exit 1
fi

echo -e "${GREEN}✅ All required directories found${NC}"

# Stop any running containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE down --remove-orphans 2>/dev/null || true

# Clean up any orphaned containers
$CONTAINER_CMD container prune -f 2>/dev/null || true

echo -e "${BLUE}🔨 Building and starting services in correct order...${NC}"

# Start services in dependency order
echo -e "${YELLOW}📅 Step 1: Starting PostgreSQL database...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE up -d postgres
sleep 10

echo -e "${YELLOW}📅 Step 2: Running database setup...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE up --build database-setup
sleep 5

echo -e "${YELLOW}📅 Step 3: Starting core services...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE up --build -d user-service game-service profile-service
sleep 15

echo -e "${YELLOW}📅 Step 4: Starting API gateway...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE up --build -d api-gateway
sleep 10

echo -e "${YELLOW}📅 Step 5: Starting frontend...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE up --build -d frontend
sleep 10

# Wait for all services to be ready
echo -e "${YELLOW}⏳ Waiting for services to fully initialize...${NC}"
sleep 20

# Check service health
echo -e "${BLUE}🏥 Checking service health...${NC}"

# Define service health checks based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    services=(
        "127.0.10.11:8080:Frontend"
        "127.0.10.11:8081:User-Service"
        "127.0.10.11:8082:API-Gateway"
    )
    echo -e "${BLUE}🌐 Production URLs:${NC}"
    echo -e "${BLUE}📱 Frontend:${NC} https://devstud.imn.htwk-leipzig.de/dev11"
    echo -e "${BLUE}🔗 API Gateway:${NC} https://devstud.imn.htwk-leipzig.de/dev11/api"
    echo -e "${BLUE}👤 User Service:${NC} https://devstud.imn.htwk-leipzig.de/dev11/api2"
else
    services=(
        "localhost:${FRONTEND_PORT}:Frontend"
        "localhost:${USER_SERVICE_PORT}:User-Service"
        "localhost:${GAME_SERVICE_PORT}:Game-Service"
        "localhost:${PROFILE_SERVICE_PORT}:Profile-Service"
        "localhost:${API_GATEWAY_PORT}:API-Gateway"
        "localhost:${POSTGRES_EXTERNAL_PORT}:Database"
    )
    echo -e "${BLUE}🌐 Development URLs:${NC}"
    echo -e "${BLUE}📱 Frontend:${NC} http://localhost:${FRONTEND_PORT}"
    echo -e "${BLUE}🔗 API Gateway:${NC} http://localhost:${API_GATEWAY_PORT}"
    echo -e "${BLUE}👤 User Service:${NC} http://localhost:${USER_SERVICE_PORT}"
    echo -e "${BLUE}🎮 Game Service:${NC} http://localhost:${GAME_SERVICE_PORT}"
    echo -e "${BLUE}📊 Profile Service:${NC} http://localhost:${PROFILE_SERVICE_PORT}"
    echo -e "${BLUE}🗄️ Database:${NC} postgres://localhost:${POSTGRES_EXTERNAL_PORT}"
fi

all_healthy=true

for service_info in "${services[@]}"; do
    IFS=':' read -r host port name <<< "$service_info"
    endpoint="http://$host:$port"
    
    # Skip database health check (it doesn't have HTTP endpoint)
    if [[ "$name" == "Database" ]]; then
        echo -e "${GREEN}✅ $name container running${NC}"
        continue
    fi
    
    if [[ "$name" == "Frontend" ]]; then
        test_endpoint="$endpoint"
    else
        test_endpoint="$endpoint/health"
    fi
    
    if curl -f -s "$test_endpoint" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name is healthy at $endpoint${NC}"
    else
        echo -e "${YELLOW}⚠️  $name may still be starting up at $endpoint${NC}"
        all_healthy=false
    fi
done

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
if $all_healthy; then
    echo -e "${GREEN}✅ All services are running successfully!${NC}"
else
    echo -e "${YELLOW}⚠️ Some services may still be starting up. Check logs for details.${NC}"
fi

echo ""
echo -e "${BLUE}🧪 Quick Tests:${NC}"
if [ "$ENVIRONMENT" = "production" ]; then
    echo "curl http://127.0.10.11:8082/health  # API Gateway health"
    echo "curl http://127.0.10.11:8081/health  # User Service health"
    echo "curl http://127.0.10.11:8080         # Frontend"
else
    echo "curl http://localhost:${API_GATEWAY_PORT}/health  # API Gateway health"
    echo "curl http://localhost:${USER_SERVICE_PORT}/health  # User Service health"
    echo "curl http://localhost:${FRONTEND_PORT}             # Frontend"
fi

echo ""
echo -e "${BLUE}📝 Environment Configuration:${NC}"
echo "  Environment: $NODE_ENV"
echo "  Database: ${POSTGRES_DB}"
echo "  Frontend Port: ${FRONTEND_PORT}"
echo "  API Gateway Port: ${API_GATEWAY_PORT}"