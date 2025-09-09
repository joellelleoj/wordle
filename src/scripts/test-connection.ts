// profile-service/src/scripts/test-connection.ts - Fixed for simplified data access
import { ProfileDataAccess } from "../data/ProfileDataAccess";

async function testDatabaseConnection() {
  console.log("🔧 Testing Profile Service Database Connection...");

  try {
    const dataAccess = ProfileDataAccess.getInstance();

    // Test basic health check
    console.log("1. Testing health check...");
    const health = await dataAccess.healthCheck();
    console.log("✅ Health check passed:", health);

    // Test user stats (should return empty stats for non-existent user)
    console.log("\n2. Testing user statistics...");
    const stats = await dataAccess.getUserStats("test-user-123");
    console.log("✅ User stats retrieved:", {
      totalGames: stats.totalGames,
      wins: stats.wins,
    });

    // Test user albums
    console.log("\n3. Testing user albums...");
    const albums = await dataAccess.getUserAlbums("test-user-123");
    console.log("✅ User albums retrieved:", albums.length, "albums");

    // Test game records
    console.log("\n4. Testing game records...");
    const games = await dataAccess.getUserGameRecords("test-user-123", 5);
    console.log("✅ Game records retrieved:", games.length, "games");

    console.log("\n🎉 All database connection tests passed!");

    return true;
  } catch (error) {
    console.error("❌ Database connection test failed:", error);
    return false;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testDatabaseConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Test execution failed:", error);
      process.exit(1);
    });
}

export { testDatabaseConnection };
