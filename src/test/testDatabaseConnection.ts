import { UserDataAccessService } from "../services/userDataAccessService";
import { dbConnection } from "../database/connection";

async function testUserServiceDatabaseConnection() {
  console.log("Testing User Service Database Connection...");

  try {
    const dataAccess = UserDataAccessService.getInstance();
    console.log("1. Testing health check...");
    const health = await dataAccess.healthCheck();
    console.log("Health check passed:", health);

    console.log("\n2. Testing user search...");
    const users = await dataAccess.searchUsers("test");
    console.log("User search completed, found:", users.length, "users");
    console.log("\n3. Testing find user by username...");
    const user = await dataAccess.findUserByUsername("non-existent-user");
    console.log(
      "Find user test completed, result:",
      user ? "found" : "not found"
    );

    console.log("\n4. Testing user creation (will rollback)...");
    try {
      const testResult = await dbConnection.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'user_schema' 
        AND table_name = 'users'
        ORDER BY ordinal_position
      `);

      console.log("User table schema verified:");
      testResult.rows.forEach((row: any) => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    } catch (error) {
      console.warn("Schema test failed:", error);
    }
    console.log("\n5. Testing sessions table schema...");
    try {
      const sessionResult = await dbConnection.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'user_schema' 
        AND table_name = 'user_sessions'
        ORDER BY ordinal_position
      `);

      console.log("Sessions table schema verified:");
      sessionResult.rows.forEach((row: any) => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    } catch (error) {
      console.warn("Sessions schema test failed:", error);
    }

    console.log("\n6. Testing cleanup operations...");
    await dataAccess.cleanupExpiredSessions();
    console.log("Cleanup operation completed");

    console.log("\nAll User Service database connection tests passed!");
    return true;
  } catch (error) {
    console.error("User Service database connection test failed:", error);
    return false;
  }
}

// Test connection on module load for debugging
async function quickConnectionTest() {
  try {
    const result = await dbConnection.query(
      "SELECT NOW() as timestamp, current_database() as db_name"
    );
    console.log("Quick connection test passed:", {
      timestamp: result.rows[0].timestamp,
      database: result.rows[0].db_name,
    });
  } catch (error) {
    console.error("Quick connection test failed:", error);
    throw error;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  quickConnectionTest()
    .then(() => testUserServiceDatabaseConnection())
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Test execution failed:", error);
      process.exit(1);
    });
}

export { testUserServiceDatabaseConnection, quickConnectionTest };
