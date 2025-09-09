-- database/init.sql - Single database with logical separation for local development

-- Create single database for all services (easier for local development)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =======================
-- USERS TABLE (User Service)
-- =======================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE
);

CREATE TABLE user_schema.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP
);

-- Indexes for performance on user schema
CREATE INDEX idx_users_email ON user_schema.users(email);
CREATE INDEX idx_users_username ON user_schema.users(username);
CREATE INDEX idx_users_active ON user_schema.users(is_active);
CREATE INDEX idx_users_reset_token ON user_schema.users(reset_token);

-- =======================
-- USER STATS & PROFILE DATA (Profile Service)
-- =======================
CREATE TABLE user_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    average_guesses DECIMAL(3,1) DEFAULT 0.0,
    guess_distribution JSONB DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0,"6":0}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    game_id VARCHAR(255) NOT NULL,
    target_word VARCHAR(10) NOT NULL,
    attempts INTEGER NOT NULL,
    won BOOLEAN NOT NULL,
    guess_pattern JSONB NOT NULL,
    duration_seconds INTEGER,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id VARCHAR(255) NOT NULL,
    target_word VARCHAR(10) NOT NULL,
    attempts INTEGER NOT NULL,
    won BOOLEAN NOT NULL,
    guess_pattern JSONB NOT NULL,
    comment TEXT,
    likes INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES game_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

-- =======================
-- INDEXES FOR PERFORMANCE
-- =======================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_game_records_user_id ON game_records(user_id);
CREATE INDEX idx_game_records_completed_at ON game_records(completed_at DESC);
CREATE INDEX idx_game_posts_user_id ON game_posts(user_id);
CREATE INDEX idx_game_posts_created_at ON game_posts(created_at DESC);
CREATE INDEX idx_game_posts_public ON game_posts(is_public, created_at DESC);
CREATE INDEX idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX idx_words_answer ON words(is_answer);
CREATE INDEX idx_words_word ON words(word);

-- =======================
-- SAMPLE DATA FOR DEVELOPMENT
-- =======================
INSERT INTO users (email, username, password_hash, email_verified) VALUES 
('test@example.com', 'testuser', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeuyNdkSJdNHq8Hu6', TRUE),
('demo@example.com', 'demouser', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeuyNdkSJdNHq8Hu6', TRUE);

-- Initialize stats for sample users
INSERT INTO user_stats (user_id) 
SELECT id FROM users;