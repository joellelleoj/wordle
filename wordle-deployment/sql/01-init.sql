-- Basic database initialization for testing
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    status VARCHAR(50) DEFAULT 'healthy',
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO health_check (status) VALUES ('initialized');
