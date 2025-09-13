import { Pool } from "pg";
import { ProfileDatabaseConnection } from "./connection";

export interface GameRecord {
  id: string;
  userId: string;
  gameId: string;
  targetWord: string;
  guesses: string[];
  won: boolean;
  attempts: number;
  completedAt: Date;
  createdAt: Date;
}

export interface GamePost {
  id: string;
  userId: string;
  gameRecordId: string;
  title: string;
  comment: string;
  isPublic: boolean;
  tags: string[];
  likes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameAlbum {
  id: string;
  userId: string;
  title: string;
  description: string;
  isPublic: boolean;
  postCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStats {
  userId: string;
  totalGames: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  averageAttempts: number;
  guessDistribution: { [attempts: string]: number };
  lastPlayedAt: Date | null;
}

export class ProfileDataAccess {
  private db: ProfileDatabaseConnection;

  constructor() {
    this.db = ProfileDatabaseConnection.getInstance();
  }

  // Game Records Operations (using profile_schema tables)
  async saveGameRecord(
    gameRecord: Omit<GameRecord, "id" | "createdAt">
  ): Promise<GameRecord> {
    const result = await this.db.query(
      `
        INSERT INTO game_records (user_id, game_id, target_word, guesses, won, attempts, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, game_id) 
        DO UPDATE SET 
          target_word = EXCLUDED.target_word,
          guesses = EXCLUDED.guesses,
          won = EXCLUDED.won,
          attempts = EXCLUDED.attempts,
          completed_at = EXCLUDED.completed_at
        RETURNING *
      `,
      [
        gameRecord.userId,
        gameRecord.gameId,
        gameRecord.targetWord,
        gameRecord.guesses,
        gameRecord.won,
        gameRecord.attempts,
        gameRecord.completedAt,
      ]
    );

    return this.mapGameRecord(result.rows[0]);
  }

  async getUserGameRecords(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<GameRecord[]> {
    const result = await this.db.query(
      `
      SELECT * FROM game_records 
      WHERE user_id = $1 
      ORDER BY completed_at DESC 
      LIMIT $2 OFFSET $3
    `,
      [userId, limit, offset]
    );

    return result.rows.map(this.mapGameRecord);
  }

  async getGameRecord(
    userId: string,
    gameId: string
  ): Promise<GameRecord | null> {
    const result = await this.db.query(
      `
      SELECT * FROM game_records 
      WHERE user_id = $1 AND game_id = $2
    `,
      [userId, gameId]
    );

    return result.rows.length > 0 ? this.mapGameRecord(result.rows[0]) : null;
  }

  // User Statistics Operations (calculated from profile_schema.game_records)
  async getUserStats(userId: string): Promise<UserStats> {
    // Get basic stats
    const statsResult = await this.db.query(
      `
      SELECT 
        COUNT(*) as total_games,
        COUNT(*) FILTER (WHERE won = true) as wins,
        AVG(attempts) FILTER (WHERE won = true) as avg_attempts,
        MAX(completed_at) as last_played_at
      FROM game_records 
      WHERE user_id = $1
    `,
      [userId]
    );

    const basicStats = statsResult.rows[0];
    const totalGames = parseInt(basicStats.total_games);
    const wins = parseInt(basicStats.wins);

    // Calculate guess distribution
    const distributionResult = await this.db.query(
      `
      SELECT attempts, COUNT(*) as count
      FROM game_records 
      WHERE user_id = $1 AND won = true
      GROUP BY attempts
      ORDER BY attempts
    `,
      [userId]
    );

    const guessDistribution: { [attempts: string]: number } = {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
      "6": 0,
    };

    distributionResult.rows.forEach((row: any) => {
      guessDistribution[row.attempts.toString()] = parseInt(row.count);
    });

    // Calculate streaks
    const { currentStreak, maxStreak } = await this.calculateStreaks(userId);

    return {
      userId,
      totalGames,
      wins,
      winRate: totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0,
      currentStreak,
      maxStreak,
      averageAttempts:
        wins > 0
          ? Math.round(parseFloat(basicStats.avg_attempts) * 10) / 10
          : 0,
      guessDistribution,
      lastPlayedAt: basicStats.last_played_at
        ? new Date(basicStats.last_played_at)
        : null,
    };
  }

  private async calculateStreaks(
    userId: string
  ): Promise<{ currentStreak: number; maxStreak: number }> {
    const result = await this.db.query(
      `
      SELECT won, completed_at
      FROM game_records 
      WHERE user_id = $1 
      ORDER BY completed_at DESC
    `,
      [userId]
    );

    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    result.rows.forEach((row: any, index: number) => {
      if (row.won) {
        tempStreak++;
        if (index === 0) currentStreak = tempStreak;
        maxStreak = Math.max(maxStreak, tempStreak);
      } else {
        if (index === 0) currentStreak = 0;
        tempStreak = 0;
      }
    });

    return { currentStreak, maxStreak };
  }

  // Post Operations (using profile_schema tables)
  async createPost(
    post: Omit<GamePost, "id" | "likes" | "createdAt" | "updatedAt">
  ): Promise<GamePost> {
    const result = await this.db.query(
      `
      INSERT INTO game_posts (user_id, game_record_id, title, comment, is_public, tags)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
      [
        post.userId,
        post.gameRecordId,
        post.title,
        post.comment,
        post.isPublic,
        post.tags,
      ]
    );

    return this.mapGamePost(result.rows[0]);
  }

  async getUserPosts(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<(GamePost & { gameRecord: GameRecord })[]> {
    const result = await this.db.query(
      `
      SELECT 
        p.*,
        gr.target_word,
        gr.guesses,
        gr.won,
        gr.attempts,
        gr.completed_at as game_completed_at
      FROM game_posts p
      JOIN game_records gr ON p.game_record_id = gr.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [userId, limit, offset]
    );

    return result.rows.map((row: any) => ({
      ...this.mapGamePost(row),
      gameRecord: {
        id: row.game_record_id,
        userId: row.user_id,
        gameId: "", // Not needed for this context
        targetWord: row.target_word,
        guesses: row.guesses,
        won: row.won,
        attempts: row.attempts,
        completedAt: new Date(row.game_completed_at),
        createdAt: new Date(row.game_completed_at),
      },
    }));
  }

  async getPublicPosts(
    limit = 20,
    offset = 0,
    tags?: string[]
  ): Promise<(GamePost & { username: string })[]> {
    // Get public posts and join with user info from user_schema
    let query = `
      SELECT p.*, u.username
      FROM game_posts p
      JOIN user_schema.users u ON p.user_id = u.id::text
      WHERE p.is_public = true
    `;
    const params: any[] = [];

    if (tags && tags.length > 0) {
      query += ` AND p.tags && $${params.length + 1}`;
      params.push(tags);
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${
      params.length + 2
    }`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return result.rows.map((row: any) => ({
      ...this.mapGamePost(row),
      username: row.username,
    }));
  }

  async updatePost(
    postId: string,
    userId: string,
    updates: Partial<Pick<GamePost, "title" | "comment" | "isPublic" | "tags">>
  ): Promise<GamePost | null> {
    const setParts: string[] = [];
    const values: any[] = [postId, userId];
    let paramIndex = 3;

    if (updates.title !== undefined) {
      setParts.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.comment !== undefined) {
      setParts.push(`comment = $${paramIndex++}`);
      values.push(updates.comment);
    }
    if (updates.isPublic !== undefined) {
      setParts.push(`is_public = $${paramIndex++}`);
      values.push(updates.isPublic);
    }
    if (updates.tags !== undefined) {
      setParts.push(`tags = $${paramIndex++}`);
      values.push(updates.tags);
    }

    if (setParts.length === 0) return null;

    setParts.push(`updated_at = NOW()`);

    const result = await this.db.query(
      `
      UPDATE game_posts 
      SET ${setParts.join(", ")}
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `,
      values
    );

    return result.rows.length > 0 ? this.mapGamePost(result.rows[0]) : null;
  }

  async deletePost(postId: string, userId: string): Promise<boolean> {
    const result = await this.db.query(
      `
      DELETE FROM game_posts 
      WHERE id = $1 AND user_id = $2
    `,
      [postId, userId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Album Operations
  async createAlbum(
    album: Omit<GameAlbum, "id" | "postCount" | "createdAt" | "updatedAt">
  ): Promise<GameAlbum> {
    const result = await this.db.query(
      `
      INSERT INTO game_albums (user_id, title, description, is_public)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
      [album.userId, album.title, album.description, album.isPublic]
    );

    return this.mapGameAlbum(result.rows[0]);
  }

  async getUserAlbums(userId: string): Promise<GameAlbum[]> {
    const result = await this.db.query(
      `
      SELECT 
        a.*,
        COUNT(ap.post_id) as post_count
      FROM game_albums a
      LEFT JOIN album_posts ap ON a.id = ap.album_id
      WHERE a.user_id = $1
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `,
      [userId]
    );

    return result.rows.map(this.mapGameAlbum);
  }

  async addPostToAlbum(
    albumId: string,
    postId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const result = await this.db.query(
        `
        INSERT INTO album_posts (album_id, post_id)
        SELECT $1, $2
        WHERE EXISTS (
          SELECT 1 FROM game_albums WHERE id = $1 AND user_id = $3
        ) AND EXISTS (
          SELECT 1 FROM game_posts WHERE id = $2 AND user_id = $3
        )
      `,
        [albumId, postId, userId]
      );

      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      return false;
    }
  }

  // Search operations
  async searchPublicPosts(
    query?: string,
    tags?: string[],
    limit = 20,
    offset = 0
  ): Promise<(GamePost & { username: string })[]> {
    let sql = `
      SELECT p.*, u.username
      FROM game_posts p
      JOIN user_schema.users u ON p.user_id = u.id::text
      WHERE p.is_public = true
    `;
    const params: any[] = [];

    if (query) {
      sql += ` AND (p.title ILIKE $${params.length + 1} OR p.comment ILIKE $${
        params.length + 1
      })`;
      params.push(`%${query}%`);
    }

    if (tags && tags.length > 0) {
      sql += ` AND p.tags && $${params.length + 1}`;
      params.push(tags);
    }

    sql += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${
      params.length + 2
    }`;
    params.push(limit, offset);

    const result = await this.db.query(sql, params);
    return result.rows.map((row: any) => ({
      ...this.mapGamePost(row),
      username: row.username,
    }));
  }

  async searchUsers(query: string, limit = 10): Promise<any[]> {
    const result = await this.db.query(
      `
      SELECT 
        u.id as user_id,
        u.username,
        COALESCE(COUNT(gr.id), 0) as games_played,
        CASE 
          WHEN COUNT(gr.id) > 0 
          THEN ROUND((COUNT(gr.id) FILTER (WHERE gr.won = true)::DECIMAL / COUNT(gr.id)) * 100, 1) 
          ELSE 0 
        END as win_rate
      FROM user_schema.users u
      LEFT JOIN game_records gr ON u.id::text = gr.user_id
      WHERE u.username ILIKE $1 AND u.is_active = true
      GROUP BY u.id, u.username
      ORDER BY games_played DESC, u.username ASC
      LIMIT $2
      `,
      [`%${query}%`, limit]
    );

    return result.rows;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    const result = await this.db.query("SELECT NOW() as timestamp");
    return {
      status: "healthy",
      timestamp: result.rows[0].timestamp,
    };
  }

  // Helper methods
  private mapGameRecord(row: any): GameRecord {
    return {
      id: row.id,
      userId: row.user_id,
      gameId: row.game_id,
      targetWord: row.target_word,
      guesses: row.guesses,
      won: row.won,
      attempts: row.attempts,
      completedAt: new Date(row.completed_at),
      createdAt: new Date(row.created_at),
    };
  }

  private mapGamePost(row: any): GamePost {
    return {
      id: row.id,
      userId: row.user_id,
      gameRecordId: row.game_record_id,
      title: row.title,
      comment: row.comment,
      isPublic: row.is_public,
      tags: row.tags || [],
      likes: row.likes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapGameAlbum(row: any): GameAlbum {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      isPublic: row.is_public,
      postCount: parseInt(row.post_count || "0"),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
