/**
 * Jest Test Setup
 * Configures test environment for Game Service
 */

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.WORD_CACHE_PATH = "./test-cache";

jest.setTimeout(30000);

jest.mock("axios");

afterEach(() => {
  jest.clearAllTimers();
});

afterAll(async () => {
  jest.clearAllTimers();
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (global.gc) {
    global.gc();
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.warn("Unhandled Promise Rejection in tests:", reason);
});

const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (args[0]?.includes && args[0].includes("Failed to")) {
      return;
    }
    originalError.apply(console, args);
  };
});

afterAll(() => {
  console.error = originalError;
});
