import "@testing-library/jest-dom";

// Mock environment variables for tests
process.env.VITE_API_BASE_URL = "http://localhost:3000";
process.env.VITE_ENVIRONMENT = "test";

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

// Mock sessionStorage
global.sessionStorage = localStorageMock as any;

// Mock navigator.vibrate
Object.defineProperty(navigator, "vibrate", {
  writable: true,
  value: jest.fn(),
});

// Mock navigator.share
Object.defineProperty(navigator, "share", {
  writable: true,
  value: jest.fn(),
});

// Mock navigator.clipboard
Object.defineProperty(navigator, "clipboard", {
  writable: true,
  value: {
    writeText: jest.fn(),
  },
});

// Mock window.matchMedia
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

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
