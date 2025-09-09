-- Complete Database Schema for Wordle Profile Service
-- This schema should be added to your existing PostgreSQL database

-- Create profile schema (separate from user schema)
CREATE SCHEMA IF NOT EXISTS profile_schema;

-- Set search path to include both schemas
-- This allows the profile service to access user data via URIs
SET search_path TO profile_schema, user_schema, public;

-- =====================================================
-- GAME RECORDS TABLE
-- Stores completed games for authenticated users
-- =====================================================
CREATE TABLE IF NOT EXISTS profile_schema.game_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL, -- Reference to user_schema.users.id via URI
    game_id VARCHAR(255) NOT NULL UNIQUE, -- From game service
    target_word VARCHAR(5) NOT NULL,
    guesses TEXT[] NOT NULL, -- Array of guessed words
    won BOOLEAN NOT NULL,
    attempts INTEGER NOT NULL CHECK (attempts >= 1 AND attempts <= 6),
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_user_game UNIQUE(user_id, game_id),
    CONSTRAINT valid_target_word CHECK (LENGTH(target_word) = 5),
    CONSTRAINT valid_guesses CHECK (array_length(guesses, 1) <= 6)
);

-- =====================================================
-- GAME POSTS TABLE  
-- Social posts created from completed games (like Bildergallerie)
-- =====================================================
CREATE TABLE IF NOT EXISTS profile_schema.game_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL, -- Reference to user via URI
    game_record_id UUID NOT NULL REFERENCES profile_schema.game_records(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    comment TEXT, -- User's comment about the game
    is_public BOOLEAN DEFAULT true, -- Whether post is visible to others
    tags TEXT[] DEFAULT '{}', -- Array of tags for categorization
    likes INTEGER DEFAULT 0 CHECK (likes >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_title CHECK (LENGTH(title) >= 1 AND LENGTH(title) <= 200),
    CONSTRAINT valid_comment CHECK (comment IS NULL OR LENGTH(comment) <= 1000),
    CONSTRAINT valid_tags CHECK (array_length(tags, 1) <= 10)
);

-- =====================================================
-- GAME ALBUMS TABLE
-- Organization of posts into albums (like Bildergallerie albums)
-- =====================================================
CREATE TABLE IF NOT EXISTS profile_schema.game_albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL, -- Reference to user via URI
    title VARCHAR(200) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false, -- Albums are private by default
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_album_title CHECK (LENGTH(title) >= 1 AND LENGTH(title) <= 200),
    CONSTRAINT valid_album_description CHECK (description IS NULL OR LENGTH(description) <= 2000)
);

-- =====================================================
-- ALBUM POSTS JUNCTION TABLE
-- Many-to-many relationship between albums and posts
-- =====================================================
CREATE TABLE IF NOT EXISTS profile_schema.album_posts (
    album_id UUID NOT NULL REFERENCES profile_schema.game_albums(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES profile_schema.game_posts(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    display_order INTEGER DEFAULT 0, -- For custom ordering within album
    
    PRIMARY KEY (album_id, post_id)
);

-- =====================================================
-- POST LIKES TABLE
-- Track which users liked which posts (social feature)
-- =====================================================
CREATE TABLE IF NOT EXISTS profile_schema.post_likes (
    post_id UUID NOT NULL REFERENCES profile_schema.game_posts(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL, -- Reference to user via URI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (post_id, user_id)
);

-- =====================================================
-- USER STATISTICS VIEW
-- Calculated statistics for each user (materialized for performance)
-- =====================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS profile_schema.user_statistics AS
SELECT 
    gr.user_id,
    COUNT(*) as total_games,
    COUNT(*) FILTER (WHERE gr.won = true) as games_won,
    CASE 
        WHEN COUNT(*) > 0 
        THEN ROUND((COUNT(*) FILTER (WHERE gr.won = true)::DECIMAL / COUNT(*)) * 100, 1) 
        ELSE 0 
    END as win_rate,
    COALESCE(AVG(gr.attempts) FILTER (WHERE gr.won = true), 0) as average_attempts,
    MAX(gr.completed_at) as last_played_at,
    
    -- Guess distribution for won games
    COUNT(*) FILTER (WHERE gr.won = true AND gr.attempts = 1) as guesses_1,
    COUNT(*) FILTER (WHERE gr.won = true AND gr.attempts = 2) as guesses_2,
    COUNT(*) FILTER (WHERE gr.won = true AND gr.attempts = 3) as guesses_3,
    COUNT(*) FILTER (WHERE gr.won = true AND gr.attempts = 4) as guesses_4,
    COUNT(*) FILTER (WHERE gr.won = true AND gr.attempts = 5) as guesses_5,
    COUNT(*) FILTER (WHERE gr.won = true AND gr.attempts = 6) as guesses_6,
    
    -- Games per day for chart visualization
    jsonb_object_agg(
        DATE(gr.completed_at), 
        COUNT(*) 
        ORDER BY DATE(gr.completed_at)
    ) as games_per_day
    
FROM profile_schema.game_records gr
GROUP BY gr.user_id;

-- Create unique index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_statistics_user_id 
ON profile_schema.user_statistics(user_id);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Game records indexes
CREATE INDEX IF NOT EXISTS idx_game_records_user_id 
ON profile_schema.game_records(user_id);

CREATE INDEX IF NOT EXISTS idx_game_records_completed_at 
ON profile_schema.game_records(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_records_won 
ON profile_schema.game_records(won);

-- Game posts indexes
CREATE INDEX IF NOT EXISTS idx_game_posts_user_id 
ON profile_schema.game_posts(user_id);

CREATE INDEX IF NOT EXISTS idx_game_posts_public 
ON profile_schema.game_posts(is_public, created_at DESC) 
WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_game_posts_tags 
ON profile_schema.game_posts USING GIN(tags);

-- Game albums indexes
CREATE INDEX IF NOT EXISTS idx_game_albums_user_id 
ON profile_schema.game_albums(user_id);

CREATE INDEX IF NOT EXISTS idx_game_albums_public 
ON profile_schema.game_albums(is_public, created_at DESC) 
WHERE is_public = true;

-- Post likes indexes
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id 
ON profile_schema.post_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_post_likes_created_at 
ON profile_schema.post_likes(created_at DESC);

-- =====================================================
-- FUNCTIONS FOR STATISTICS CALCULATION
-- =====================================================

-- Function to calculate current and max streak for a user
CREATE OR REPLACE FUNCTION profile_schema.calculate_user_streaks(p_user_id VARCHAR)
RETURNS TABLE(current_streak INTEGER, max_streak INTEGER) AS $$
DECLARE
    game_record RECORD;
    temp_streak INTEGER := 0;
    max_str INTEGER := 0;
    current_str INTEGER := 0;
    is_first BOOLEAN := true;
BEGIN
    -- Iterate through games in reverse chronological order
    FOR game_record IN 
        SELECT won FROM profile_schema.game_records 
        WHERE user_id = p_user_id 
        ORDER BY completed_at DESC
    LOOP
        IF game_record.won THEN
            temp_streak := temp_streak + 1;
            IF is_first THEN
                current_str := temp_streak;
            END IF;
            max_str := GREATEST(max_str, temp_streak);
        ELSE
            IF is_first THEN
                current_str := 0;
            END IF;
            temp_streak := 0;
        END IF;
        is_first := false;
    END LOOP;
    
    RETURN QUERY SELECT current_str, max_str;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update post like counts
CREATE OR REPLACE FUNCTION profile_schema.update_post_likes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE profile_schema.game_posts 
        SET likes = likes + 1 
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE profile_schema.game_posts 
        SET likes = likes - 1 
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for post likes
DROP TRIGGER IF EXISTS trigger_update_post_likes ON profile_schema.post_likes;
CREATE TRIGGER trigger_update_post_likes
    AFTER INSERT OR DELETE ON profile_schema.post_likes
    FOR EACH ROW EXECUTE FUNCTION profile_schema.update_post_likes();

-- Function to refresh user statistics
CREATE OR REPLACE FUNCTION profile_schema.refresh_user_statistics()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY profile_schema.user_statistics;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh statistics when games are added/updated
DROP TRIGGER IF EXISTS trigger_refresh_stats ON profile_schema.game_records;
CREATE TRIGGER trigger_refresh_stats
    AFTER INSERT OR UPDATE OR DELETE ON profile_schema.game_records
    FOR EACH STATEMENT EXECUTE FUNCTION profile_schema.refresh_user_statistics();

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================

-- Insert sample game records (replace with actual user IDs from your user service)
INSERT INTO profile_schema.game_records (user_id, game_id, target_word, guesses, won, attempts, completed_at) VALUES
('1', 'game_test_1', 'HELLO', ARRAY['HOUSE', 'HORSE', 'HELLO'], true, 3, NOW() - INTERVAL '2 days'),
('1', 'game_test_2', 'WORLD', ARRAY['WATER', 'WORTH', 'WORLD'], true, 3, NOW() - INTERVAL '1 day'),
('1', 'game_test_3', 'GAMES', ARRAY['GREAT', 'GRAVE', 'GRACE', 'GAMES'], true, 4, NOW()),
('2', 'game_test_4', 'QUICK', ARRAY['QUITE', 'QUEEN', 'QUEST', 'QUIET', 'QUACK', 'QUICK'], true, 6, NOW() - INTERVAL '3 days'),
('2', 'game_test_5', 'BROWN', ARRAY['BREAD', 'BRICK', 'BRING', 'BRINK', 'BROKE', 'BROOM'], false, 6, NOW() - INTERVAL '1 day')
ON CONFLICT (user_id, game_id) DO NOTHING;

-- Insert sample posts
INSERT INTO profile_schema.game_posts (user_id, game_record_id, title, comment, is_public, tags) 
SELECT 
    '1', 
    id, 
    'My awesome Wordle game!', 
    'Finally got it in 3 tries!', 
    true, 
    ARRAY['wordle', 'success', 'daily']
FROM profile_schema.game_records 
WHERE user_id = '1' AND game_id = 'game_test_1'
ON CONFLICT DO NOTHING;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW profile_schema.user_statistics;

/*-- Database initialization script for Wordle User Service
-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    gitlab_id INTEGER UNIQUE,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user sessions table for refresh tokens
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create games table for game records
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    word VARCHAR(5) NOT NULL,
    guesses TEXT[] DEFAULT '{}',
    attempts INTEGER DEFAULT 0,
    won BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_stats table for aggregated statistics
CREATE TABLE IF NOT EXISTS user_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    average_attempts DECIMAL(3,2) DEFAULT 0,
    guess_distribution JSONB DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0,"6":0}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create posts table for user game sharing
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id INTEGER REFERENCES games(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_gitlab_id ON users(gitlab_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);

-- Create trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON user_stats 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

/*-- Initialize database schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    gitlab_id INTEGER UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table for managing refresh tokens
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(512) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_gitlab_id ON users(gitlab_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON user_sessions(refresh_token);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert test users (password is 'test123' hashed with bcrypt)
INSERT INTO users (username, email, password_hash) 
VALUES 
    ('testuser', 'test@example.com', '$2b$10$rQl.mH8LBWKv4IaZmH8XMu8qJ6OyXBz4OJDMWgvQCpJ9P2p2K2QK2'),
    ('demo', 'demo@example.com', '$2b$10$rQl.mH8LBWKv4IaZmH8XMu8qJ6OyXBz4OJDMWgvQCpJ9P2p2K2QK2'),
    ('player1', 'player1@example.com', '$2b$10$rQl.mH8LBWKv4IaZmH8XMu8qJ6OyXBz4OJDMWgvQCpJ9P2p2K2QK2')
ON CONFLICT (username) DO NOTHING;
/*-- User Service Database Schema
-- File: src/database/schema.sql

-- Create database (run this manually first)
-- CREATE DATABASE wordle_users;
-- CREATE USER wordle_user WITH PASSWORD 'secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE wordle_users TO wordle_user;

-- Connect to wordle_users database and run the following:

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication and basic user data
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    display_name VARCHAR(255),
    avatar_url TEXT,
    password_hash VARCHAR(255), -- for potential local auth
    oauth_provider VARCHAR(50) DEFAULT 'gitlab',
    oauth_id VARCHAR(255),
    email_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens table for JWT token management
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OAuth states table for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state_token VARCHAR(255) NOT NULL UNIQUE,
    user_session VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table (optional, for session-based auth)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_oauth_id ON users(oauth_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_token ON oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_refresh_tokens_updated_at BEFORE UPDATE ON refresh_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();