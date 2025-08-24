# =============================================================================
# logs.sh - Log Management Script
# =============================================================================
#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

show_help() {
    echo "Wordle Application Log Management"
    echo ""
    echo "Usage: $0 [COMMAND] [SERVICE] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  logs [service]     Show logs for specific service or all services"
    echo "  follow [service]   Follow logs in real-time"
    echo "  errors             Show only error logs from all services"
    echo "  tail [service]     Show last 100 lines of logs"
    echo "  export [service]   Export logs to file"
    echo "  clean              Clean old log files"
    echo "  services           List all available services"
    echo ""
    echo "Services:"
    echo "  frontend          React frontend application"
    echo "  api-gateway       API Gateway service"
    echo "  user-service      User authentication service"
    echo "  game-service      Game logic service"
    echo "  profile-service   Profile and statistics service"
    echo "  postgres-main     Main PostgreSQL database"
    echo "  postgres-dict     Dictionary PostgreSQL database"
    echo "  redis             Redis cache"
    echo ""
    echo "Examples:"
    echo "  $0 logs api-gateway              # Show API Gateway logs"
    echo "  $0 follow user-service           # Follow user service logs"
    echo "  $0 errors                        # Show all error logs"
    echo "  $0 export api-gateway            # Export API Gateway logs"
}

list_services() {
    echo -e "${BLUE}Available Services:${NC}"
    $COMPOSE_CMD ps --services | while read service; do
        status=$($COMPOSE_CMD ps -q $service | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null || echo "stopped")
        if [ "$status" = "running" ]; then
            echo -e "  ${GREEN}✅ $service${NC}"
        else
            echo -e "  ${YELLOW}⏸️ $service (stopped)${NC}"
        fi
    done
}

show_logs() {
    local service=$1
    local options=$2
    
    if [ -z "$service" ]; then
        echo -e "${BLUE}Showing logs for all services:${NC}"
        $COMPOSE_CMD logs $options
    else
        echo -e "${BLUE}Showing logs for $service:${NC}"
        $COMPOSE_CMD logs $options $service
    fi
}

follow_logs() {
    local service=$1
    
    if [ -z "$service" ]; then
        echo -e "${BLUE}Following logs for all services (Ctrl+C to stop):${NC}"
        $COMPOSE_CMD logs -f
    else
        echo -e "${BLUE}Following logs for $service (Ctrl+C to stop):${NC}"
        $COMPOSE_CMD logs -f $service
    fi
}

show_errors() {
    echo -e "${BLUE}Showing error logs from all services:${NC}"
    $COMPOSE_CMD logs | grep -i "error\|exception\|fatal\|panic" --color=always
}

tail_logs() {
    local service=$1
    
    if [ -z "$service" ]; then
        echo -e "${BLUE}Showing last 100 lines for all services:${NC}"
        $COMPOSE_CMD logs --tail=100
    else
        echo -e "${BLUE}Showing last 100 lines for $service:${NC}"
        $COMPOSE_CMD logs --tail=100 $service
    fi
}

export_logs() {
    local service=$1
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local log_dir="./logs/exports"
    
    mkdir -p "$log_dir"
    
    if [ -z "$service" ]; then
        local filename="$log_dir/all-services-$timestamp.log"
        echo -e "${BLUE}Exporting all service logs to $filename...${NC}"
        $COMPOSE_CMD logs > "$filename"
    else
        local filename="$log_dir/$service-$timestamp.log"
        echo -e "${BLUE}Exporting $service logs to $filename...${NC}"
        $COMPOSE_CMD logs $service > "$filename"
    fi
    
    echo -e "${GREEN}✅ Logs exported to $filename${NC}"
}

clean_logs() {
    local log_dir="./logs"
    
    if [ -d "$log_dir" ]; then
        echo -e "${BLUE}Cleaning old log files...${NC}"
        find "$log_dir" -name "*.log" -mtime +7 -delete
        find "$log_dir" -name "*.log.gz" -mtime +30 -delete
        echo -e "${GREEN}✅ Old log files cleaned${NC}"
    else
        echo -e "${YELLOW}No log directory found${NC}"
    fi
}

# Main command processing
case "$1" in
    "logs")
        show_logs "$2" "$3"
        ;;
    "follow")
        follow_logs "$2"
        ;;
    "errors")
        show_errors
        ;;
    "tail")
        tail_logs "$2"
        ;;
    "export")
        export_logs "$2"
        ;;
    "clean")
        clean_logs
        ;;
    "services")
        list_services
        ;;
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "DEBUG") echo -e "${BLUE}[DEBUG]${NC} $message" ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Create logs directory
mkdir -p "$(dirname "$LOG_FILE")"

log "INFO" "========================================="
log "INFO" "    Wordle Application Startup Script"
log "INFO" "========================================="

# Check if running on Linux
if [[ "$OSTYPE" != "linux"* ]]; then
    log "ERROR" "This script must be run on a Linux system"
    exit 1
fi

# Detect container runtime
if command -v podman &> /dev/null && command -v podman-compose &> /dev/null; then
    CONTAINER_CMD="podman"
    COMPOSE_CMD="podman-compose"
elif command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    CONTAINER_CMD="docker"
    COMPOSE_CMD="docker-compose"
else
    log "ERROR" "Neither Docker nor Podman with compose is installed"
    log "INFO" "Please install Docker or Podman with docker-compose/podman-compose"
    exit 1
fi

log "INFO" "Using container runtime: $CONTAINER_CMD"
log "INFO" "Using compose command: $COMPOSE_CMD"

# Change to script directory
cd "$SCRIPT_DIR"
log "INFO" "Working directory: $SCRIPT_DIR"

# Check if .env file exists
if [[ ! -f "$ENV_FILE" ]]; then
    log "ERROR" ".env file not found at $ENV_FILE"
    log "INFO" "Please copy .env.example to .env and configure the variables"
    if [[ -f "${SCRIPT_DIR}/.env.example" ]]; then
        log "INFO" "Creating .env from .env.example..."
        cp "${SCRIPT_DIR}/.env.example" "$ENV_FILE"
        log "WARN" "Please edit .env file with your specific configuration"
        log "WARN" "Pay special attention to passwords and secrets!"
    fi
    exit 1
fi

log "INFO" "Environment file found: $ENV_FILE"

# Load environment variables
source "$ENV_FILE"

# Validate critical environment variables
required_vars=(
    "POSTGRES_USER" "POSTGRES_PASSWORD" "POSTGRES_DB"
    "DICT_POSTGRES_USER" "DICT_POSTGRES_PASSWORD" "DICT_POSTGRES_DB"
    "REDIS_PASSWORD" "JWT_SECRET"
)

for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        log "ERROR" "Required environment variable $var is not set"
        exit 1
    fi
done

log "INFO" "Environment variables validated"

# Parse command line arguments
CLEAN_BUILD=false
PRODUCTION_MODE=false
SKIP_TESTS=false
MIGRATION_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        --production)
            PRODUCTION_MODE=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --migrate-only)
            MIGRATION_ONLY=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --clean         Clean build (remove old images and volumes)"
            echo "  --production    Production mode (includes nginx proxy)"
            echo "  --skip-tests    Skip health checks and tests"
            echo "  --migrate-only  Only run database migrations"
            echo "  --help          Show this help message"
            exit 0
            ;;
        *)
            log "WARN" "Unknown option: $1"
            shift
            ;;
    esac
done

# Stop existing containers
log "INFO" "Stopping existing containers..."
$COMPOSE_CMD down --remove-orphans || true

# Clean build if requested
if [[ "$CLEAN_BUILD" == "true" ]]; then
    log "INFO" "Performing clean build..."
    $COMPOSE_CMD down -v || true
    $CONTAINER_CMD system prune -f || true
    $CONTAINER_CMD volume prune -f || true
    log "INFO" "Clean build completed"
fi

# Set compose profiles
COMPOSE_PROFILES="default"
if [[ "$PRODUCTION_MODE" == "true" ]]; then
    COMPOSE_PROFILES="$COMPOSE_PROFILES,production"
    log "INFO" "Production mode enabled"
fi

# Run migrations only if requested
if [[ "$MIGRATION_ONLY" == "true" ]]; then
    log "INFO" "Running database migrations only..."
    COMPOSE_PROFILES="$COMPOSE_PROFILES,migration" $COMPOSE_CMD up db-migrate
    log "INFO" "Database migrations completed"
    exit 0
fi

# Build and start all services
log "INFO" "Building and starting all services..."
log "INFO" "This may take several minutes on first run..."

export COMPOSE_PROFILES
$COMPOSE_CMD up --build -d

# Wait for services to start
log "INFO" "Waiting for services to start..."
sleep 15

# Check database health
log "INFO" "Checking database connectivity..."
max_attempts=30
attempt=0

while [[ $attempt -lt $max_attempts ]]; do
    if $CONTAINER_CMD exec wordle-postgres-main pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1; then
        log "INFO" "Main database is ready"
        break
    fi
    log "DEBUG" "Waiting for main database... (attempt $((attempt + 1))/$max_attempts)"
    sleep 2
    ((attempt++))
done

if [[ $attempt -eq $max_attempts ]]; then
    log "ERROR" "Main database failed to start"
    log "INFO" "Check logs: $COMPOSE_CMD logs postgres-main"
    exit 1
fi

# Check dictionary database
attempt=0
while [[ $attempt -lt $max_attempts ]]; do
    if $CONTAINER_CMD exec wordle-postgres-dict pg_isready -U "$DICT_POSTGRES_USER" -d "$DICT_POSTGRES_DB" > /dev/null 2>&1; then
        log "INFO" "Dictionary database is ready"
        break
    fi
    log "DEBUG" "Waiting for dictionary database... (attempt $((attempt + 1))/$max_attempts)"
    sleep 2
    ((attempt++))
done

if [[ $attempt -eq $max_attempts ]]; then
    log "ERROR" "Dictionary database failed to start"
    log "INFO" "Check logs: $COMPOSE_CMD logs postgres-dict"
    exit 1
fi

# Run database migrations
log "INFO" "Running database migrations..."
COMPOSE_PROFILES="$COMPOSE_PROFILES,migration" $COMPOSE_CMD up db-migrate
COMPOSE_PROFILES="$COMPOSE_PROFILES" $COMPOSE_CMD rm -f db-migrate

# Health checks
if [[ "$SKIP_TESTS" != "true" ]]; then
    log "INFO" "Performing health checks..."
    
    # Check frontend
    if curl -f -s -o /dev/null "http://${FRONTEND_HOST:-127.0.10.11}:${FRONTEND_PORT:-8080}" 2>/dev/null; then
        log "INFO" "✅ Frontend is accessible"
    else
        log "WARN" "❌ Frontend health check failed"
    fi
    
    # Check API Gateway
    if curl -f -s -o /dev/null "http://${API_GATEWAY_HOST:-127.0.10.11}:${API_GATEWAY_PORT:-8082}/health" 2>/dev/null; then
        log "INFO" "✅ API Gateway is accessible"
    else
        log "WARN" "❌ API Gateway health check failed"
    fi
    
    # Check Redis
    if $CONTAINER_CMD exec wordle-redis redis-cli --no-auth-warning -a "$REDIS_PASSWORD" ping > /dev/null 2>&1; then
        log "INFO" "✅ Redis is accessible"
    else
        log "WARN" "❌ Redis health check failed"
    fi
fi

# Display service status
log "INFO" "Service Status:"
$COMPOSE_CMD ps

# Display access information
log "INFO" ""
log "INFO" "========================================="
log "INFO" "🎉 Wordle Application Started Successfully!"
log "INFO" "========================================="
log "INFO" ""
log "INFO" "🌐 Application URLs:"
log "INFO" "   Frontend: http://devstud.imn.htwk-leipzig.de/dev11"
log "INFO" "   API:      http://devstud.imn.htwk-leipzig.de/dev11/api"
log "INFO" ""
log "INFO" "🔧 Local Development URLs:"
log "INFO" "   Frontend: http://${FRONTEND_HOST:-127.0.10.11}:${FRONTEND_PORT:-8080}"
log "INFO" "   API:      http://${API_GATEWAY_HOST:-127.0.10.11}:${API_GATEWAY_PORT:-8082}"
log "INFO" ""
log "INFO" "📋 Management Commands:"
log "INFO" "   View logs:     $COMPOSE_CMD logs [service-name]"
log "INFO" "   Stop all:      $COMPOSE_CMD down"
log "INFO" "   Stop + clean:  $COMPOSE_CMD down -v"
log "INFO" "   Health check:  ./health-check.sh"
log "INFO" ""
log "INFO" "📁 Log file: $LOG_FILE"
log "INFO" ""

# Save deployment info
cat > "${SCRIPT_DIR}/deployment-info.json" << EOF
{
  "deployment_time": "$(date -Iseconds)",
  "container_runtime": "$CONTAINER_CMD",
  "compose_command": "$COMPOSE_CMD",
  "frontend_url": "http://${FRONTEND_HOST:-127.0.10.11}:${FRONTEND_PORT:-8080}",
  "api_url": "http://${API_GATEWAY_HOST:-127.0.10.11}:${API_GATEWAY_PORT:-8082}",
  "production_mode": $PRODUCTION_MODE,
  "services": {
    "frontend": "wordle-frontend",
    "api_gateway": "wordle-api-gateway",
    "user_service": "wordle-user-service",
    "game_service": "wordle-game-service",
    "profile_service": "wordle-profile-service",
    "postgres_main": "wordle-postgres-main",
    "postgres_dict": "wordle-postgres-dict",
    "redis": "wordle-redis"
  }
}
EOF

log "INFO" "Deployment information saved to deployment-info.json"