import { Pool } from "pg";

class DatabaseConnection {
  private pool: Pool;
  private static instance: DatabaseConnection;

  private constructor() {
    // Use localhost for local development, postgres hostname for Docker
    const isDocker = process.env.DOCKER_ENV === "true";
    const defaultConnectionString = isDocker
      ? "postgresql://wordle_user:secure_password@postgres:5432/wordle_users"
      : "postgresql://wordle_user:secure_password@localhost:5433/wordle_users";

    const connectionString =
      process.env.DATABASE_URL || defaultConnectionString;

    console.log(
      `Connecting to database: ${connectionString.replace(
        /:[^:@]*@/,
        ":****@"
      )}`
    );

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

    // Set schema search path for user service
    this.pool.on("connect", (client) => {
      client
        .query("SET search_path TO user_schema, public")
        .catch((err) => console.error("Failed to set search path:", err));
    });

    this.pool.on("error", (err) => {
      console.error("User service database error:", err);
    });

    console.log("User service database connection initialized");
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  public async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      const result = await this.query("SELECT NOW() as timestamp");
      return {
        status: "healthy",
        timestamp: result.rows[0].timestamp,
      };
    } catch (error) {
      console.error("Health check failed:", error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    console.log("User service database connection closed");
  }
}

// Export singleton instance
export const pool = DatabaseConnection.getInstance().getPool();
export const dbConnection = DatabaseConnection.getInstance();
export default DatabaseConnection;
