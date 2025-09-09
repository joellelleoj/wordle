// user-service/src/services/userDataAccessService.ts - Fixed database constraints
import { dbConnection } from "../database/connection";
import { CreateUserData, User, UserSession } from "../types/user";

export class UserDataAccessService {
  private static instance: UserDataAccessService;

  private constructor() {}

  public static getInstance(): UserDataAccessService {
    if (!UserDataAccessService.instance) {
      UserDataAccessService.instance = new UserDataAccessService();
    }
    return UserDataAccessService.instance;
  }

  async findUserByUsername(username: string): Promise<User | null> {
    try {
      const result = await dbConnection.query(
        "SELECT * FROM user_schema.users WHERE username = $1 AND is_active = true",
        [username]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding user by username:", error);
      throw new Error("Database error");
    }
  }

  async findUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await dbConnection.query(
        "SELECT * FROM user_schema.users WHERE email = $1 AND is_active = true",
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding user by email:", error);
      throw new Error("Database error");
    }
  }

  async findUserByGitlabId(gitlabId: number): Promise<User | null> {
    try {
      const result = await dbConnection.query(
        "SELECT * FROM user_schema.users WHERE gitlab_id = $1 AND is_active = true",
        [gitlabId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding user by GitLab ID:", error);
      throw new Error("Database error");
    }
  }

  async findUserById(id: number): Promise<User | null> {
    try {
      const result = await dbConnection.query(
        "SELECT * FROM user_schema.users WHERE id = $1 AND is_active = true",
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding user by ID:", error);
      throw new Error("Database error");
    }
  }

  async createUser(userData: CreateUserData): Promise<User> {
    try {
      // Let the database auto-generate the ID using SERIAL
      const result = await dbConnection.query(
        `INSERT INTO user_schema.users (username, email, password_hash, gitlab_id, display_name, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          userData.username,
          userData.email,
          userData.password_hash,
          userData.gitlab_id || null,
          userData.display_name || userData.username,
          userData.avatar_url || null,
        ]
      );

      const user = result.rows[0];
      console.log("✅ User created successfully:", user.id);
      return user;
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.code === "23505") {
        // Unique violation
        if (error.constraint?.includes("username")) {
          throw new Error("Username already exists");
        }
        if (error.constraint?.includes("email")) {
          throw new Error("Email already exists");
        }
        if (error.constraint?.includes("gitlab_id")) {
          throw new Error("GitLab account already linked");
        }
      }
      throw new Error("Failed to create user");
    }
  }

  async updateUser(
    id: number,
    updateData: Partial<User>
  ): Promise<User | null> {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (fields.length === 0) {
        throw new Error("No fields to update");
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await dbConnection.query(
        `UPDATE user_schema.users SET ${fields.join(", ")}
         WHERE id = $${paramCount} AND is_active = true
         RETURNING *`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error("Error updating user:", error);
      throw new Error("Failed to update user");
    }
  }

  async createUserSession(
    userId: number,
    refreshToken: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      await dbConnection.query(
        "INSERT INTO user_schema.user_sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, $3)",
        [userId, refreshToken, expiresAt]
      );
    } catch (error) {
      console.error("Error creating user session:", error);
      throw new Error("Failed to create session");
    }
  }

  async findSessionByRefreshToken(
    refreshToken: string
  ): Promise<UserSession | null> {
    try {
      const result = await dbConnection.query(
        "SELECT * FROM user_schema.user_sessions WHERE refresh_token = $1 AND expires_at > CURRENT_TIMESTAMP",
        [refreshToken]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding session:", error);
      throw new Error("Database error");
    }
  }

  async deleteUserSession(refreshToken: string): Promise<void> {
    try {
      await dbConnection.query(
        "DELETE FROM user_schema.user_sessions WHERE refresh_token = $1",
        [refreshToken]
      );
    } catch (error) {
      console.error("Error deleting session:", error);
      throw new Error("Failed to delete session");
    }
  }

  async deleteAllUserSessions(userId: number): Promise<void> {
    try {
      await dbConnection.query(
        "DELETE FROM user_schema.user_sessions WHERE user_id = $1",
        [userId]
      );
    } catch (error) {
      console.error("Error deleting all user sessions:", error);
      throw new Error("Failed to delete sessions");
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await dbConnection.query(
        "DELETE FROM user_schema.user_sessions WHERE expires_at < CURRENT_TIMESTAMP"
      );
      console.log(`🧹 Cleaned up ${result.rowCount} expired sessions`);
    } catch (error) {
      console.error("Error cleaning up expired sessions:", error);
    }
  }

  async getUserStats(userId: number): Promise<any> {
    try {
      const result = await dbConnection.query(
        `SELECT 
          u.username,
          u.email,
          u.created_at,
          (SELECT COUNT(*) FROM user_schema.user_sessions WHERE user_id = u.id) as active_sessions
        FROM user_schema.users u
        WHERE u.id = $1`,
        [userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error getting user stats:", error);
      throw new Error("Failed to get user stats");
    }
  }

  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      return await dbConnection.healthCheck();
    } catch (error) {
      console.error("Health check failed:", error);
      throw error;
    }
  }

  async searchUsers(query: string, limit = 10): Promise<any[]> {
    try {
      const result = await dbConnection.query(
        `SELECT 
          id as user_id,
          username,
          display_name,
          avatar_url,
          created_at
        FROM user_schema.users
        WHERE (username ILIKE $1 OR display_name ILIKE $1) AND is_active = true
        ORDER BY username ASC
        LIMIT $2`,
        [`%${query}%`, limit]
      );
      return result.rows;
    } catch (error) {
      console.error("Error searching users:", error);
      throw new Error("Failed to search users");
    }
  }
}

/*// user-service/src/services/userDataAccessService.ts
import { dbConnection } from "../database/connection";
import { CreateUserData, User, UserSession } from "../types/user";

export class UserDataAccessService {
  private static instance: UserDataAccessService;

  private constructor() {}

  public static getInstance(): UserDataAccessService {
    if (!UserDataAccessService.instance) {
      UserDataAccessService.instance = new UserDataAccessService();
    }
    return UserDataAccessService.instance;
  }

  async findUserByUsername(username: string): Promise<User | null> {
    try {
      const result = await dbConnection.query(
        "SELECT * FROM user_schema.users WHERE username = $1 AND is_active = true",
        [username]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding user by username:", error);
      throw new Error("Database error");
    }
  }

  async findUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await dbConnection.query(
        "SELECT * FROM user_schema.users WHERE email = $1 AND is_active = true",
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding user by email:", error);
      throw new Error("Database error");
    }
  }

  async findUserByGitlabId(gitlabId: number): Promise<User | null> {
    try {
      const result = await dbConnection.query(
        "SELECT * FROM user_schema.users WHERE gitlab_id = $1 AND is_active = true",
        [gitlabId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding user by GitLab ID:", error);
      throw new Error("Database error");
    }
  }

  async findUserById(id: number): Promise<User | null> {
    try {
      const result = await dbConnection.query(
        "SELECT * FROM user_schema.users WHERE id = $1 AND is_active = true",
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding user by ID:", error);
      throw new Error("Database error");
    }
  }

  async createUser(userData: CreateUserData): Promise<User> {
    try {
      const result = await dbConnection.query(
        `INSERT INTO user_schema.users (username, email, password_hash, gitlab_id, display_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          userData.username,
          userData.email,
          userData.password_hash,
          userData.gitlab_id || null,
          userData.display_name || userData.username,
        ]
      );

      const user = result.rows[0];
      console.log("✅ User created successfully:", user.id);
      return user;
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.code === "23505") {
        // Unique violation
        if (error.constraint?.includes("username")) {
          throw new Error("Username already exists");
        }
        if (error.constraint?.includes("email")) {
          throw new Error("Email already exists");
        }
      }
      throw new Error("Failed to create user");
    }
  }

  async updateUser(
    id: number,
    updateData: Partial<User>
  ): Promise<User | null> {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (fields.length === 0) {
        throw new Error("No fields to update");
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await dbConnection.query(
        `UPDATE user_schema.users SET ${fields.join(", ")}
         WHERE id = $${paramCount} AND is_active = true
         RETURNING *`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error("Error updating user:", error);
      throw new Error("Failed to update user");
    }
  }

  async createUserSession(
    userId: number,
    refreshToken: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      await dbConnection.query(
        "INSERT INTO user_schema.user_sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, $3)",
        [userId, refreshToken, expiresAt]
      );
    } catch (error) {
      console.error("Error creating user session:", error);
      throw new Error("Failed to create session");
    }
  }

  async findSessionByRefreshToken(
    refreshToken: string
  ): Promise<UserSession | null> {
    try {
      const result = await dbConnection.query(
        "SELECT * FROM user_schema.user_sessions WHERE refresh_token = $1 AND expires_at > CURRENT_TIMESTAMP",
        [refreshToken]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding session:", error);
      throw new Error("Database error");
    }
  }

  async deleteUserSession(refreshToken: string): Promise<void> {
    try {
      await dbConnection.query(
        "DELETE FROM user_schema.user_sessions WHERE refresh_token = $1",
        [refreshToken]
      );
    } catch (error) {
      console.error("Error deleting session:", error);
      throw new Error("Failed to delete session");
    }
  }

  async deleteAllUserSessions(userId: number): Promise<void> {
    try {
      await dbConnection.query(
        "DELETE FROM user_schema.user_sessions WHERE user_id = $1",
        [userId]
      );
    } catch (error) {
      console.error("Error deleting all user sessions:", error);
      throw new Error("Failed to delete sessions");
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await dbConnection.query(
        "DELETE FROM user_schema.user_sessions WHERE expires_at < CURRENT_TIMESTAMP"
      );
      console.log(`🧹 Cleaned up ${result.rowCount} expired sessions`);
    } catch (error) {
      console.error("Error cleaning up expired sessions:", error);
    }
  }

  async getUserStats(userId: number): Promise<any> {
    try {
      const result = await dbConnection.query(
        `SELECT 
          u.username,
          u.email,
          u.created_at,
          (SELECT COUNT(*) FROM user_schema.user_sessions WHERE user_id = u.id) as active_sessions
        FROM user_schema.users u
        WHERE u.id = $1`,
        [userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error getting user stats:", error);
      throw new Error("Failed to get user stats");
    }
  }

  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      return await dbConnection.healthCheck();
    } catch (error) {
      console.error("Health check failed:", error);
      throw error;
    }
  }

  async searchUsers(query: string, limit = 10): Promise<any[]> {
    try {
      const result = await dbConnection.query(
        `SELECT 
          id as user_id,
          username,
          display_name,
          avatar_url,
          created_at
        FROM user_schema.users
        WHERE (username ILIKE $1 OR display_name ILIKE $1) AND is_active = true
        ORDER BY username ASC
        LIMIT $2`,
        [`%${query}%`, limit]
      );
      return result.rows;
    } catch (error) {
      console.error("Error searching users:", error);
      throw new Error("Failed to search users");
    }
  }
}

/*import { pool } from "../database/connection";
import { CreateUserData, User, UserSession } from "../types/user";

export class UserDataAccessService {
  async findUserByUsername(username: string): Promise<User | null> {
    try {
      const result = await pool.query(
        "SELECT * FROM users WHERE username = $1 AND is_active = true",
        [username]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding user by username:", error);
      throw new Error("Database error");
    }
  }

  async findUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await pool.query(
        "SELECT * FROM users WHERE email = $1 AND is_active = true",
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding user by email:", error);
      throw new Error("Database error");
    }
  }

  async findUserByGitlabId(gitlabId: number): Promise<User | null> {
    try {
      const result = await pool.query(
        "SELECT * FROM users WHERE gitlab_id = $1 AND is_active = true",
        [gitlabId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding user by GitLab ID:", error);
      throw new Error("Database error");
    }
  }

  async findUserById(id: number): Promise<User | null> {
    try {
      const result = await pool.query(
        "SELECT * FROM users WHERE id = $1 AND is_active = true",
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding user by ID:", error);
      throw new Error("Database error");
    }
  }

  async createUser(userData: CreateUserData): Promise<User> {
    try {
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, gitlab_id, display_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          userData.username,
          userData.email,
          userData.password_hash,
          userData.gitlab_id || null,
          userData.display_name || userData.username,
        ]
      );

      const user = result.rows[0];

      // Initialize user stats
      await pool.query("INSERT INTO user_stats (user_id) VALUES ($1)", [
        user.id,
      ]);

      return user;
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.code === "23505") {
        // Unique violation
        if (error.constraint?.includes("username")) {
          throw new Error("Username already exists");
        }
        if (error.constraint?.includes("email")) {
          throw new Error("Email already exists");
        }
      }
      throw new Error("Failed to create user");
    }
  }

  async updateUser(
    id: number,
    updateData: Partial<User>
  ): Promise<User | null> {
    try {
      const setClause = Object.keys(updateData)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(", ");

      const values = [id, ...Object.values(updateData)];

      const result = await pool.query(
        `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND is_active = true
         RETURNING *`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error("Error updating user:", error);
      throw new Error("Failed to update user");
    }
  }

  async createUserSession(
    userId: number,
    refreshToken: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      await pool.query(
        "INSERT INTO user_sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, $3)",
        [userId, refreshToken, expiresAt]
      );
    } catch (error) {
      console.error("Error creating user session:", error);
      throw new Error("Failed to create session");
    }
  }

  async findSessionByRefreshToken(
    refreshToken: string
  ): Promise<UserSession | null> {
    try {
      const result = await pool.query(
        "SELECT * FROM user_sessions WHERE refresh_token = $1 AND expires_at > CURRENT_TIMESTAMP",
        [refreshToken]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error finding session:", error);
      throw new Error("Database error");
    }
  }

  async deleteUserSession(refreshToken: string): Promise<void> {
    try {
      await pool.query("DELETE FROM user_sessions WHERE refresh_token = $1", [
        refreshToken,
      ]);
    } catch (error) {
      console.error("Error deleting session:", error);
      throw new Error("Failed to delete session");
    }
  }

  async deleteAllUserSessions(userId: number): Promise<void> {
    try {
      await pool.query("DELETE FROM user_sessions WHERE user_id = $1", [
        userId,
      ]);
    } catch (error) {
      console.error("Error deleting all user sessions:", error);
      throw new Error("Failed to delete sessions");
    }
  }
}
*/
