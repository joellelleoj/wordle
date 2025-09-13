#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Server configuration
SERVER_HOST="devstud.imn.htwk-leipzig.de"
SERVER_IP="141.57.8.199"
SERVER_USER="dev11"
CONTAINER_HOST="127.0.10.11"
DEPLOY_DIR="/home/dev11/wordle-deployment"

echo -e "${CYAN}🚀 Wordle Production Deployment Script${NC}"
echo "==========================================="
echo -e "${BLUE}Target Server:${NC} $SERVER_HOST ($SERVER_IP)"
echo -e "${BLUE}SSH User:${NC} $SERVER_USER"
echo -e "${BLUE}Deploy Directory:${NC} $DEPLOY_DIR"
echo ""

# Function to execute commands on remote server via SSH
execute_remote() {
    local cmd="$1"
    echo -e "${YELLOW}[REMOTE]${NC} $cmd"
    ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "$cmd"
}

# Function to copy files to remote server
copy_to_server() {
    local local_path="$1"
    local remote_path="$2"
    echo -e "${YELLOW}[COPY]${NC} $local_path -> $remote_path"
    scp -o StrictHostKeyChecking=no -r "$local_path" "$SERVER_USER@$SERVER_IP:$remote_path"
}

# Verify we're in the right directory
if [ ! -f "docker-compose.prod.yml" ] || [ ! -f ".env.prod" ]; then
    echo -e "${RED}❌ Missing required files. Please ensure you're in the deployment directory with:${NC}"
    echo "   - docker-compose.prod.yml"
    echo "   - .env.prod"
    echo "   - All service directories (wordle-frontend, wordle-*-service, database)"
    exit 1
fi

echo -e "${GREEN}✅ Local files verified${NC}"

# Test SSH connection
echo -e "${BLUE}🔐 Testing SSH connection...${NC}"
if ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SERVER_USER@$SERVER_IP" "echo 'SSH connection successful'"; then
    echo -e "${RED}❌ Cannot connect to server. Please check:${NC}"
    echo "   - Server is accessible: $SERVER_IP"
    echo "   - SSH credentials are correct"
    echo "   - Your SSH key is set up or you can provide password"
    exit 1
fi
echo -e "${GREEN}✅ SSH connection established${NC}"

# Create deployment directory on server
echo -e "${BLUE}📁 Preparing deployment directory...${NC}"
execute_remote "mkdir -p $DEPLOY_DIR"
execute_remote "cd $DEPLOY_DIR && rm -rf wordle-*/ database/ docker-compose.prod.yml .env 2>/dev/null || true"

# Copy all project files to server
echo -e "${BLUE}📦 Copying project files to server...${NC}"

# Copy service directories
for dir in wordle-frontend wordle-*-service database; do
    if [ -d "$dir" ]; then
        echo -e "${YELLOW}Copying $dir...${NC}"
        copy_to_server "$dir/" "$DEPLOY_DIR/$dir/"
    fi
done

# Copy deployment files
copy_to_server "docker-compose.prod.yml" "$DEPLOY_DIR/"
copy_to_server ".env.prod" "$DEPLOY_DIR/.env"

echo -e "${GREEN}✅ All files copied to server${NC}"

# Stop any running containers
echo -e "${BLUE}🛑 Stopping any running containers...${NC}"
execute_remote "cd $DEPLOY_DIR && docker-compose down --remove-orphans 2>/dev/null || true"
execute_remote "cd $DEPLOY_DIR && docker container prune -f 2>/dev/null || true"
execute_remote "cd $DEPLOY_DIR && docker image prune -f 2>/dev/null || true"

# Check Docker availability
echo -e "${BLUE}🐳 Checking Docker availability...${NC}"
execute_remote "docker --version"
execute_remote "docker-compose --version"

# Load environment variables on server and start deployment
echo -e "${BLUE}🚀 Starting production deployment...${NC}"

# Create deployment script on server
execute_remote "cat > $DEPLOY_DIR/server-deploy.sh << 'EOF'
#!/bin/bash
set -e

cd $DEPLOY_DIR
export \$(cat .env | grep -v '^#' | grep -v '^\$' | xargs)

echo '🔨 Building and starting services in production mode...'

# Step 1: Start PostgreSQL
echo '📅 Step 1: Starting PostgreSQL database...'
docker-compose up -d postgres
sleep 15

# Step 2: Run database setup
echo '📅 Step 2: Running database setup...'
docker-compose up --build database-setup
sleep 10

# Step 3: Start internal services
echo '📅 Step 3: Starting internal services...'
docker-compose up --build -d user-service game-service profile-service
sleep 20

# Step 4: Start API Gateway (exposed on 8081)
echo '📅 Step 4: Starting API gateway...'
docker-compose up --build -d api-gateway
sleep 15

# Step 5: Start Frontend (exposed on 8080)
echo '📅 Step 5: Starting frontend...'
docker-compose up --build -d frontend
sleep 10

echo '⏳ Waiting for all services to fully initialize...'
sleep 30

echo '🏥 Checking service health...'
docker-compose ps

echo '✅ Production deployment completed!'
echo ''
echo '🌐 Application URLs:'
echo '   Frontend: https://$SERVER_HOST/dev11'
echo '   API Gateway: https://$SERVER_HOST/dev11/api2'
echo ''
echo 'Container mapping:'
echo '   Frontend: $CONTAINER_HOST:8080 -> /dev11'
echo '   API Gateway: $CONTAINER_HOST:8081 -> /dev11/api2'
EOF"

# Make the script executable and run it
execute_remote "chmod +x $DEPLOY_DIR/server-deploy.sh"
echo -e "${BLUE}🎬 Executing deployment on server...${NC}"
execute_remote "$DEPLOY_DIR/server-deploy.sh"

# Final health checks
echo -e "${BLUE}🏥 Performing final health checks...${NC}"

# Check if containers are running
echo -e "${YELLOW}Container Status:${NC}"
execute_remote "cd $DEPLOY_DIR && docker-compose ps"

# Test endpoints
echo -e "${YELLOW}Testing endpoints...${NC}"

# Test frontend
if execute_remote "curl -f -s http://$CONTAINER_HOST:8080 > /dev/null 2>&1"; then
    echo -e "${GREEN}✅ Frontend is responding${NC}"
else
    echo -e "${YELLOW}⚠️ Frontend may still be starting up${NC}"
fi

# Test API Gateway
if execute_remote "curl -f -s http://$CONTAINER_HOST:8081/health > /dev/null 2>&1"; then
    echo -e "${GREEN}✅ API Gateway is responding${NC}"
else
    echo -e "${YELLOW}⚠️ API Gateway may still be starting up${NC}"
fi

# Check reverse proxy logs for any errors
echo -e "${YELLOW}Checking reverse proxy logs for errors...${NC}"
execute_remote "tail -n 20 /var/log/nginx/error.log 2>/dev/null || echo 'No recent nginx errors'"

# Final status
echo ""
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo "==========================================="
echo ""
echo -e "${CYAN}🌐 Production URLs:${NC}"
echo -e "${GREEN}   📱 Frontend:${NC} https://$SERVER_HOST/dev11"
echo -e "${GREEN}   🔗 API Gateway:${NC} https://$SERVER_HOST/dev11/api2"
echo ""
echo -e "${CYAN}📊 Server Information:${NC}"
echo -e "${BLUE}   🖥️ Server Host:${NC} $SERVER_HOST"
echo -e "${BLUE}   🌍 Server IP:${NC} $SERVER_IP"
echo -e "${BLUE}   👤 SSH User:${NC} $SERVER_USER"
echo -e "${BLUE}   📁 Deploy Path:${NC} $DEPLOY_DIR"
echo ""
echo -e "${CYAN}🐳 Container Mapping:${NC}"
echo -e "${BLUE}   Frontend:${NC} $CONTAINER_HOST:8080 → /dev11"
echo -e "${BLUE}   API Gateway:${NC} $CONTAINER_HOST:8081 → /dev11/api2"
echo ""
echo -e "${CYAN}📋 Useful Management Commands:${NC}"
echo -e "${YELLOW}   # Connect to server${NC}"
echo "   ssh $SERVER_USER@$SERVER_IP"
echo ""
echo -e "${YELLOW}   # Check deployment status${NC}"
echo "   ssh $SERVER_USER@$SERVER_IP 'cd $DEPLOY_DIR && docker-compose ps'"
echo ""
echo -e "${YELLOW}   # View logs${NC}"
echo "   ssh $SERVER_USER@$SERVER_IP 'cd $DEPLOY_DIR && docker-compose logs -f'"
echo ""
echo -e "${YELLOW}   # Restart services${NC}"
echo "   ssh $SERVER_USER@$SERVER_IP 'cd $DEPLOY_DIR && docker-compose restart'"
echo ""
echo -e "${YELLOW}   # Stop deployment${NC}"
echo "   ssh $SERVER_USER@$SERVER_IP 'cd $DEPLOY_DIR && docker-compose down'"
echo ""
echo -e "${GREEN}🧪 Quick Test:${NC}"
echo "   curl https://$SERVER_HOST/dev11"
echo "   curl https://$SERVER_HOST/dev11/api2/health"
echo ""
echo -e "${BLUE}Happy Wordling! 🎮${NC}"