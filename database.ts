import { Pool } from "pg";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export class DatabaseSetup {
  private pool: Pool;

  constructor() {
    const connectionString = this.getConnectionString();

    this.pool = new Pool({
      connectionString,
      ssl: this.getSSLConfig(),
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  private getConnectionString(): string {
    if (process.env.DATABASE_URL) {
      return process.env.DATABASE_URL;
    }

    const host = process.env.DB_HOST || "localhost";
    const port = process.env.DB_PORT || "5432";
    const database = process.env.DB_NAME || "wordle_users";
    const username = process.env.DB_USER || "wordle_user";
    const password = process.env.DB_PASSWORD || "secure_password";

    return `postgresql://${username}:${password}@${host}:${port}/${database}`;
  }

  private getSSLConfig() {
    const nodeEnv = process.env.NODE_ENV;

    if (nodeEnv === "production") {
      return { rejectUnauthorized: false };
    }

    if (process.env.DB_SSL === "true") {
      return { rejectUnauthorized: false };
    }

    return false;
  }

  public async setupDatabase(): Promise<void> {
    console.log("Starting database setup...");
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

    try {
      await this.testConnection();
      await this.executeSetupScript();
      console.log("Database setup completed successfully");
    } catch (error) {
      console.error("Database setup failed:", error);
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const result = await this.pool.query(
        "SELECT NOW() as timestamp, version() as version"
      );
      console.log("Database connection successful");
      console.log(`   Timestamp: ${result.rows[0].timestamp}`);
      console.log(`   PostgreSQL: ${result.rows[0].version.split(",")[0]}`);
    } catch (error) {
      console.error("Database connection failed:", error);
      throw error;
    }
  }

  private async executeSetupScript(): Promise<void> {
    console.log(" Executing database setup script...");

    const possiblePaths = [
      join(__dirname, "init", "setup.sql"),
      "/app/init/setup.sql",
    ];

    let scriptPath: string | null = null;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        scriptPath = path;
        break;
      }
    }

    if (!scriptPath) {
      console.error("Setup script not found. Searched paths:");
      possiblePaths.forEach((path) => console.error(`   - ${path}`));
      throw new Error("Setup script not found");
    }

    console.log(` Using SQL script: ${scriptPath}`);

    try {
      const sqlContent = readFileSync(scriptPath, "utf8");

      // Execute in a transaction for safety
      await this.pool.query("BEGIN");
      await this.pool.query(sqlContent);
      await this.pool.query("COMMIT");

      console.log(" Setup script executed successfully");
    } catch (error) {
      await this.pool.query("ROLLBACK");
      console.error(" Error executing setup script:", error);
      throw error;
    }
  }

  public async verifySetup(): Promise<void> {
    console.log(" Verifying database setup...");

    try {
      // Check schemas
      const schemaCheck = await this.pool.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name IN ('user_schema', 'profile_schema')
        ORDER BY schema_name
      `);

      const foundSchemas = schemaCheck.rows.map((r) => r.schema_name);
      console.log(" Schemas found:", foundSchemas);

      if (foundSchemas.length !== 2) {
        throw new Error(`Expected 2 schemas, found ${foundSchemas.length}`);
      }

      // Check tables
      const tableCheck = await this.pool.query(`
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_schema IN ('user_schema', 'profile_schema')
        ORDER BY table_schema, table_name
      `);

      console.log(" Tables found:");
      tableCheck.rows.forEach((row) => {
        console.log(`   - ${row.table_schema}.${row.table_name}`);
      });

      // Verify essential tables exist
      const expectedTables = [
        "user_schema.users",
        "user_schema.user_sessions",
        "profile_schema.game_records",
        "profile_schema.game_albums",
      ];

      const foundTables = tableCheck.rows.map(
        (row) => `${row.table_schema}.${row.table_name}`
      );
      const missingTables = expectedTables.filter(
        (table) => !foundTables.includes(table)
      );

      if (missingTables.length > 0) {
        throw new Error(
          `Missing essential tables: ${missingTables.join(", ")}`
        );
      }

      // Check data counts
      const userCount = await this.pool.query(
        "SELECT COUNT(*) FROM user_schema.users"
      );
      const gameCount = await this.pool.query(
        "SELECT COUNT(*) FROM profile_schema.game_records"
      );

      console.log(" Data verification:");
      console.log(`   - Users: ${userCount.rows[0].count}`);
      console.log(`   - Game records: ${gameCount.rows[0].count}`);

      console.log(" Database verification completed");
    } catch (error) {
      console.error(" Database verification failed:", error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    console.log(" Database connection closed");
  }
}

// Main execution function
async function main() {
  const setup = new DatabaseSetup();

  try {
    await setup.setupDatabase();
    await setup.verifySetup();
  } catch (error) {
    console.error("\n Setup failed:", error);
    process.exit(1);
  } finally {
    await setup.close();
  }
}

// Auto-run when executed directly
if (require.main === module) {
  main();
}

export { main as setupDatabase };
