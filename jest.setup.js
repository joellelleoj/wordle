// jest.setup.js
// Mock axios to prevent real HTTP calls during tests
jest.mock("axios", () => ({
  get: jest.fn(() =>
    Promise.resolve({
      data: "ABOUT\nABOVE\nABUSE\nACTOR\nACUTE\nADMIT\nHELLO\nWORLD\nGAMES",
      status: 200,
    })
  ),
  post: jest.fn(() =>
    Promise.resolve({
      data: { success: true },
      status: 200,
    })
  ),
}));

// Mock file system operations for tests
jest.mock("fs/promises", () => ({
  mkdir: jest.fn(() => Promise.resolve()),
  readFile: jest.fn(() => Promise.reject(new Error("File not found"))),
  writeFile: jest.fn(() => Promise.resolve()),
  rm: jest.fn(() => Promise.resolve()),
  stat: jest.fn(() => Promise.resolve({ isDirectory: () => true })),
}));

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "test-secret";
