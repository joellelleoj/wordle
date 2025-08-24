# =============================================================================
# Makefile - Development Convenience Commands
# =============================================================================

.PHONY: help start stop restart clean logs health test build deploy

# Default target
help:
	@echo "Wordle Application Management"
	@echo ""
	@echo "Available commands:"
	@echo "  start      Start all services"
	@echo "  stop       Stop all services"
	@echo "  restart    Restart all services"
	@echo "  clean      Stop and clean all data"
	@echo "  logs       Show logs for all services"
	@echo "  health     Run health checks"
	@echo "  test       Run test suite"
	@echo "  build      Build all images"
	@echo "  deploy     Deploy to production"
	@echo ""

start:
	@echo "🚀 Starting Wordle application..."
	./start-all.sh

stop:
	@echo "🛑 Stopping Wordle application..."
	./stop-all.sh

restart:
	@echo "🔄 Restarting Wordle application..."
	./stop-all.sh
	./start-all.sh

clean:
	@echo "🧹 Cleaning Wordle application..."
	./stop-all.sh --clean

logs:
	@echo "📋 Showing application logs..."
	./logs.sh logs

health:
	@echo "🔍 Running health checks..."
	./health-check.sh

test:
	@echo "🧪 Running test suite..."
	docker-compose exec -T api-gateway npm test
	docker-compose exec -T user-service npm test
	docker-compose exec -T game-service npm test
	docker-compose exec -T profile-service npm test

build:
	@echo "🏗️ Building all images..."
	docker-compose build --parallel

deploy:
	@echo "🚀 Deploying to production..."
	./deploy-production.sh

# Development targets
dev-start:
	@echo "💻 Starting development environment..."
	./start-all.sh --development

dev-logs:
	@echo "💻 Following development logs..."
	./logs.sh follow

dev-test:
	@echo "💻 Running development tests..."
	docker-compose exec frontend npm test
	docker-compose exec api-gateway npm run test:watch