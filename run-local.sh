#!/bin/bash
set -e

echo "Starting Wordle User Service Locally..."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED} Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED} npm is not installed. Please install npm first.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED} Node.js version 18+ required. Current version: $(node --version)${NC}"
    exit 1
fi

echo -e "${BLUE} Node.js version: $(node --version)${NC}"
echo -e "${BLUE} npm version: $(npm --version)${NC}"

# Create local environment variables (override production settings)
echo -e "${YELLOW}🔧 Setting up local environment...${NC}"
export NODE_ENV=development
export PORT=3003
export HOST=localhost
export JWT_SECRET=your-super-secret-jwt-key-for-development-only
export JWT_REFRESH_SECRET=your-super-secret-jwt-refresh-key-for-development-only
export JWT_EXPIRES_IN=1h
export JWT_REFRESH_EXPIRES_IN=7d
export DATABASE_URL=postgresql://wordle_user:secure_password@localhost:5433/wordle_users
export DOCKER_ENV=false
export CLIENT_URL=http://localhost:3000
export CORS_ORIGIN=http://localhost:3000,http://localhost:5173,http://localhost:8080,http://localhost:8002
export GITLAB_CLIENT_ID=2d04d82c5877b01f9d1224e1502b935a2d0adce06c373b6a49521ac1377b078d
export GITLAB_CLIENT_SECRET=gloas-0fe89982840bb557b2032d187c835f544ceb53deeb57d6dc6f938c4108b3bc32
export GITLAB_REDIRECT_URI=http://localhost:3003/api/v1/auth/callback
export GITLAB_BASE_URL=https://git.imn.htwk-leipzig.des
export LOG_LEVEL=info
export ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8002,http://127.0.10.11:8080
export ENABLE_REQUEST_LOGGING=true
export API_PREFIX=/api/v1
export RATE_LIMIT_WINDOW_MS=900000
export RATE_LIMIT_MAX_REQUESTS=100


# Check if PostgreSQL is available (optional for local dev)
if command -v psql &> /dev/null; then
    echo -e "${BLUE} PostgreSQL client available${NC}"
else
    echo -e "${YELLOW}  PostgreSQL client not found. Database connection may require Docker.${NC}"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}Dependencies installed${NC}"
else
    echo -e "${GREEN}Dependencies already installed${NC}"
fi

# Check if we need to build TypeScript
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    echo -e "${YELLOW} Building TypeScript...${NC}"
    npm run build
    echo -e "${GREEN}Build completed${NC}"
else
    echo -e "${GREEN}Build is up to date${NC}"
fi

# Start the service in development mode
npm run dev