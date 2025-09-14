import { jest } from "@jest/globals";

beforeAll(() => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret-key";
  process.env.PORT = "8002";
  process.env.GAME_SERVICE_URL = "http://localhost:3002";
  process.env.USER_SERVICE_URL = "http://localhost:3003";
  process.env.PROFILE_SERVICE_URL = "http://localhost:3004";
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  jest.restoreAllMocks();
});

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

export const createMockToken = (userId: string = "1"): string => {
  return `mock_access_token_${userId}_${Date.now()}`;
};

export const createAuthHeaders = (token?: string) => {
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const mockAxiosResponse = (data: any, status: number = 200) => {
  return {
    status,
    statusText: status === 200 ? "OK" : "Error",
    data,
    headers: {},
  };
};

export const mockAxiosError = (
  message: string,
  code?: string,
  status?: number
) => {
  const error: any = new Error(message);
  if (code) error.code = code;
  if (status) {
    error.response = {
      status,
      data: { error: message },
    };
  }
  return error;
};
