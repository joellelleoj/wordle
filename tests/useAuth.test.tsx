import { authService } from "../src/services/auth";

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

/**
 * Test Suite for Authentication Service
 * Validates API communication and token management
 */
describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test("registers user successfully", async () => {
    const mockResponse = {
      success: true,
      user: { id: "1", username: "test", email: "test@test.com" },
      token: "fake-token",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    } as any);

    const result = await authService.register(
      "test@test.com",
      "test",
      "password"
    );

    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(localStorage.getItem("authToken")).toBe("fake-token");
  });

  test("handles login failure", async () => {
    const mockResponse = { success: false, error: "Invalid credentials" };

    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    } as any);

    const result = await authService.login("test@test.com", "wrong-password");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid credentials");
  });

  test("clears storage on logout", () => {
    localStorage.setItem("authToken", "test-token");
    localStorage.setItem("authUser", JSON.stringify({ id: "1" }));

    authService.logout();

    expect(localStorage.getItem("authToken")).toBeNull();
    expect(localStorage.getItem("authUser")).toBeNull();
  });
});
