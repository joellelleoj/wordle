#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "Stopping Complete Wordle Application Stack"
echo "=========================================="

# Detect environment mode
ENVIRONMENT="${ENVIRONMENT:-development}"
COMPOSE_FILE="docker-compose.yml"

if [ "$ENVIRONMENT" = "production" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    echo -e "${BLUE}Production mode detected${NC}"
else
    echo -e "${BLUE}Development mode detected${NC}"
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
        echo -e "${RED}No compose command found${NC}"
        exit 1
    fi
elif command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        echo -e "${RED}No compose command found${NC}"
        exit 1
    fi
else
    echo -e "${RED}Neither Docker nor Podman is installed${NC}"
    exit 1
fi

echo -e "${BLUE}Using: $CONTAINER_CMD with $COMPOSE_CMD${NC}"

# Check if we're in the correct directory
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}$COMPOSE_FILE not found. Please run from the deployment directory.${NC}"
    exit 1
fi

# Parse command line arguments
REMOVE_VOLUMES=false
REMOVE_IMAGES=false
FORCE_CLEANUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--volumes)
            REMOVE_VOLUMES=true
            shift
            ;;
        -i|--images)
            REMOVE_IMAGES=true
            shift
            ;;
        --force)
            FORCE_CLEANUP=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --volumes    Remove volumes (deletes all data)"
            echo "  -i, --images     Remove built images"
            echo "  --force          Force cleanup without confirmation"
            echo "  -h, --help       Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Stop containers only"
            echo "  $0 -v                 # Stop containers and remove volumes"
            echo "  $0 -i                 # Stop containers and remove images"
            echo "  $0 -v -i --force      # Complete cleanup without confirmation"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Show current running containers
echo -e "${BLUE}Current running Wordle containers:${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE ps 2>/dev/null || echo "No containers running"

echo ""
echo -e "${YELLOW}Stopping services in reverse dependency order...${NC}"

# Stop services in reverse dependency order (opposite of start-all.sh)
echo -e "${YELLOW}Step 1: Stopping frontend...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE stop frontend 2>/dev/null || true

echo -e "${YELLOW}Step 2: Stopping API gateway...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE stop api-gateway 2>/dev/null || true

echo -e "${YELLOW}Step 3: Stopping core services...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE stop user-service game-service profile-service 2>/dev/null || true

echo -e "${YELLOW}Step 4: Stopping database setup...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE stop database-setup 2>/dev/null || true

echo -e "${YELLOW}Step 5: Stopping PostgreSQL database...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE stop postgres redis 2>/dev/null || true

echo -e "${BLUE}Removing stopped containers...${NC}"
$COMPOSE_CMD -f $COMPOSE_FILE down --remove-orphans 2>/dev/null || true

# Clean up orphaned containers
echo -e "${BLUE}Cleaning up orphaned containers...${NC}"
$CONTAINER_CMD container prune -f 2>/dev/null || true

# Handle volume removal
if [ "$REMOVE_VOLUMES" = true ]; then
    if [ "$FORCE_CLEANUP" = false ]; then
        echo -e "${RED}WARNING: This will delete all database data and cached files!${NC}"
        read -p "Are you sure you want to remove volumes? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Volume removal cancelled${NC}"
            REMOVE_VOLUMES=false
        fi
    fi
    
    if [ "$REMOVE_VOLUMES" = true ]; then
        echo -e "${YELLOW}Removing volumes...${NC}"
        $COMPOSE_CMD -f $COMPOSE_FILE down -v 2>/dev/null || true
        
        # Clean up any remaining volumes
        echo -e "${BLUE}Cleaning up unused volumes...${NC}"
        $CONTAINER_CMD volume prune -f 2>/dev/null || true
        echo -e "${RED}All data volumes removed${NC}"
    fi
fi

# Handle image removal
if [ "$REMOVE_IMAGES" = true ]; then
    if [ "$FORCE_CLEANUP" = false ]; then
        echo -e "${YELLOW}This will remove all built Wordle images${NC}"
        read -p "Are you sure you want to remove images? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Image removal cancelled${NC}"
            REMOVE_IMAGES=false
        fi
    fi
    
    if [ "$REMOVE_IMAGES" = true ]; then
        echo -e "${YELLOW}Removing built images...${NC}"
        
        # Remove images built by compose
        $COMPOSE_CMD -f $COMPOSE_FILE down --rmi all 2>/dev/null || true
        
        # Clean up dangling images
        echo -e "${BLUE}Cleaning up unused images...${NC}"
        $CONTAINER_CMD image prune -f 2>/dev/null || true
        
        # Remove specific Wordle images if they exist
        wordle_images=$($CONTAINER_CMD images --format "{{.Repository}}:{{.Tag}}" | grep -E "(wordle|localhost.*wordle)" 2>/dev/null || true)
        if [ ! -z "$wordle_images" ]; then
            echo -e "${BLUE}Removing Wordle-specific images...${NC}"
            echo "$wordle_images" | xargs $CONTAINER_CMD rmi -f 2>/dev/null || true
        fi
        
        echo -e "${RED}All built images removed${NC}"
    fi
fi

# Final status check
echo ""
echo -e "${BLUE}Checking final status...${NC}"
running_containers=$($COMPOSE_CMD -f $COMPOSE_FILE ps -q 2>/dev/null | wc -l)

if [ "$running_containers" -eq 0 ]; then
    echo -e "${GREEN}✓ All Wordle containers stopped successfully${NC}"
else
    echo -e "${YELLOW}⚠ Some containers may still be running:${NC}"
    $COMPOSE_CMD -f $COMPOSE_FILE ps
fi

# Show cleanup summary
echo ""
echo -e "${GREEN}Wordle Application Stack Stopped!${NC}"
echo "=================================="

if [ "$REMOVE_VOLUMES" = true ] && [ "$REMOVE_IMAGES" = true ]; then
    echo -e "${RED}Complete cleanup performed:${NC}"
    echo "- Containers stopped and removed"
    echo "- Data volumes removed"
    echo "- Built images removed"
elif [ "$REMOVE_VOLUMES" = true ]; then
    echo -e "${YELLOW}Containers stopped, data volumes removed${NC}"
elif [ "$REMOVE_IMAGES" = true ]; then
    echo -e "${YELLOW}Containers stopped, images removed${NC}"
else
    echo -e "${GREEN}Containers stopped (data and images preserved)${NC}"
fi

echo ""
echo -e "${BLUE}To restart the application:${NC}"
echo "./start-all.sh"

echo ""
echo -e "${BLUE}For complete cleanup next time:${NC}"
echo "$0 -v -i --force"

# Show remaining system resources
echo ""
echo -e "${BLUE}System cleanup status:${NC}"
unused_volumes=$($CONTAINER_CMD volume ls -q --filter dangling=true 2>/dev/null | wc -l)
unused_images=$($CONTAINER_CMD images -q --filter dangling=true 2>/dev/null | wc -l)
stopped_containers=$($CONTAINER_CMD ps -aq --filter status=exited 2>/dev/null | wc -l)

if [ "$unused_volumes" -gt 0 ] || [ "$unused_images" -gt 0 ] || [ "$stopped_containers" -gt 0 ]; then
    echo -e "${YELLOW}System has unused resources:${NC}"
    [ "$unused_volumes" -gt 0 ] && echo "- $unused_volumes unused volumes"
    [ "$unused_images" -gt 0 ] && echo "- $unused_images unused images"  
    [ "$stopped_containers" -gt 0 ] && echo "- $stopped_containers stopped containers"
    echo ""
    echo -e "${BLUE}To clean up system resources:${NC}"
    echo "$CONTAINER_CMD system prune -a --volumes"
else
    echo -e "${GREEN}✓ System is clean${NC}"
fi