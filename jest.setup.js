const mockedAxios = {
  get: jest.fn(() =>
    Promise.resolve({
      data: "ABOUT\nABOVE\nABUSE\nACTOR\nACUTE\nADMIT\nHELLO\nWORLD\nGAMES\nCACHE\nTESTS\nWORDS\nQUEEN\nSPEED\nERASE\nALLOW\nFINAL\nQUICK",
      status: 200,
      statusText: "OK",
    })
  ),
  post: jest.fn(() =>
    Promise.resolve({
      data: { success: true },
      status: 200,
      statusText: "OK",
    })
  ),
};

jest.mock("axios", () => ({
  __esModule: true,
  default: mockedAxios,
  ...mockedAxios,
}));

const mockFs = {
  mkdir: jest.fn(() => Promise.resolve()),
  readFile: jest.fn((path) => {
    if (path.includes("words.json")) {
      return Promise.resolve(
        '{"words":["HELLO","WORLD","ABOUT","CACHE","TESTS"],"timestamp":"2023-01-01T00:00:00.000Z","version":"1.0"}'
      );
    }
    return Promise.reject(new Error("File not found"));
  }),
  writeFile: jest.fn(() => Promise.resolve()),
  rm: jest.fn(() => Promise.resolve()),
  stat: jest.fn(() => Promise.resolve({ isDirectory: () => true })),
};

jest.mock("fs/promises", () => mockFs);

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "test-secret";
process.env.WORD_CACHE_PATH = "./test-cache";

beforeAll(() => {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (
      args[0] &&
      args[0].includes &&
      (args[0].includes("GitHub initialization failed") ||
        args[0].includes("Cache initialization failed"))
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

module.exports = { mockedAxios, mockFs };
