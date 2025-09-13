# deployment/Makefile - Deployment automation for Wordle application
# Following 12-Factor App methodology and course requirements

.PHONY: help dev prod stop clean logs health rebuild test install

# Default target
help:
	@echo "Wordle Deployment Commands"
	@echo "=========================="
	@echo ""
	@echo "Development:"
	@echo "  make dev        - Start development environment"
	@echo "  make dev-build  - Build and start development with fresh images"
	@echo ""
	@echo "Production:"
	@echo "  make prod       - Deploy to production (HTWK Leipzig)"
	@echo "  make prod-build - Deploy to production with fresh build"
	@echo ""
	@echo "Management:"
	@echo "  make stop       - Stop all services"
	@echo "  make clean      - Stop and remove all containers/volumes"
	@echo "  make logs       - Show logs for all services"
	@echo "  make health     - Check health of all services"
	@echo "  make rebuild    - Complete rebuild (stop, clean, build, start)"
	@echo ""
	@echo "Testing:"
	@echo "  make test       - Run integration tests"
	@echo "  make install    - Install/update dependencies"
	@echo ""
	@echo "Individual Services:"
	@echo "  make logs-frontend      - Show frontend logs"
	@echo "  make logs-api-gateway   - Show API gateway logs"
	@echo "  make logs-user-service  - Show user service logs"
	@echo "  make logs-game-service  - Show game service logs"
	@echo "  make logs-profile-service - Show profile service logs"
	@echo "  make logs-postgres      - Show database logs"
	@echo "  make logs-redis         - Show redis logs"

# Check if Docker/Podman is available
check-docker:
	@which docker >/dev/null 2>&1 || which podman >/dev/null 2>&1 || \
		(echo "Error: Neither Docker nor Podman found. Please install one of them." && exit 1)

# Development environment
dev: check-docker
	@echo "Starting Wordle development environment..."
	@chmod +x start-all.sh
	@./start-all.sh

dev-build: check-docker
	@echo "Building and starting Wordle development environment..."
	@chmod +x start-all.sh
	@./start-all.sh --no-cache

# Production deployment
prod: check-docker
	@echo "Deploying Wordle to production..."
	@chmod +x deploy-production.sh
	@./deploy-production.sh

prod-build: check-docker
	@echo "Building and deploying Wordle to production..."
	@chmod +x deploy-production.sh
	@./deploy-production.sh --force-rebuild

# Management commands
stop:
	@echo "Stopping all Wordle services..."
	@docker compose down 2>/dev/null || docker-compose down 2>/dev/null || \
		podman-compose down 2>/dev/null || echo "No services running"
	@docker compose -f docker-compose.prod.yml down 2>/dev/null || \
		docker-compose -f docker-compose.prod.yml down 2>/dev/null || \
		podman-compose -f docker-compose.prod.yml down 2>/dev/null || true

clean: stop
	@echo "Cleaning up Wordle containers and volumes..."
	@docker compose down -v --remove-orphans 2>/dev/null || \
		docker-compose down -v --remove-orphans 2>/dev/null || \
		podman-compose down -v --remove-orphans 2>/dev/null || true
	@docker compose -f docker-compose.prod.yml down -v --remove-orphans 2>/dev/null || \
		docker-compose -f docker-compose.prod.yml down -v --remove-orphans 2>/dev/null || \
		podman-compose -f docker-compose.prod.yml down -v --remove-orphans 2>/dev/null || true
	@docker system prune -f 2>/dev/null || podman system prune -f 2>/dev/null || true

logs:
	@echo "Showing logs for all Wordle services..."
	@docker compose logs -f 2>/dev/null || docker-compose logs -f 2>/dev/null || \
		podman-compose logs -f 2>/dev/null || echo "No services running"

health: check-docker
	@echo "Checking health of Wordle services..."
	@echo "======================================="
	@echo "Frontend Health:"
	@curl -s -f http://localhost:8080/health 2>/dev/null && echo "✅ Frontend OK" || echo "❌ Frontend Failed"
	@echo ""
	@echo "API Gateway Health:"
	@curl -s -f http://localhost:8082/health 2>/dev/null && echo "✅ API Gateway OK" || echo "❌ API Gateway Failed"
	@echo ""
	@echo "Container Status:"
	@docker compose ps 2>/dev/null || docker-compose ps 2>/dev/null || \
		podman-compose ps 2>/dev/null || echo "No containers running"

rebuild: clean
	@echo "Performing complete rebuild of Wordle application..."
	@make dev-build

# Testing
test: check-docker
	@echo "Running Wordle integration tests..."
	@./test-deployment.sh

# Install/update dependencies
install:
	@echo "Installing/updating dependencies..."
	@cd ../frontend && npm install
	@cd ../api-gateway && npm install
	@cd ../game-service && npm install
	@cd ../user-service && npm install
	@cd ../profile-service && npm install
	@cd ../database && npm install

# Individual service logs
logs-frontend:
	@docker compose logs -f frontend 2>/dev/null || docker-compose logs -f frontend 2>/dev/null || \
		podman-compose logs -f frontend 2>/dev/null

logs-api-gateway:
	@docker compose logs -f api-gateway 2>/dev/null || docker-compose logs -f api-gateway 2>/dev/null || \
		podman-compose logs -f api-gateway 2>/dev/null

logs-user-service:
	@docker compose logs -f user-service 2>/dev/null || docker-compose logs -f user-service 2>/dev/null || \
		podman-compose logs -f user-service 2>/dev/null

logs-game-service:
	@docker compose logs -f game-service 2>/dev/null || docker-compose logs -f game-service 2>/dev/null || \
		podman-compose logs -f game-service 2>/dev/null

logs-profile-service:
	@docker compose logs -f profile-service 2>/dev/null || docker-compose logs -f profile-service 2>/dev/null || \
		podman-compose logs -f profile-service 2>/dev/null

logs-postgres:
	@docker compose logs -f postgres 2>/dev/null || docker-compose logs -f postgres 2>/dev/null || \
		podman-compose logs -f postgres 2>/dev/null

logs-redis:
	@docker compose logs -f redis 2>/dev/null || docker-compose logs -f redis 2>/dev/null || \
		podman-compose logs -f redis 2>/dev/null

# Service management
restart-%:
	@echo "Restarting $* service..."
	@docker compose restart $* 2>/dev/null || docker-compose restart $* 2>/dev/null || \
		podman-compose restart $* 2>/dev/null

shell-%:
	@echo "Opening shell in $* service..."
	@docker compose exec $* /bin/sh 2>/dev/null || docker-compose exec $* /bin/sh 2>/dev/null || \
		podman-compose exec $* /bin/sh 2>/dev/null

# Quick commands for common tasks
up: dev
down: stop
build: dev-build
status: health