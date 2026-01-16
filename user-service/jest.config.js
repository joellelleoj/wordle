module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
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
    "!src/index.ts",
    "!src/swagger/**",
    "!src/test/**",
    "!src/middleware/authMiddleware.ts",
    "!src/routes/authRoutes.ts",
    "!src/database/connection.ts",
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
  verbose: false,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  maxWorkers: "50%",
  cache: true,
  bail: false,
  forceExit: true,
  detectOpenHandles: true,
  silent: false,
  moduleNameMapper: {
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
