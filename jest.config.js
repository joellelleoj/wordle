module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: [
    "**/tests/**/*.test.+(ts|tsx|js)",
    "**/*.(test|spec).+(ts|tsx|js)",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/coverage/",
    "setup.ts",
  ],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/__tests__/**",
    "!src/tests/**",
    "!src/index.ts", // Main entry point - typically not unit tested
    "!src/swagger/**", // Swagger configuration - documentation only
    "!src/test/**", // Test utilities/database connection tests
    "!src/middleware/authMiddleware.ts", // Will be integration tested separately
    "!src/routes/authRoutes.ts", // Route definitions - tested through controller tests
    "!src/database/connection.ts", // Route definitions - tested through controller tests
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 65,
      statements: 65,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/src/tests/setup.ts"],
  testTimeout: 30000,
  verbose: false, // Reduce output noise
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Performance optimizations
  maxWorkers: "50%",
  cache: true,
  // Error handling
  bail: false, // Don't stop on first failure
  forceExit: true,
  detectOpenHandles: true,
  // Silent mode to reduce console noise
  silent: false,
  // Mock modules globally
  moduleNameMapping: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Global mocks
  globals: {
    "ts-jest": {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
};
