/**
 * Jest Configuration for Wordle Frontend
 *
 * This configuration follows the Web Engineering course requirements:
 * - Unit tests and snapshot tests for React components
 * - Coverage thresholds as per academic standards
 * - TypeScript support with proper module resolution
 * - React Testing Library integration
 */

/** @type {import('jest').Config} */
module.exports = {
  // Use jsdom environment for React component testing
  testEnvironment: "jsdom",

  // TypeScript transformation
  preset: "ts-jest",

  // Setup files for testing utilities
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],

  // Module name mapping for path aliases and CSS modules
  moduleNameMapping: {
    // CSS and asset files
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(jpg|jpeg|png|gif|svg)$": "<rootDir>/src/__mocks__/fileMock.js",

    // Path aliases matching tsconfig.json and vite.config.ts
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@components/(.*)$": "<rootDir>/src/components/$1",
    "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@services/(.*)$": "<rootDir>/src/services/$1",
    "^@types/(.*)$": "<rootDir>/src/types/$1",
    "^@styles/(.*)$": "<rootDir>/src/styles/$1",
  },

  // Test file patterns
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/src/**/*.(test|spec).{js,jsx,ts,tsx}",
  ],

  // Files to collect coverage from
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/main.tsx",
    "!src/vite-env.d.ts",
    "!src/setupTests.ts",
    "!src/__mocks__/**",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
  ],

  // Coverage thresholds (academic requirement)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Component-specific thresholds
    "src/components/game/": {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },

  // Coverage output formats
  coverageReporters: ["text", "html", "lcov", "json-summary"],

  // Coverage directory
  coverageDirectory: "coverage",

  // Transform configuration
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },

  // Module file extensions
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

  // Test timeout for async operations
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Enable verbose output for debugging
  verbose: true,

  // Ignore patterns
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/dist/",
    "<rootDir>/coverage/",
  ],

  // Global setup for tests
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
};
