import { Pool } from "pg";

export class ProfileDataAccess {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Set schema for this service
    this.pool.on("connect", (client) => {
      client.query("SET search_path TO profile_schema, user_schema, public");
    });
  }

  // User Statistics Operations
  async getUserStats(userId: string): Promise<any | null> {
    const result = await this.pool.query(
      `
      SELECT * FROM user_stats 
      WHERE user_id = $1
      `,
      [userId]
    );

    return result.rows[0] || null;
  }

  async createUserStats(userId: string): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO user_stats (user_id, games_played, games_won, current_streak, max_streak, average_guesses, guess_distribution)
      VALUES ($1, 0, 0, 0, 0, 0.0, $2)
      ON CONFLICT (user_id) DO NOTHING
      `,
      [
        userId,
        JSON.stringify({ "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 }),
      ]
    );
  }

  async updateUserStats(
    userId: string,
    stats: {
      gamesPlayed: number;
      gamesWon: number;
      currentStreak: number;
      maxStreak: number;
      averageGuesses: number;
      guessDistribution: Record<string, number>;
    }
  ): Promise<void> {
    await this.pool.query(
      `
      UPDATE user_stats 
      SET 
        games_played = $2,
        games_won = $3,
        current_streak = $4,
        max_streak = $5,
        average_guesses = $6,
        guess_distribution = $7,
        updated_at = NOW()
      WHERE user_id = $1
      `,
      [
        userId,
        stats.gamesPlayed,
        stats.gamesWon,
        stats.currentStreak,
        stats.maxStreak,
        stats.averageGuesses,
        JSON.stringify(stats.guessDistribution),
      ]
    );
  }

  // Game Recording Operations
  async recordGame(userId: string, gameData: any): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO game_records (user_id, game_id, target_word, attempts, won, guess_pattern, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        userId,
        gameData.gameId,
        gameData.targetWord,
        gameData.attempts,
        gameData.won,
        JSON.stringify(gameData.guessPattern),
        gameData.completedAt,
      ]
    );
  }

  async getGameHistory(
    userId: string,
    limit: number,
    offset: number
  ): Promise<any[]> {
    const result = await this.pool.query(
      `
      SELECT game_id, target_word, attempts, won, guess_pattern, completed_at
      FROM game_records
      WHERE user_id = $1
      ORDER BY completed_at DESC
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset]
    );

    return result.rows.map((row) => ({
      ...row,
      guessPattern: JSON.parse(row.guess_pattern),
    }));
  }

  async getWonGames(userId: string): Promise<any[]> {
    const result = await this.pool.query(
      `
      SELECT attempts FROM game_records
      WHERE user_id = $1 AND won = true
      `,
      [userId]
    );

    return result.rows;
  }

  // Social Posts Operations (CRUD)
  async createGamePost(userId: string, postData: any): Promise<any> {
    const result = await this.pool.query(
      `
      INSERT INTO game_posts (user_id, game_id, target_word, attempts, won, guess_pattern, comment, likes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        userId,
        postData.gameId,
        postData.targetWord,
        postData.attempts,
        postData.won,
        JSON.stringify(postData.guessPattern),
        postData.comment,
        postData.likes,
        postData.createdAt,
        postData.updatedAt,
      ]
    );

    const post = result.rows[0];
    return {
      ...post,
      guessPattern: JSON.parse(post.guess_pattern),
    };
  }

  async getUserPosts(
    userId: string,
    limit: number,
    offset: number
  ): Promise<any[]> {
    const result = await this.pool.query(
      `
      SELECT p.*, u.username
      FROM game_posts p
      JOIN user_schema.users u ON p.user_id = u.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset]
    );

    return result.rows.map((row) => ({
      ...row,
      guessPattern: JSON.parse(row.guess_pattern),
    }));
  }

  async getPublicPosts(limit: number, offset: number): Promise<any[]> {
    const result = await this.pool.query(
      `
      SELECT p.*, u.username
      FROM game_posts p
      JOIN user_schema.users u ON p.user_id = u.id
      WHERE u.is_active = true
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    return result.rows.map((row) => ({
      ...row,
      guessPattern: JSON.parse(row.guess_pattern),
    }));
  }

  async getPostById(postId: string): Promise<any | null> {
    const result = await this.pool.query(
      `
      SELECT p.*, u.username
      FROM game_posts p
      JOIN user_schema.users u ON p.user_id = u.id
      WHERE p.id = $1
      `,
      [postId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const post = result.rows[0];
    return {
      ...post,
      guessPattern: JSON.parse(post.guess_pattern),
    };
  }

  async updateGamePost(postId: string, updates: any): Promise<any> {
    const setClauses = [];
    const values = [postId];
    let paramCount = 1;

    if (updates.comment !== undefined) {
      setClauses.push(`comment = $${++paramCount}`);
      values.push(updates.comment);
    }

    if (updates.updatedAt) {
      setClauses.push(`updated_at = $${++paramCount}`);
      values.push(updates.updatedAt);
    }

    if (setClauses.length === 0) {
      throw new Error("No updates provided");
    }

    const result = await this.pool.query(
      `
      UPDATE game_posts 
      SET ${setClauses.join(", ")}
      WHERE id = $1
      RETURNING *
      `,
      values
    );

    const post = result.rows[0];
    return {
      ...post,
      guessPattern: JSON.parse(post.guess_pattern),
    };
  }

  async deleteGamePost(postId: string): Promise<void> {
    await this.pool.query(`DELETE FROM game_posts WHERE id = $1`, [postId]);
  }

  // Like system
  async hasUserLikedPost(postId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `
      SELECT 1 FROM post_likes 
      WHERE post_id = $1 AND user_id = $2
      `,
      [postId, userId]
    );

    return result.rows.length > 0;
  }

  async addPostLike(postId: string, userId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // Add like record
      await client.query(
        `
        INSERT INTO post_likes (post_id, user_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (post_id, user_id) DO NOTHING
        `,
        [postId, userId]
      );

      // Update like count
      await client.query(
        `
        UPDATE game_posts 
        SET likes = (
          SELECT COUNT(*) FROM post_likes WHERE post_id = $1
        )
        WHERE id = $1
        `,
        [postId]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async removePostLike(postId: string, userId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // Remove like record
      await client.query(
        `
        DELETE FROM post_likes 
        WHERE post_id = $1 AND user_id = $2
        `,
        [postId, userId]
      );

      // Update like count
      await client.query(
        `
        UPDATE game_posts 
        SET likes = (
          SELECT COUNT(*) FROM post_likes WHERE post_id = $1
        )
        WHERE id = $1
        `,
        [postId]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // User search
  async searchUsers(query: string, limit: number): Promise<any[]> {
    const result = await this.pool.query(
      `
      SELECT 
        u.id as user_id,
        u.username,
        COALESCE(s.games_played, 0) as games_played,
        CASE 
          WHEN COALESCE(s.games_played, 0) > 0 
          THEN ROUND((COALESCE(s.games_won, 0)::DECIMAL / s.games_played) * 100, 1) 
          ELSE 0 
        END as win_rate
      FROM user_schema.users u
      LEFT JOIN user_stats s ON u.id = s.user_id
      WHERE u.username ILIKE $1 AND u.is_active = true
      ORDER BY s.games_played DESC, u.username ASC
      LIMIT $2
      `,
      [`%${query}%`, limit]
    );

    return result.rows;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    const result = await this.pool.query("SELECT NOW() as timestamp");
    return {
      status: "healthy",
      timestamp: result.rows[0].timestamp,
    };
  }

  // Cleanup
  async close(): Promise<void> {
    await this.pool.end();
  }
}
