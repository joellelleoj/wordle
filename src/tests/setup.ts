/**
 * Jest Test Setup
 * Configures test environment for User Service
 */

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret";
process.env.GITLAB_CLIENT_ID = "test-client-id";
process.env.GITLAB_CLIENT_SECRET = "test-client-secret";
process.env.GITLAB_REDIRECT_URI = "http://localhost:3003/api/v1/auth/callback";
process.env.DATABASE_URL =
  "postgresql://test_user:test_password@localhost:5433/test_db";
process.env.CLIENT_URL = "http://localhost:3000";

jest.setTimeout(30000);

// Suppress console output during tests except for actual test failures
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

beforeAll(() => {
  // Only suppress expected service logs, not test assertion failures
  console.error = jest.fn((message, ...args) => {
    // Allow Jest assertion errors to show
    if (
      typeof message === "string" &&
      (message.includes("expect(") ||
        message.includes("Expected") ||
        message.includes("Received") ||
        message.includes("at Object."))
    ) {
      originalError(message, ...args);
      return;
    }

    // Suppress expected database/service initialization errors
    if (
      typeof message === "string" &&
      (message.includes("Error finding user") ||
        message.includes("Error creating user") ||
        message.includes("Error updating user") ||
        message.includes("Error deleting") ||
        message.includes("Error cleaning up") ||
        message.includes("Error getting user stats") ||
        message.includes("Error searching users") ||
        message.includes("Error finding session") ||
        message.includes("Health check failed") ||
        message.includes("Connecting to database") ||
        message.includes("database connection"))
    ) {
      return; // Suppress these specific errors
    }

    // Show all other errors
    originalError(message, ...args);
  });

  console.warn = jest.fn();
  console.log = jest.fn(); // Suppress all console.log during tests
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
});

afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});

afterAll(async () => {
  jest.clearAllTimers();
  jest.restoreAllMocks();

  // Force close any hanging connections
  if (global.gc) {
    global.gc();
  }

  // Give time for cleanup
  await new Promise((resolve) => setTimeout(resolve, 200));
});

// Global error handling for unhandled promises
process.on("unhandledRejection", (reason, promise) => {
  if (process.env.NODE_ENV !== "test") {
    console.warn("Unhandled Promise Rejection in tests:", reason);
  }
});
