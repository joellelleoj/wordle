import { Pool, PoolClient } from "pg";

export class SharedDatabaseConnection {
  private static pool: Pool;

  static initialize(): Pool {
    if (!this.pool) {
      this.pool = new Pool({
        connectionString:
          process.env.DATABASE_URL ||
          "postgresql://wordle_user:secure_password@localhost:5433/wordle_users",
        ssl:
          process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Set search path to access both schemas
      this.pool.on("connect", (client) => {
        client.query("SET search_path TO profile_schema, public");
      });

      this.pool.on("error", (err) => {
        console.error("Database pool error:", err);
      });

      console.log("✅ Shared database connection initialized");
    }

    return this.pool;
  }

  static getPool(): Pool {
    if (!this.pool) {
      return this.initialize();
    }
    return this.pool;
  }

  static async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      console.log("Database connection closed");
    }
  }

  static async healthCheck(): Promise<boolean> {
    try {
      const pool = this.getPool();
      const result = await pool.query("SELECT 1 as health");
      return result.rows.length > 0;
    } catch (error) {
      console.error("Database health check failed:", error);
      return false;
    }
  }
}
