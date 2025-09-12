import { AuthService } from "../services/authService";
import { UserDataAccessService } from "../services/userDataAccessService";

jest.mock("bcrypt", () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ sign: jest.fn(), verify: jest.fn() }));
jest.mock("../services/userDataAccessService");
jest.mock("../database/connection");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

describe("AuthService", () => {
  let authService: AuthService;
  let mockUserDataService: jest.Mocked<UserDataAccessService>;

  const createMockUser = (overrides: any = {}) => ({
    id: 1,
    username: "testuser",
    email: "test@example.com",
    password_hash: "hashed_password",
    gitlab_id: null,
    display_name: null,
    avatar_url: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

  const createMockSession = (overrides: any = {}) => ({
    id: 1,
    user_id: 1,
    refresh_token: "token",
    expires_at: new Date(Date.now() + 86400000),
    created_at: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    process.env.JWT_SECRET = "test-jwt-secret";
    process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret";
    process.env.GITLAB_CLIENT_ID = "test-client-id";
    process.env.GITLAB_CLIENT_SECRET = "test-client-secret";
    process.env.GITLAB_REDIRECT_URI =
      "http://localhost:3003/api/v1/auth/callback";

    mockUserDataService = {
      findUserByUsername: jest.fn(),
      findUserByEmail: jest.fn(),
      findUserByGitlabId: jest.fn(),
      findUserById: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      createUserSession: jest.fn(),
      findSessionByRefreshToken: jest.fn(),
      deleteUserSession: jest.fn(),
      deleteAllUserSessions: jest.fn(),
      cleanupExpiredSessions: jest.fn(),
      getUserStats: jest.fn(),
      healthCheck: jest.fn(),
      searchUsers: jest.fn(),
    } as jest.Mocked<UserDataAccessService>;

    (UserDataAccessService.getInstance as jest.Mock).mockReturnValue(
      mockUserDataService
    );
    jest.clearAllMocks();
    authService = new AuthService();
    global.fetch = jest.fn();
  });

  describe("registerUser", () => {
    it("should register successfully", async () => {
      mockUserDataService.findUserByUsername.mockResolvedValue(null);
      mockUserDataService.findUserByEmail.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashed");

      const mockUser = createMockUser();
      mockUserDataService.createUser.mockResolvedValue(mockUser);
      mockUserDataService.createUserSession.mockResolvedValue(undefined);
      jwt.sign.mockReturnValueOnce("access").mockReturnValueOnce("refresh");

      const result = await authService.registerUser(
        "testuser",
        "test@example.com",
        "password123"
      );

      expect(result.user).toEqual(mockUser);
      expect(result.tokens).toHaveProperty("accessToken");
    });

    it("should handle existing username", async () => {
      mockUserDataService.findUserByUsername.mockResolvedValue(
        createMockUser()
      );

      await expect(
        authService.registerUser("existing", "test@example.com", "password123")
      ).rejects.toThrow("Username already exists");
    });

    it("should handle existing email", async () => {
      mockUserDataService.findUserByUsername.mockResolvedValue(null);
      mockUserDataService.findUserByEmail.mockResolvedValue(createMockUser());

      await expect(
        authService.registerUser(
          "testuser",
          "existing@example.com",
          "password123"
        )
      ).rejects.toThrow("Email already exists");
    });

    it("should validate username length", async () => {
      await expect(
        authService.registerUser("ab", "test@example.com", "password123")
      ).rejects.toThrow("Username must be at least 3 characters long");
    });

    it("should validate email format", async () => {
      await expect(
        authService.registerUser("testuser", "invalid-email", "password123")
      ).rejects.toThrow("Valid email is required");
    });

    it("should validate password length", async () => {
      await expect(
        authService.registerUser("testuser", "test@example.com", "12345")
      ).rejects.toThrow("Password must be at least 6 characters long");
    });
  });

  describe("loginUser", () => {
    it("should login successfully", async () => {
      const mockUser = createMockUser();
      mockUserDataService.findUserByUsername.mockResolvedValue(mockUser);
      mockUserDataService.createUserSession.mockResolvedValue(undefined);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValueOnce("access").mockReturnValueOnce("refresh");

      const result = await authService.loginUser("testuser", "password123");

      expect(result.user).toEqual(mockUser);
      expect(result.tokens).toHaveProperty("accessToken");
    });

    it("should handle missing credentials", async () => {
      await expect(authService.loginUser("", "password")).rejects.toThrow(
        "Username and password are required"
      );
    });

    it("should handle user not found", async () => {
      mockUserDataService.findUserByUsername.mockResolvedValue(null);

      await expect(
        authService.loginUser("nonexistent", "password")
      ).rejects.toThrow("Invalid credentials or account deactivated");
    });

    it("should handle inactive user", async () => {
      const inactiveUser = createMockUser({ is_active: false });
      mockUserDataService.findUserByUsername.mockResolvedValue(inactiveUser);

      await expect(
        authService.loginUser("testuser", "password")
      ).rejects.toThrow("Invalid credentials or account deactivated");
    });

    it("should handle OAuth-only accounts", async () => {
      const oauthUser = createMockUser({
        password_hash: null,
        gitlab_id: 12345,
      });
      mockUserDataService.findUserByUsername.mockResolvedValue(oauthUser);

      await expect(
        authService.loginUser("oauthuser", "password")
      ).rejects.toThrow("This account uses OAuth login only");
    });

    it("should handle wrong password", async () => {
      const mockUser = createMockUser();
      mockUserDataService.findUserByUsername.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        authService.loginUser("testuser", "wrongpassword")
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("OAuth", () => {
    it("should generate OAuth URL", () => {
      const url = authService.generateOAuthUrl();
      expect(url).toContain("git.imn.htwk-leipzig.de/oauth/authorize");
      expect(url).toContain("client_id=test-client-id");
    });

    it("should exchange code for token", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"access_token":"gitlab_token"}'),
        json: () => Promise.resolve({ access_token: "gitlab_token" }),
      });

      const result = await authService.exchangeCodeForToken("code", "redirect");
      expect(result).toBe("gitlab_token");
    });

    it("should handle token exchange failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error":"invalid_grant"}'),
      });

      await expect(
        authService.exchangeCodeForToken("invalid", "redirect")
      ).rejects.toThrow("Failed to exchange authorization code for token");
    });

    it("should get GitLab user info", async () => {
      const mockGitLabUser = {
        id: 123,
        username: "gitlab",
        name: "User",
        email: "gitlab@example.com",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGitLabUser),
      });

      const result = await authService.getGitLabUserInfo("token");
      expect(result).toEqual(mockGitLabUser);
    });

    it("should handle user info fetch failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(authService.getGitLabUserInfo("invalid")).rejects.toThrow(
        "Failed to retrieve GitLab user information"
      );
    });
  });

  describe("refreshToken", () => {
    it("should refresh successfully", async () => {
      const mockDecodedToken = {
        userId: "1",
        username: "test",
        email: "test@example.com",
        type: "refresh",
      };
      const mockSession = createMockSession();
      const mockUser = createMockUser();

      jwt.verify.mockReturnValue(mockDecodedToken);
      mockUserDataService.findSessionByRefreshToken.mockResolvedValue(
        mockSession
      );
      mockUserDataService.findUserById.mockResolvedValue(mockUser);
      mockUserDataService.deleteUserSession.mockResolvedValue(undefined);
      mockUserDataService.createUserSession.mockResolvedValue(undefined);
      jwt.sign
        .mockReturnValueOnce("new_access")
        .mockReturnValueOnce("new_refresh");

      const result = await authService.refreshToken("old_token");

      expect(result).toHaveProperty("accessToken", "new_access");
      expect(result).toHaveProperty("refreshToken", "new_refresh");
    });

    it("should handle invalid token", async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await expect(authService.refreshToken("invalid")).rejects.toThrow(
        "Token refresh failed"
      );
    });

    it("should handle wrong token type", async () => {
      jwt.verify.mockReturnValue({ type: "access" });

      await expect(authService.refreshToken("wrong_type")).rejects.toThrow(
        "Token refresh failed"
      );
    });

    it("should handle session not found", async () => {
      jwt.verify.mockReturnValue({ userId: "1", type: "refresh" });
      mockUserDataService.findSessionByRefreshToken.mockResolvedValue(null);

      await expect(authService.refreshToken("no_session")).rejects.toThrow(
        "Token refresh failed"
      );
    });

    it("should handle inactive user", async () => {
      const mockDecodedToken = { userId: "1", type: "refresh" };
      const mockSession = createMockSession();
      const inactiveUser = createMockUser({ is_active: false });

      jwt.verify.mockReturnValue(mockDecodedToken);
      mockUserDataService.findSessionByRefreshToken.mockResolvedValue(
        mockSession
      );
      mockUserDataService.findUserById.mockResolvedValue(inactiveUser);

      await expect(authService.refreshToken("inactive_user")).rejects.toThrow(
        "Token refresh failed"
      );
    });
  });

  describe("logoutUser", () => {
    it("should logout successfully", async () => {
      mockUserDataService.deleteUserSession.mockResolvedValue();

      await authService.logoutUser("refresh_token");

      expect(mockUserDataService.deleteUserSession).toHaveBeenCalledWith(
        "refresh_token"
      );
    });

    it("should handle empty token", async () => {
      await authService.logoutUser("");
      expect(mockUserDataService.deleteUserSession).not.toHaveBeenCalled();
    });
  });

  describe("cleanupExpiredTokens", () => {
    it("should cleanup successfully", async () => {
      mockUserDataService.cleanupExpiredSessions.mockResolvedValue();

      await authService.cleanupExpiredTokens();

      expect(mockUserDataService.cleanupExpiredSessions).toHaveBeenCalled();
    });
  });
});
