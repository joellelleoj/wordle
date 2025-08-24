# =============================================================================
# migrations/Dockerfile - Database Migration Container
# =============================================================================

FROM node:18-alpine

WORKDIR /app

# Install PostgreSQL client
RUN apk add --no-cache postgresql-client

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy migration scripts
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/

# Make scripts executable
RUN chmod +x ./scripts/*.sh

# Set default command
CMD ["./scripts/migrate.sh"]