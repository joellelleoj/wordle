#!/bin/bash
set -e

echo "Starting Wordle Game Service Locally..."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' 

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

# Create local environment variables (override production settings)
echo -e "${YELLOW} Setting up local environment...${NC}"
export NODE_ENV=development
export PORT=3002
export HOST=localhost
export JWT_SECRET=your-super-secret-jwt-key-for-development-only
export CORS_ORIGIN=http://localhost:3000,http://localhost:5173,http://localhost:8080
export WORD_CACHE_PATH=./cache
export PROFILE_SERVICE_URL=http://localhost:3004
export API_GATEWAY_URL=http://localhost:8002
export LOG_LEVEL=info
export ENABLE_REQUEST_LOGGING=true

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW} Installing dependencies...${NC}"
    npm install
fi

# Create cache directory
mkdir -p cache

# Start the service
npm run dev