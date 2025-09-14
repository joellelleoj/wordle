module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/tests/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  collectCoverageFrom: [
    "src/index.ts",
    "src/middleware/**",
    "!src/**/*.d.ts",
    "!src/tests/**",
    "!src/routes/**",
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
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
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
