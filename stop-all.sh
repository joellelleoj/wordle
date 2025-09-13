#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping Wordle Application Stack...${NC}"

COMPOSE_CMD="docker-compose"
if ! command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker compose"
fi

# Check if we're in the deployment directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: docker-compose.yml not found. Please run from the wordle-deployment directory.${NC}"
    exit 1
fi

# Stop the complete stack
$COMPOSE_CMD down --remove-orphans

# Stop any individual containers that might still be running
docker stop postgres-wordle 2>/dev/null || true
docker rm postgres-wordle 2>/dev/null || true

# Clean up orphaned containers
docker container prune -f

echo -e "${GREEN}All Wordle services stopped cleanly${NC}"

# Show remaining containers (if any)
remaining_containers=$(docker ps --filter "name=wordle" --format "table {{.Names}}\t{{.Status}}")
if [ -n "$remaining_containers" ]; then
    echo -e "${YELLOW}Remaining Wordle containers:${NC}"
    echo "$remaining_containers"
else
    echo -e "${GREEN}No Wordle containers running${NC}"
fi