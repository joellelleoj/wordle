// user-service/src/database/migration.ts - Enhanced with profile schema
import { pool } from "./connection";

export class DatabaseMigration {
  async runMigrations(): Promise<void> {
    try {
      console.log("Running database migrations...");

      // Create migrations table to track which migrations have been run
      await pool.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Check if initial migration has been run
      const migrationCheck = await pool.query(
        "SELECT * FROM migrations WHERE name = $1",
        ["001_initial_schema"]
      );

      if (migrationCheck.rows.length === 0) {
        await this.runInitialMigration();

        // Mark migration as completed
        await pool.query("INSERT INTO migrations (name) VALUES ($1)", [
          "001_initial_schema",
        ]);

        console.log("✅ Initial database migration completed");
      }

      // Check if profile schema migration has been run
      const profileMigrationCheck = await pool.query(
        "SELECT * FROM migrations WHERE name = $1",
        ["002_profile_schema"]
      );

      if (profileMigrationCheck.rows.length === 0) {
        await this.runProfileSchemaMigration();

        // Mark migration as completed
        await pool.query("INSERT INTO migrations (name) VALUES ($1)", [
          "002_profile_schema",
        ]);

        console.log("✅ Profile schema migration completed");
      }

      console.log("✅ Database schema is up to date");
    } catch (error) {
      console.error("❌ Database migration failed:", error);
      throw error;
    }
  }

  private async runInitialMigration(): Promise<void> {
    // Begin transaction
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Create users table (your existing structure)
      await client.query(`
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
      `);

      // Create user_sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          refresh_token VARCHAR(500) UNIQUE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create user_stats table
      await client.query(`
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
      `);

      // Create games table for basic game tracking
      await client.query(`
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
      `);

      // Create posts table for basic social features
      await client.query(`
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
      `);

      // Create indexes for performance (your existing indexes)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_gitlab_id ON users(gitlab_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON user_sessions(refresh_token);
        CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
        CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
        CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
        CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
      `);

      // Create trigger function for updating timestamps
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

      // Create triggers (your existing triggers)
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
            CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
              FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_stats_updated_at') THEN
            CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON user_stats 
              FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_posts_updated_at') THEN
            CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts 
              FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
          END IF;
        END
        $$;
      `);

      await client.query("COMMIT");
      console.log("✅ User service tables and indexes created successfully");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("❌ Initial migration failed, rolling back:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async runProfileSchemaMigration(): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Create profile schema for separation of concerns
      await client.query(`CREATE SCHEMA IF NOT EXISTS profile_schema;`);

      // Set search path to access both schemas
      await client.query(`SET search_path TO profile_schema, public;`);

      // Create game_records table (enhanced version of games table)
      await client.query(`
        CREATE TABLE IF NOT EXISTS profile_schema.game_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL, -- Reference to public.users.id
          game_id VARCHAR(255) NOT NULL UNIQUE,
          target_word VARCHAR(5) NOT NULL,
          guesses TEXT[] NOT NULL,
          won BOOLEAN NOT NULL,
          attempts INTEGER NOT NULL CHECK (attempts >= 1 AND attempts <= 6),
          completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          CONSTRAINT unique_user_game UNIQUE(user_id, game_id),
          CONSTRAINT valid_target_word CHECK (LENGTH(target_word) = 5),
          CONSTRAINT valid_guesses CHECK (array_length(guesses, 1) <= 6)
        );
      `);

      // Create game_posts table (enhanced social features)
      await client.query(`
        CREATE TABLE IF NOT EXISTS profile_schema.game_posts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          game_record_id UUID NOT NULL REFERENCES profile_schema.game_records(id) ON DELETE CASCADE,
          title VARCHAR(200) NOT NULL,
          comment TEXT,
          is_public BOOLEAN DEFAULT true,
          tags TEXT[] DEFAULT '{}',
          likes INTEGER DEFAULT 0 CHECK (likes >= 0),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          CONSTRAINT valid_title CHECK (LENGTH(title) >= 1 AND LENGTH(title) <= 200),
          CONSTRAINT valid_comment CHECK (comment IS NULL OR LENGTH(comment) <= 1000),
          CONSTRAINT valid_tags CHECK (array_length(tags, 1) <= 10)
        );
      `);

      // Create game_albums table (like Bildergallerie)
      await client.query(`
        CREATE TABLE IF NOT EXISTS profile_schema.game_albums (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          title VARCHAR(200) NOT NULL,
          description TEXT,
          is_public BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          CONSTRAINT valid_album_title CHECK (LENGTH(title) >= 1 AND LENGTH(title) <= 200),
          CONSTRAINT valid_album_description CHECK (description IS NULL OR LENGTH(description) <= 2000)
        );
      `);

      // Create album_posts junction table
      await client.query(`
        CREATE TABLE IF NOT EXISTS profile_schema.album_posts (
          album_id UUID NOT NULL REFERENCES profile_schema.game_albums(id) ON DELETE CASCADE,
          post_id UUID NOT NULL REFERENCES profile_schema.game_posts(id) ON DELETE CASCADE,
          added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          display_order INTEGER DEFAULT 0,
          
          PRIMARY KEY (album_id, post_id)
        );
      `);

      // Create post_likes table
      await client.query(`
        CREATE TABLE IF NOT EXISTS profile_schema.post_likes (
          post_id UUID NOT NULL REFERENCES profile_schema.game_posts(id) ON DELETE CASCADE,
          user_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          PRIMARY KEY (post_id, user_id)
        );
      `);

      // Create indexes for profile schema
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_game_records_user_id ON profile_schema.game_records(user_id);
        CREATE INDEX IF NOT EXISTS idx_game_records_completed_at ON profile_schema.game_records(completed_at DESC);
        CREATE INDEX IF NOT EXISTS idx_game_records_won ON profile_schema.game_records(won);
        CREATE INDEX IF NOT EXISTS idx_game_posts_user_id ON profile_schema.game_posts(user_id);
        CREATE INDEX IF NOT EXISTS idx_game_posts_public ON profile_schema.game_posts(is_public, created_at DESC) WHERE is_public = true;
        CREATE INDEX IF NOT EXISTS idx_game_posts_tags ON profile_schema.game_posts USING GIN(tags);
        CREATE INDEX IF NOT EXISTS idx_game_albums_user_id ON profile_schema.game_albums(user_id);
        CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON profile_schema.post_likes(user_id);
      `);

      // Create materialized view for user statistics
      await client.query(`
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
          COUNT(*) FILTER (WHERE gr.won = true AND gr.attempts = 6) as guesses_6
          
        FROM profile_schema.game_records gr
        GROUP BY gr.user_id;
      `);

      // Create unique index for materialized view
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_statistics_user_id 
        ON profile_schema.user_statistics(user_id);
      `);

      // Create functions and triggers for automatic updates
      await client.query(`
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
      `);

      // Create trigger for post likes
      await client.query(`
        DROP TRIGGER IF EXISTS trigger_update_post_likes ON profile_schema.post_likes;
        CREATE TRIGGER trigger_update_post_likes
          AFTER INSERT OR DELETE ON profile_schema.post_likes
          FOR EACH ROW EXECUTE FUNCTION profile_schema.update_post_likes();
      `);

      await client.query("COMMIT");
      console.log("✅ Profile schema tables and indexes created successfully");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("❌ Profile schema migration failed, rolling back:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async checkDatabaseHealth(): Promise<boolean> {
    try {
      // Check if all required tables exist
      const result = await pool.query(`
        SELECT table_name, table_schema
        FROM information_schema.tables 
        WHERE table_schema IN ('public', 'profile_schema')
        AND table_name IN ('users', 'user_sessions', 'user_stats', 'game_records', 'game_posts');
      `);

      const existingTables = result.rows.map(
        (row) => `${row.table_schema}.${row.table_name}`
      );
      const requiredTables = [
        "public.users",
        "public.user_sessions",
        "public.user_stats",
        "profile_schema.game_records",
        "profile_schema.game_posts",
      ];

      const allTablesExist = requiredTables.every((table) =>
        existingTables.includes(table)
      );

      if (!allTablesExist) {
        console.log(
          "Missing tables:",
          requiredTables.filter((table) => !existingTables.includes(table))
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("Database health check failed:", error);
      return false;
    }
  }
}
