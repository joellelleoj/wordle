# =============================================================================
# migrations/scripts/migrate.sh - Migration Execution Script
# =============================================================================

#!/bin/bash

set -e

echo "Starting database migrations..."

# Wait for databases to be ready
echo "Waiting for main database..."
until pg_isready -h postgres-main -p 5432 -U "${POSTGRES_USER}"; do
    echo "Main database not ready, waiting..."
    sleep 2
done

echo "Waiting for dictionary database..."
until pg_isready -h postgres-dict -p 5432 -U "${DICT_POSTGRES_USER}"; do
    echo "Dictionary database not ready, waiting..."
    sleep 2
done

echo "Databases are ready, running migrations..."

# Run main database migrations
echo "Running main database migrations..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql -h postgres-main -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f migrations/001_initial_schema.sql
PGPASSWORD="${POSTGRES_PASSWORD}" psql -h postgres-main -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f migrations/002_add_indexes.sql
PGPASSWORD="${POSTGRES_PASSWORD}" psql -h postgres-main -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f migrations/003_add_triggers.sql

# Run dictionary database migrations
echo "Running dictionary database migrations..."
PGPASSWORD="${DICT_POSTGRES_PASSWORD}" psql -h postgres-dict -U "${DICT_POSTGRES_USER}" -d "${DICT_POSTGRES_DB}" -f migrations/101_dictionary_schema.sql
PGPASSWORD="${DICT_POSTGRES_PASSWORD}" psql -h postgres-dict -U "${DICT_POSTGRES_USER}" -d "${DICT_POSTGRES_DB}" -f migrations/102_load_words.sql

echo "Migrations completed successfully!"
