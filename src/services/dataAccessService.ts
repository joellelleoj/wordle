// src/services/dataAccessService.ts

import db from "../database/connection";
import {
  User,
  CreateUserData,
  UpdateUserData,
  RefreshToken,
  OAuthState,
} from "../types/user.types";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";

export class DataAccessService {
  // User CRUD operations

  async createUser(userData: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO users (
        email, username, display_name, avatar_url, 
        oauth_provider, oauth_id, password_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      userData.email,
      userData.username,
      userData.display_name,
      userData.avatar_url,
      userData.oauth_provider,
      userData.oauth_id,
      userData.password_hash,
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  async getUserById(id: string): Promise<User | null> {
    const query = "SELECT * FROM users WHERE id = $1 AND is_active = true";
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const query = "SELECT * FROM users WHERE email = $1 AND is_active = true";
    const result = await db.query(query, [email]);
    return result.rows[0] || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const query =
      "SELECT * FROM users WHERE username = $1 AND is_active = true";
    const result = await db.query(query, [username]);
    return result.rows[0] || null;
  }

  async getUserByOAuthId(
    oauthId: string,
    provider: string
  ): Promise<User | null> {
    const query =
      "SELECT * FROM users WHERE oauth_id = $1 AND oauth_provider = $2 AND is_active = true";
    const result = await db.query(query, [oauthId, provider]);
    return result.rows[0] || null;
  }

  async updateUser(
    id: string,
    updateData: UpdateUserData
  ): Promise<User | null> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      return this.getUserById(id);
    }

    const query = `
      UPDATE users 
      SET ${setClause.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex} AND is_active = true
      RETURNING *
    `;

    values.push(id);
    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  async updateLastLogin(id: string): Promise<void> {
    const query =
      "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1";
    await db.query(query, [id]);
  }

  async deactivateUser(id: string): Promise<void> {
    const query = "UPDATE users SET is_active = false WHERE id = $1";
    await db.query(query, [id]);
  }

  // Refresh Token operations

  async createRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<RefreshToken> {
    const query = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await db.query(query, [userId, tokenHash, expiresAt]);
    return result.rows[0];
  }

  async getRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    const query = `
      SELECT * FROM refresh_tokens 
      WHERE token_hash = $1 AND is_revoked = false AND expires_at > CURRENT_TIMESTAMP
    `;

    const result = await db.query(query, [tokenHash]);
    return result.rows[0] || null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    const query =
      "UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1";
    await db.query(query, [tokenHash]);
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    const query =
      "UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1";
    await db.query(query, [userId]);
  }

  async cleanupExpiredRefreshTokens(): Promise<void> {
    const query =
      "DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP";
    await db.query(query);
  }

  // OAuth State operations

  async createOAuthState(
    stateToken: string,
    userSession?: string
  ): Promise<OAuthState> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const query = `
      INSERT INTO oauth_states (state_token, user_session, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await db.query(query, [stateToken, userSession, expiresAt]);
    return result.rows[0];
  }

  async validateAndDeleteOAuthState(
    stateToken: string
  ): Promise<OAuthState | null> {
    const query = `
      DELETE FROM oauth_states 
      WHERE state_token = $1 AND expires_at > CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await db.query(query, [stateToken]);
    return result.rows[0] || null;
  }

  async cleanupExpiredOAuthStates(): Promise<void> {
    const query =
      "DELETE FROM oauth_states WHERE expires_at < CURRENT_TIMESTAMP";
    await db.query(query);
  }

  // User search and stats (for profile service integration)

  async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    const searchQuery = `
      SELECT id, username, display_name, avatar_url, created_at
      FROM users 
      WHERE is_active = true 
        AND (
          username ILIKE $1 OR 
          display_name ILIKE $1 OR 
          email ILIKE $1
        )
      ORDER BY username ASC
      LIMIT $2
    `;

    const result = await db.query(searchQuery, [`%${query}%`, limit]);
    return result.rows;
  }

  async getUserStats(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE last_login_at > CURRENT_TIMESTAMP - INTERVAL '30 days') as active_users,
        COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days') as new_users_week
      FROM users 
      WHERE is_active = true
    `;

    const result = await db.query(query);
    return result.rows[0];
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await db.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
}

export default DataAccessService;

/*import { Pool } from "pg";

interface UserData {
  email: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
  lastLogin: Date;
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
}

interface GameRecordData {
  userId: string;
  gameId: string;
  targetWord: string;
  guesses: string[];
  won: boolean;
  attempts: number;
  completedAt: Date;
}

export class DataAccessService {
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
  }

  // User operations
  async createUser(userData: UserData): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const userResult = await client.query(
        `
        INSERT INTO users (email, username, password_hash, created_at, last_login)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, username, created_at, last_login
      `,
        [
          userData.email,
          userData.username,
          userData.passwordHash,
          userData.createdAt,
          userData.lastLogin,
        ]
      );

      const userId = userResult.rows[0].id;

      // Initialize user stats
      await client.query(
        `
        INSERT INTO user_stats (user_id, games_played, games_won, current_streak, max_streak)
        VALUES ($1, 0, 0, 0, 0)
      `,
        [userId]
      );

      await client.query("COMMIT");

      return {
        ...userResult.rows[0],
        gamesPlayed: 0,
        gamesWon: 0,
        currentStreak: 0,
        maxStreak: 0,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findUserByEmailOrUsername(
    email: string,
    username: string
  ): Promise<any | null> {
    const result = await this.pool.query(
      `
      SELECT u.id, u.email, u.username, u.created_at, u.last_login,
             s.games_played, s.games_won, s.current_streak, s.max_streak
      FROM users u
      LEFT JOIN user_stats s ON u.id = s.user_id
      WHERE u.email = $1 OR u.username = $2
    `,
      [email, username]
    );

    return result.rows[0] || null;
  }

  async findUserByEmailWithPassword(email: string): Promise<any | null> {
    const result = await this.pool.query(
      `
      SELECT u.*, s.games_played, s.games_won, s.current_streak, s.max_streak
      FROM users u
      LEFT JOIN user_stats s ON u.id = s.user_id
      WHERE u.email = $1
    `,
      [email]
    );

    return result.rows[0] || null;
  }

  async findUserById(userId: string): Promise<any | null> {
    const result = await this.pool.query(
      `
      SELECT u.id, u.email, u.username, u.created_at, u.last_login,
             s.games_played, s.games_won, s.current_streak, s.max_streak
      FROM users u
      LEFT JOIN user_stats s ON u.id = s.user_id
      WHERE u.id = $1
    `,
      [userId]
    );

    return result.rows[0] || null;
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE users 
      SET last_login = NOW()
      WHERE id = $1
    `,
      [userId]
    );
  }

  async updateUserStats(
    userId: string,
    updates: {
      gamesPlayed: number;
      gamesWon: number;
      currentStreak: number;
      maxStreak: number;
    }
  ): Promise<void> {
    await this.pool.query(
      `
      UPDATE user_stats 
      SET games_played = $2, games_won = $3, current_streak = $4, max_streak = $5, updated_at = NOW()
      WHERE user_id = $1
    `,
      [
        userId,
        updates.gamesPlayed,
        updates.gamesWon,
        updates.currentStreak,
        updates.maxStreak,
      ]
    );
  }

  // Game record operations
  async createGameRecord(gameData: GameRecordData): Promise<any> {
    const result = await this.pool.query(
      `
      INSERT INTO game_records (user_id, game_id, target_word, guesses, won, attempts, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [
        gameData.userId,
        gameData.gameId,
        gameData.targetWord,
        JSON.stringify(gameData.guesses),
        gameData.won,
        gameData.attempts,
        gameData.completedAt,
      ]
    );

    return result.rows[0];
  }

  async getUserGameRecords(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    const result = await this.pool.query(
      `
      SELECT * FROM game_records
      WHERE user_id = $1
      ORDER BY completed_at DESC
      LIMIT $2 OFFSET $3
    `,
      [userId, limit, offset]
    );

    return result.rows.map((row) => ({
      ...row,
      guesses: JSON.parse(row.guesses),
    }));
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    const result = await this.pool.query("SELECT NOW() as timestamp");
    return {
      status: "healthy",
      timestamp: result.rows[0].timestamp,
    };
  }

  // Cleanup method
  async close(): Promise<void> {
    await this.pool.end();
  }
}
*/
