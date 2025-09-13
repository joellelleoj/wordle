-- Drop existing schemas if they exist (for clean restart)
DROP SCHEMA IF EXISTS user_schema CASCADE;
DROP SCHEMA IF EXISTS profile_schema CASCADE;

-- Create fresh schemas
CREATE SCHEMA IF NOT EXISTS user_schema;
CREATE SCHEMA IF NOT EXISTS profile_schema;

-- Set search path
SET search_path TO profile_schema, user_schema, public;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication and basic user data
CREATE TABLE user_schema.users (
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

-- User sessions for JWT refresh token management
CREATE TABLE user_schema.user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES user_schema.users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- OAuth states for CSRF protection during OAuth flow
CREATE TABLE user_schema.oauth_states (
    id SERIAL PRIMARY KEY,
    state_token VARCHAR(255) UNIQUE NOT NULL,
    redirect_uri VARCHAR(500),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Game Records Table - stores individual completed games
CREATE TABLE profile_schema.game_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    game_id VARCHAR(255) NOT NULL,
    target_word VARCHAR(5) NOT NULL,
    guesses TEXT[] NOT NULL DEFAULT '{}',
    won BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INTEGER NOT NULL CHECK (attempts >= 1 AND attempts <= 6),
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, game_id)
);

-- Game Albums Table - photo album-like organization of games
CREATE TABLE profile_schema.game_albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Album-Game Relationship Table (many-to-many)
CREATE TABLE profile_schema.album_games (
    album_id UUID NOT NULL REFERENCES profile_schema.game_albums(id) ON DELETE CASCADE,
    game_id VARCHAR(255) NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (album_id, game_id)
);

-- User Statistics Table - aggregated game statistics
CREATE TABLE profile_schema.user_stats (
    user_id VARCHAR(255) PRIMARY KEY,
    games_played INTEGER NOT NULL DEFAULT 0,
    games_won INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    max_streak INTEGER NOT NULL DEFAULT 0,
    average_guesses DECIMAL(3,1) NOT NULL DEFAULT 0.0,
    guess_distribution JSONB NOT NULL DEFAULT '{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0}',
    last_played_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- User schema indexes
CREATE INDEX idx_users_username ON user_schema.users(username);
CREATE INDEX idx_users_email ON user_schema.users(email);
CREATE INDEX idx_users_gitlab_id ON user_schema.users(gitlab_id);
CREATE INDEX idx_users_active ON user_schema.users(is_active) WHERE is_active = true;
CREATE INDEX idx_user_sessions_user_id ON user_schema.user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_schema.user_sessions(expires_at);
CREATE INDEX idx_oauth_states_token ON user_schema.oauth_states(state_token);
CREATE INDEX idx_oauth_states_expires ON user_schema.oauth_states(expires_at);

-- Profile schema indexes
CREATE INDEX idx_game_records_user_id ON profile_schema.game_records(user_id);
CREATE INDEX idx_game_records_completed_at ON profile_schema.game_records(completed_at DESC);
CREATE INDEX idx_game_records_user_completed ON profile_schema.game_records(user_id, completed_at DESC);
CREATE INDEX idx_game_albums_user_id ON profile_schema.game_albums(user_id);
CREATE INDEX idx_game_albums_created_at ON profile_schema.game_albums(created_at DESC);
CREATE INDEX idx_game_albums_public ON profile_schema.game_albums(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_album_games_album_id ON profile_schema.album_games(album_id);
CREATE INDEX idx_album_games_game_id ON profile_schema.album_games(game_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON user_schema.users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_albums_updated_at 
    BEFORE UPDATE ON profile_schema.game_albums 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update user stats when game_records are inserted
CREATE OR REPLACE FUNCTION profile_schema.update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update user stats
    INSERT INTO profile_schema.user_stats (user_id, games_played, games_won, last_played_at)
    VALUES (
        NEW.user_id,
        1,
        CASE WHEN NEW.won THEN 1 ELSE 0 END,
        NEW.completed_at
    )
    ON CONFLICT (user_id) DO UPDATE SET
        games_played = user_stats.games_played + 1,
        games_won = user_stats.games_won + CASE WHEN NEW.won THEN 1 ELSE 0 END,
        last_played_at = GREATEST(user_stats.last_played_at, NEW.completed_at),
        updated_at = NOW();
        
    -- Recalculate average guesses for wins only
    UPDATE profile_schema.user_stats 
    SET average_guesses = (
        SELECT COALESCE(AVG(attempts), 0.0)
        FROM profile_schema.game_records 
        WHERE user_id = NEW.user_id AND won = TRUE
    )
    WHERE user_id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trigger_update_user_stats
    AFTER INSERT ON profile_schema.game_records
    FOR EACH ROW
    EXECUTE FUNCTION profile_schema.update_user_stats();

-- Function to get user statistics
CREATE OR REPLACE FUNCTION profile_schema.get_user_statistics(p_user_id VARCHAR(255))
RETURNS TABLE (
    user_id VARCHAR(255),
    total_games INTEGER,
    wins INTEGER,
    win_rate DECIMAL(5,2),
    current_streak INTEGER,
    max_streak INTEGER,
    average_attempts DECIMAL(3,1),
    guess_distribution JSONB,
    last_played_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Ensure user stats exist
    INSERT INTO profile_schema.user_stats (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN QUERY
    SELECT 
        s.user_id,
        s.games_played as total_games,
        s.games_won as wins,
        CASE 
            WHEN s.games_played > 0 
            THEN ROUND((s.games_won::DECIMAL / s.games_played) * 100, 2)
            ELSE 0.0 
        END as win_rate,
        s.current_streak,
        s.max_streak,
        s.average_guesses as average_attempts,
        s.guess_distribution,
        s.last_played_at
    FROM profile_schema.user_stats s
    WHERE s.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;