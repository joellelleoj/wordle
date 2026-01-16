import { Pool } from "pg";

export class ProfileDatabaseConnection {
  private pool: Pool;
  private static instance: ProfileDatabaseConnection;

  private constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      "postgresql://wordle_user:secure_password@localhost:5433/wordle_users";

    this.pool = new Pool({
      connectionString,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on("connect", (client) => {
      client
        .query("SET search_path TO profile_schema, user_schema, public")
        .catch((err) => console.error("Failed to set search path:", err));
    });

    this.pool.on("error", (err) => {
      console.error("Profile service database error:", err);
    });

    this.pool.on("connect", () => {
      console.log("🎮 Profile service connected to database");
    });
  }

  public static getInstance(): ProfileDatabaseConnection {
    if (!ProfileDatabaseConnection.instance) {
      ProfileDatabaseConnection.instance = new ProfileDatabaseConnection();
    }
    return ProfileDatabaseConnection.instance;
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async query(text: string, params?: any[]): Promise<any> {
    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      console.error("Profile service query error:", error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.query("SELECT 1 FROM game_records LIMIT 1");
      return true;
    } catch (error) {
      console.error("Profile service health check failed:", error);
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    console.log("Profile service database connection closed");
  }
}

export const profileDb = ProfileDatabaseConnection.getInstance();
