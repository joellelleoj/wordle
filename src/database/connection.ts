// user-service/src/database/connection.ts
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
      `🔗 Connecting to database: ${connectionString.replace(
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

/*// src/database/connection.ts

import { Pool, PoolClient } from "pg";
import dotenv from "dotenv";

dotenv.config();

class DatabaseConnection {
  private pool: Pool;
  private static instance: DatabaseConnection;

  private constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5433"),
      database: process.env.DB_NAME || "wordle_users",
      user: process.env.DB_USER || "wordle_user",
      password: process.env.DB_PASSWORD || "secure_password",
      max: parseInt(process.env.DB_MAX_CONNECTIONS || "20"),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Handle pool errors
    this.pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err);
      process.exit(-1);
    });

    // Test connection
    this.testConnection();
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  private async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      console.log("✓ Database connected successfully");
      client.release();
    } catch (error) {
      console.error("✗ Database connection failed:", error);
      throw error;
    }
  }

  public async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      if (process.env.NODE_ENV === "development") {
        console.log("Executed query:", {
          text,
          duration,
          rows: result.rowCount,
        });
      }

      return result;
    } catch (error) {
      console.error("Database query error:", error);
      throw error;
    }
  }

  public async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    console.log("Database pool closed");
  }

  // Health check method
  public async isHealthy(): Promise<boolean> {
    try {
      await this.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  // Migration helper
  public async migrate(): Promise<void> {
    const fs = await import("fs/promises");
    const path = await import("path");

    try {
      const schemaPath = path.join(__dirname, "schema.sql");
      const schema = await fs.readFile(schemaPath, "utf8");

      // Split by semicolon and execute each statement
      const statements = schema
        .split(";")
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0);

      for (const statement of statements) {
        await this.query(statement);
      }

      console.log("✓ Database migration completed successfully");
    } catch (error) {
      console.error("✗ Database migration failed:", error);
      throw error;
    }
  }
}

export const db = DatabaseConnection.getInstance();
export default db;

*/
