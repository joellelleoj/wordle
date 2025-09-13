/**
 * Test Setup Configuration
 *
 * Global test setup file that runs before all tests.
 * Configures testing utilities, mocks, and global test environment.
 * Required for Web Engineering course compliance.
 */

import "@testing-library/jest-dom";

// Extend Jest matchers with React Testing Library assertions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveClass(className: string): R;
      toHaveAttribute(attr: string, value?: string): R;
      toHaveTextContent(text: string | RegExp): R;
      toBeDisabled(): R;
      toBeVisible(): R;
      toHaveFocus(): R;
    }
  }
}

// Mock localStorage for browser API testing
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: { [key: string]: string } = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
})();

Object.defineProperty(window, "sessionStorage", {
  value: sessionStorageMock,
});

// Mock window.matchMedia for responsive design testing
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver for component visibility testing
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver for responsive component testing
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));
global.cancelAnimationFrame = jest.fn();

// Mock scroll methods
Element.prototype.scrollIntoView = jest.fn();
window.scrollTo = jest.fn();

// Mock console methods to reduce test noise while preserving errors
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  // Suppress React warnings in tests unless they're critical
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render is no longer supported") ||
        args[0].includes("Warning: validateDOMNesting") ||
        args[0].includes("Warning: componentWillReceiveProps"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Warning: React.jsx: type is invalid")
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Global test utilities and helpers
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();

  // Reset localStorage and sessionStorage
  localStorageMock.clear();
  sessionStorageMock.clear();

  // Reset document body styles (important for modal testing)
  document.body.style.overflow = "unset";

  // Clear any remaining timers
  jest.clearAllTimers();
});

afterEach(() => {
  // Clean up DOM after each test
  document.body.innerHTML = "";

  // Reset body styles
  document.body.style.overflow = "unset";
});

// Custom testing utilities
export const createMockProps = <T>(overrides: Partial<T> = {}): T => {
  return { ...overrides } as T;
};

// Helper for testing async components
export const waitForNextTick = () =>
  new Promise((resolve) => process.nextTick(resolve));

// Helper for testing animations
export const advanceTimersByTime = (ms: number) => {
  if (jest.isMockFunction(setTimeout)) {
    jest.advanceTimersByTime(ms);
  }
};

// Mock fetch for API testing (when needed)
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
  })
) as jest.Mock;

// Configuration for React Testing Library
import { configure } from "@testing-library/react";

configure({
  // Timeout for async operations
  asyncUtilTimeout: 5000,

  // Custom test ID attribute
  testIdAttribute: "data-testid",

  // Show suggestions for better queries
  showOriginalStackTrace: true,
});

// Jest environment information
console.log("🧪 Test environment configured successfully");
console.log("📦 React Testing Library configured");
console.log("🎯 Jest matchers extended");
console.log("🔧 Browser APIs mocked");

export {};
