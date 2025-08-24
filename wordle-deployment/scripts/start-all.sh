set -e

# FIXED: Get the parent directory of scripts/ as working directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"  # Parent directory of scripts/
LOG_FILE="${PROJECT_DIR}/logs/startup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")  echo -e "${GREEN}[INFO]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "DEBUG") echo -e "${BLUE}[DEBUG]${NC} $message" ;;
    esac
    
    # Log to file if directory exists
    if [[ -d "$(dirname "$LOG_FILE")" ]]; then
        echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    fi
}

# Create logs directory
mkdir -p "$(dirname "$LOG_FILE")"

log "INFO" "========================================="
log "INFO" "    Wordle Application Startup Script"
log "INFO" "========================================="

# Parse command line arguments
CLEAN_BUILD=false
SKIP_HEALTH_CHECK=false
SHOW_HELP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        --skip-health)
            SKIP_HEALTH_CHECK=true
            shift
            ;;
        --help|-h)
            SHOW_HELP=true
            shift
            ;;
        *)
            log "WARN" "Unknown option: $1"
            shift
            ;;
    esac
done

# Show help and exit
if [[ "$SHOW_HELP" == "true" ]]; then
    echo "Wordle Application Startup Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --clean         Clean build (remove old images and volumes)"
    echo "  --skip-health   Skip health checks after startup"
    echo "  --help, -h      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Standard startup"
    echo "  $0 --clean           # Clean build and startup"
    echo "  $0 --skip-health     # Start without health checks"
    echo ""
    echo "Requirements:"
    echo "  - Docker or Podman with compose support"
    echo "  - Linux operating system"
    echo "  - .env file configured"
    echo ""
    exit 0
fi

# Check if running on Linux
if [[ "$OSTYPE" != "linux"* ]]; then
    log "ERROR" "This script must be run on a Linux system"
    log "INFO" "Current OS: $OSTYPE"
    exit 1
fi

# Detect container runtime and compose command
CONTAINER_CMD=""
COMPOSE_CMD=""

if command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
    
    # Check for docker compose (v2) or docker-compose (v1)
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        log "INFO" "Using Docker Compose v2"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        log "INFO" "Using Docker Compose v1"
    else
        log "ERROR" "Docker Compose not found"
        log "INFO" "Please install Docker Compose or enable WSL2 integration in Docker Desktop"
        exit 1
    fi
elif command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
    if command -v podman-compose &> /dev/null; then
        COMPOSE_CMD="podman-compose"
        log "INFO" "Using Podman Compose"
    else
        log "ERROR" "Podman Compose not found"
        exit 1
    fi
else
    log "ERROR" "Neither Docker nor Podman is installed"
    log "INFO" "Please install Docker Desktop and enable WSL2 integration"
    log "INFO" "Or install Podman with podman-compose"
    exit 1
fi

log "INFO" "Container runtime: $CONTAINER_CMD"
log "INFO" "Compose command: $COMPOSE_CMD"

# FIXED: Change to project directory (not scripts directory)
cd "$PROJECT_DIR"
log "INFO" "Working directory: $PROJECT_DIR"

# Check if .env file exists
if [[ ! -f ".env" ]]; then
    log "ERROR" ".env file not found in $PROJECT_DIR"
    if [[ -f ".env.example" ]]; then
        log "INFO" "Creating .env from .env.example..."
        cp .env.example .env
        log "WARN" "Please edit .env file with your specific configuration"
        log "WARN" "Pay special attention to passwords and secrets!"
    else
        log "ERROR" ".env.example also not found in $PROJECT_DIR"
        log "INFO" "Please create .env file with required variables"
        log "INFO" "Expected location: $PROJECT_DIR/.env"
        exit 1
    fi
fi

log "INFO" "Environment file found: $PROJECT_DIR/.env"

# Load and validate environment variables
source .env

# Validate critical environment variables
required_vars=("POSTGRES_USER" "POSTGRES_PASSWORD" "POSTGRES_DB" "JWT_SECRET")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        missing_vars+=("$var")
    fi
done

if [[ ${#missing_vars[@]} -gt 0 ]]; then
    log "ERROR" "Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        log "ERROR" "  - $var"
    done
    log "INFO" "Please edit .env file and set these variables"
    exit 1
fi

log "INFO" "Environment variables validated"

# Validate docker-compose configuration
log "INFO" "Validating Docker Compose configuration..."
if ! $COMPOSE_CMD config --quiet; then
    log "ERROR" "Docker Compose configuration is invalid"
    log "INFO" "Run '$COMPOSE_CMD config' to see the errors"
    exit 1
fi
log "INFO" "Docker Compose configuration is valid"

# Stop existing containers if any
log "INFO" "Stopping any existing containers..."
$COMPOSE_CMD down --remove-orphans || true

# Clean build if requested
if [[ "$CLEAN_BUILD" == "true" ]]; then
    log "INFO" "Performing clean build..."
    $COMPOSE_CMD down -v || true
    $CONTAINER_CMD system prune -f || true
    log "INFO" "Clean build preparation completed"
fi

# Check if required directories exist
required_dirs=("sql" "config" "logs" "test-content/frontend" "test-content/api")
for dir in "${required_dirs[@]}"; do
    if [[ ! -d "$dir" ]]; then
        log "WARN" "Creating missing directory: $dir"
        mkdir -p "$dir"
    fi
done

# Create test content if it doesn't exist
if [[ ! -f "test-content/frontend/index.html" ]]; then
    log "INFO" "Creating test frontend content..."
    cat > test-content/frontend/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Wordle Frontend Test</title>
    <style>
        body { font-family: Arial; text-align: center; padding: 50px; background-color: #f0f0f0; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status { color: #4CAF50; font-weight: bold; font-size: 18px; }
        .link { display: inline-block; margin: 10px; padding: 10px 20px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px; }
        .link:hover { background: #1976D2; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎮 Wordle Frontend</h1>
        <p class="status">✅ Frontend service is running!</p>
        <p>This is a test page. The React app will replace this.</p>
        <p>
            <a href="http://127.0.10.11:8082" class="link">Test API Gateway</a>
            <a href="http://127.0.10.11:8082/health" class="link">API Health Check</a>
        </p>
        <p><small>Running on port 8080</small></p>
    </div>
</body>
</html>
EOF
fi

if [[ ! -f "test-content/api/index.html" ]]; then
    log "INFO" "Creating test API content..."
    cat > test-content/api/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Wordle API Test</title>
    <style>
        body { font-family: Arial; text-align: center; padding: 50px; background-color: #f0f0f0; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status { color: #2196F3; font-weight: bold; font-size: 18px; }
        .link { display: inline-block; margin: 10px; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
        .link:hover { background: #45a049; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚪 Wordle API Gateway</h1>
        <p class="status">✅ API Gateway service is running!</p>
        <p>This is a test page. The Node.js API will replace this.</p>
        <p>
            <a href="http://127.0.10.11:8080" class="link">Back to Frontend</a>
            <a href="/health" class="link">Health Check</a>
        </p>
        <p><small>Running on port 8082</small></p>
    </div>
</body>
</html>
EOF
    
    # Create health endpoint
    cat > test-content/api/health << 'EOF'
{"status":"healthy","timestamp":"2025-01-01T00:00:00Z","service":"api-gateway","message":"Test API Gateway is running"}
EOF
fi

# Create basic SQL script if it doesn't exist
if [[ ! -f "sql/01-init.sql" ]]; then
    log "INFO" "Creating basic database initialization script..."
    cat > sql/01-init.sql << 'EOF'
-- Basic database initialization for testing
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    status VARCHAR(50) DEFAULT 'healthy',
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO health_check (status, message) VALUES ('initialized', 'Database setup completed for Wordle application');

-- Create a simple test table for users (will be replaced later)
CREATE TABLE IF NOT EXISTS test_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO test_users (username, email) VALUES ('testuser', 'test@example.com');
EOF
fi

# Build and start services
log "INFO" "Building and starting services..."
log "INFO" "This may take several minutes on first run..."

if ! $COMPOSE_CMD up --build -d; then
    log "ERROR" "Failed to start services"
    log "INFO" "Check logs with: $COMPOSE_CMD logs"
    exit 1
fi

log "INFO" "Services started successfully"

# Wait for services to initialize
log "INFO" "Waiting for services to initialize..."
sleep 15

# Health checks (if not skipped)
if [[ "$SKIP_HEALTH_CHECK" != "true" ]]; then
    log "INFO" "Performing basic health checks..."
    
    # Check if containers are running
    running_containers=$($COMPOSE_CMD ps --services --filter status=running | wc -l)
    total_containers=$($COMPOSE_CMD ps --services | wc -l)
    
    if [[ $running_containers -eq $total_containers ]]; then
        log "INFO" "✅ All $total_containers containers are running"
    else
        log "WARN" "❌ Only $running_containers/$total_containers containers are running"
        $COMPOSE_CMD ps
    fi
    
    # Test external endpoints
    frontend_url="http://${FRONTEND_HOST:-127.0.10.11}:${FRONTEND_PORT:-8080}"
    api_url="http://${API_GATEWAY_HOST:-127.0.10.11}:${API_GATEWAY_PORT:-8082}"
    
    # Test frontend (with timeout)
    log "INFO" "Testing frontend endpoint..."
    if timeout 10 curl -f -s "$frontend_url" > /dev/null 2>&1; then
        log "INFO" "✅ Frontend accessible at $frontend_url"
    else
        log "WARN" "❌ Frontend not accessible at $frontend_url"
        log "INFO" "This may be normal if services are still starting up"
    fi
    
    # Test API Gateway (with timeout)
    log "INFO" "Testing API Gateway endpoint..."
    if timeout 10 curl -f -s "$api_url" > /dev/null 2>&1; then
        log "INFO" "✅ API Gateway accessible at $api_url"
    else
        log "WARN" "❌ API Gateway not accessible at $api_url"
        log "INFO" "This may be normal if services are still starting up"
    fi
    
    # Test health endpoint
    log "INFO" "Testing health endpoint..."
    if timeout 10 curl -f -s "$api_url/health" > /dev/null 2>&1; then
        log "INFO" "✅ Health endpoint working at $api_url/health"
    else
        log "WARN" "❌ Health endpoint not working at $api_url/health"
    fi
    
    # Test database connection
    log "INFO" "Testing database connection..."
    if $COMPOSE_CMD exec -T postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" > /dev/null 2>&1; then
        log "INFO" "✅ Database is ready"
    else
        log "WARN" "❌ Database not ready yet"
    fi
    
    # Test Redis connection
    log "INFO" "Testing Redis connection..."
    if $COMPOSE_CMD exec -T redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" ping > /dev/null 2>&1; then
        log "INFO" "✅ Redis is ready"
    else
        log "WARN" "❌ Redis not ready yet"
    fi
else
    log "INFO" "Health checks skipped"
fi

# Display service status
log "INFO" ""
log "INFO" "Current service status:"
$COMPOSE_CMD ps

# Display URLs and commands
log "INFO" ""
log "INFO" "========================================="
log "INFO" "🎉 Startup Process Completed!"
log "INFO" "========================================="
log "INFO" ""

if [[ -n "${FRONTEND_HOST:-}" && -n "${FRONTEND_PORT:-}" ]]; then
    log "INFO" "🌐 Frontend URL: http://${FRONTEND_HOST}:${FRONTEND_PORT}"
fi

if [[ -n "${API_GATEWAY_HOST:-}" && -n "${API_GATEWAY_PORT:-}" ]]; then
    log "INFO" "🔗 API URL: http://${API_GATEWAY_HOST}:${API_GATEWAY_PORT}"
    log "INFO" "🔗 Health Check: http://${API_GATEWAY_HOST}:${API_GATEWAY_PORT}/health"
fi

log "INFO" ""
log "INFO" "📋 Useful commands:"
log "INFO" "  View all logs:     $COMPOSE_CMD logs"
log "INFO" "  Follow logs:       $COMPOSE_CMD logs -f"
log "INFO" "  Stop services:     $PROJECT_DIR/scripts/stop-all.sh"
log "INFO" "  Restart:           $PROJECT_DIR/scripts/start-all.sh"
log "INFO" "  Health check:      $PROJECT_DIR/scripts/health-check.sh"
log "INFO" ""
log "INFO" "📁 Logs saved to: $LOG_FILE"




# start-all.sh
#!/bin/bash

# ============================================================================
# WORDLE GAME DEPLOYMENT SCRIPT
# ============================================================================

set -e  # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting Wordle Game Deployment..."
echo "📅 $(date)"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install docker-compose."
    exit 1
fi

# Set environment variables if not already set
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(openssl rand -base64 32)}
export REDIS_PASSWORD=${REDIS_PASSWORD:-$(openssl rand -base64 32)}
export JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 64)}

echo "🔐 Environment variables configured"

# Create necessary directories
mkdir -p logs
mkdir -p database/backups

# Build and start services
echo "🏗️ Building and starting services..."
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🏥 Checking service health..."

services=("frontend" "api-gateway" "game-service" "redis" "postgres-users" "postgres-profiles")
for service in "${services[@]}"; do
    echo -n "Checking $service... "
    if docker-compose ps | grep -q "$service.*healthy\|Up"; then
        echo "✅"
    else
        echo "❌"
        echo "Service $service is not healthy. Check logs:"
        docker-compose logs "$service" --tail=10
    fi
done

# Display service URLs
echo ""
echo "🌐 Service URLs:"
echo "   • Frontend: http://127.0.10.11:8080 (→ https://devstud.imn.htwk-leipzig.de/dev11)"
echo "   • API Gateway: http://127.0.10.11:8082 (→ https://devstud.imn.htwk-leipzig.de/dev11/api)"
echo "   • Health Check: http://127.0.10.11:8082/health"
echo "   • API Docs: http://127.0.10.11:8082/docs"

echo ""
echo "🔧 Management Commands:"
echo "   • Stop all: docker-compose down"
echo "   • View logs: docker-compose logs -f [service_name]"
echo "   • Rebuild: docker-compose build --no-cache [service_name]"

echo ""
echo "✅ Deployment completed successfully!"
echo "🎮 Your Wordle game is now running!"