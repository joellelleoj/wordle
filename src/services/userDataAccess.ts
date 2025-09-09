import { pool } from "../database/connection";
import { User, CreateUserData, UserSession } from "../types/user";

export class UserDataAccessService {
  async findUserByUsername(username: string): Promise<User | null> {
    const query = "SELECT * FROM users WHERE username = $1";
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const query = "SELECT * FROM users WHERE email = $1";
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  }

  async findUserById(id: number): Promise<User | null> {
    const query = "SELECT * FROM users WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findUserByGitlabId(gitlabId: number): Promise<User | null> {
    const query = "SELECT * FROM users WHERE gitlab_id = $1";
    const result = await pool.query(query, [gitlabId]);
    return result.rows[0] || null;
  }

  async createUser(userData: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO users (username, email, password_hash, gitlab_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [
      userData.username,
      userData.email,
      userData.password_hash,
      userData.gitlab_id || null,
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error: any) {
      if (error.code === "23505") {
        // Unique constraint violation
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
      throw error;
    }
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    const query = `
      UPDATE users 
      SET ${fields.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    return result.rows[0];
  }

  async createUserSession(
    userId: number,
    refreshToken: string,
    expiresAt: Date
  ): Promise<UserSession> {
    const query = `
      INSERT INTO user_sessions (user_id, refresh_token, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(query, [userId, refreshToken, expiresAt]);
    return result.rows[0];
  }

  async findSessionByRefreshToken(
    refreshToken: string
  ): Promise<UserSession | null> {
    const query = `
      SELECT * FROM user_sessions 
      WHERE refresh_token = $1 AND expires_at > NOW()
    `;
    const result = await pool.query(query, [refreshToken]);
    return result.rows[0] || null;
  }

  async deleteUserSession(refreshToken: string): Promise<void> {
    const query = "DELETE FROM user_sessions WHERE refresh_token = $1";
    await pool.query(query, [refreshToken]);
  }

  async deleteAllUserSessions(userId: number): Promise<void> {
    const query = "DELETE FROM user_sessions WHERE user_id = $1";
    await pool.query(query, [userId]);
  }

  async cleanupExpiredSessions(): Promise<void> {
    const query = "DELETE FROM user_sessions WHERE expires_at < NOW()";
    await pool.query(query);
  }

  async getUserStats(userId: number): Promise<any> {
    // This is a placeholder for future profile service integration
    const query = `
      SELECT 
        u.username,
        u.email,
        u.created_at,
        (SELECT COUNT(*) FROM user_sessions WHERE user_id = u.id) as active_sessions
      FROM users u
      WHERE u.id = $1
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  }
}
/*import { pool } from "../database/connection";
import { User, CreateUserData, UserSession } from "../types/user";

export class UserDataAccessService {
  async createUser(userData: CreateUserData): Promise<User> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO users (username, email, password_hash, gitlab_id) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [
          userData.username,
          userData.email,
          userData.password_hash,
          userData.gitlab_id,
        ]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async findUserByUsername(username: string): Promise<User | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM users WHERE username = $1",
        [username]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async findUserById(id: number): Promise<User | null> {
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT * FROM users WHERE id = $1", [
        id,
      ]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async findUserByGitlabId(gitlabId: number): Promise<User | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM users WHERE gitlab_id = $1",
        [gitlabId]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async updateUser(
    id: number,
    userData: Partial<CreateUserData>
  ): Promise<User | null> {
    const client = await pool.connect();
    try {
      const setClause = [];
      const values = [];
      let paramCount = 1;

      if (userData.username) {
        setClause.push(`username = $${paramCount++}`);
        values.push(userData.username);
      }
      if (userData.email) {
        setClause.push(`email = $${paramCount++}`);
        values.push(userData.email);
      }
      if (userData.password_hash) {
        setClause.push(`password_hash = $${paramCount++}`);
        values.push(userData.password_hash);
      }
      if (userData.gitlab_id) {
        setClause.push(`gitlab_id = $${paramCount++}`);
        values.push(userData.gitlab_id);
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await client.query(
        `UPDATE users SET ${setClause.join(
          ", "
        )} WHERE id = $${paramCount} RETURNING *`,
        values
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async createUserSession(
    userId: number,
    refreshToken: string,
    expiresAt: Date
  ): Promise<UserSession> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO user_sessions (user_id, refresh_token, expires_at) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [userId, refreshToken, expiresAt]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async findSessionByRefreshToken(
    refreshToken: string
  ): Promise<UserSession | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM user_sessions WHERE refresh_token = $1 AND expires_at > NOW()",
        [refreshToken]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async deleteUserSession(refreshToken: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "DELETE FROM user_sessions WHERE refresh_token = $1",
        [refreshToken]
      );
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }
}
*/
