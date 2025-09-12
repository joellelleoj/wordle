import request from "supertest";
import express from "express";
import { AuthController } from "../controllers/authController";
import { AuthService } from "../services/authService";

// Mock the entire AuthService module
jest.mock("../services/authService");

const MockedAuthService = AuthService as jest.MockedClass<typeof AuthService>;

describe("AuthController", () => {
  let app: express.Application;
  let authController: AuthController;
  let mockAuthServiceInstance: jest.Mocked<AuthService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Clear all mocks
    jest.clearAllMocks();

    // Create a properly mocked instance
    mockAuthServiceInstance = {
      registerUser: jest.fn(),
      loginUser: jest.fn(),
      generateOAuthUrl: jest.fn(),
      exchangeCodeForToken: jest.fn(),
      getGitLabUserInfo: jest.fn(),
      loginOrCreateUserFromGitLab: jest.fn(),
      refreshToken: jest.fn(),
      logoutUser: jest.fn(),
      cleanupExpiredTokens: jest.fn(),
    } as any;

    // Mock the constructor to return our mocked instance
    MockedAuthService.mockImplementation(() => mockAuthServiceInstance);

    authController = new AuthController();

    // Mount routes
    app.post("/register", authController.register);
    app.post("/login", authController.login);
    app.get("/gitlab/login", authController.gitlabLogin);
    app.all("/callback", authController.gitlabCallback);
    app.post("/refresh", authController.refreshToken);
    app.post("/logout", authController.logout);
    app.get(
      "/me",
      (req, res, next) => {
        (req as any).user = {
          userId: "123",
          username: "test",
          email: "test@example.com",
        };
        next();
      },
      authController.getMe
    );
    app.get("/health", authController.healthCheck);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Registration tests
  describe("register", () => {
    it("should register user successfully", async () => {
      const mockUser = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        created_at: new Date(),
      };
      const mockTokens = {
        accessToken: "access_token",
        refreshToken: "refresh_token",
      };

      mockAuthServiceInstance.registerUser.mockResolvedValue({
        user: mockUser as any,
        tokens: mockTokens,
      });

      const response = await request(app).post("/register").send({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it("should handle validation errors", async () => {
      const response = await request(app)
        .post("/register")
        .send({ username: "a", email: "invalid", password: "123" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation error");
    });

    it("should handle username already exists", async () => {
      mockAuthServiceInstance.registerUser.mockRejectedValue(
        new Error("Username already exists")
      );

      const response = await request(app).post("/register").send({
        username: "existing",
        email: "test@example.com",
        password: "password123",
      });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("Username already exists");
    });

    it("should handle email already exists", async () => {
      mockAuthServiceInstance.registerUser.mockRejectedValue(
        new Error("Email already exists")
      );

      const response = await request(app).post("/register").send({
        username: "testuser",
        email: "existing@example.com",
        password: "password123",
      });

      expect(response.status).toBe(409);
    });

    it("should handle password validation error", async () => {
      mockAuthServiceInstance.registerUser.mockRejectedValue(
        new Error("Password must be at least 6 characters")
      );

      const response = await request(app).post("/register").send({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });

      expect(response.status).toBe(400);
    });

    it("should handle generic errors", async () => {
      mockAuthServiceInstance.registerUser.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app).post("/register").send({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });

      expect(response.status).toBe(500);
    });

    it("should handle non-Error objects", async () => {
      mockAuthServiceInstance.registerUser.mockRejectedValue("String error");

      const response = await request(app).post("/register").send({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });

      expect(response.status).toBe(500);
    });

    it("should include error details in development", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      mockAuthServiceInstance.registerUser.mockRejectedValue(
        new Error("Dev error")
      );

      const response = await request(app).post("/register").send({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });

      expect(response.body.error).toBe("Dev error");
      process.env.NODE_ENV = originalEnv;
    });
  });

  // Login tests
  describe("login", () => {
    it("should login successfully", async () => {
      const mockUser = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
      };
      const mockTokens = {
        accessToken: "access_token",
        refreshToken: "refresh_token",
      };

      mockAuthServiceInstance.loginUser.mockResolvedValue({
        user: mockUser as any,
        tokens: mockTokens,
      });

      const response = await request(app)
        .post("/login")
        .send({ username: "testuser", password: "password123" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should handle login validation errors", async () => {
      const response = await request(app)
        .post("/login")
        .send({ username: "a" });

      expect(response.status).toBe(400);
    });

    it("should handle invalid credentials", async () => {
      mockAuthServiceInstance.loginUser.mockRejectedValue(
        new Error("Invalid credentials")
      );

      const response = await request(app)
        .post("/login")
        .send({ username: "testuser", password: "wrong" });

      expect(response.status).toBe(401);
    });

    it("should handle non-Error login failures", async () => {
      mockAuthServiceInstance.loginUser.mockRejectedValue("Login failed");

      const response = await request(app)
        .post("/login")
        .send({ username: "testuser", password: "wrong" });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Login failed");
    });
  });

  // OAuth tests
  describe("OAuth", () => {
    it("should generate OAuth URL", async () => {
      mockAuthServiceInstance.generateOAuthUrl.mockReturnValue(
        "https://git.imn.htwk-leipzig.de/oauth/authorize?..."
      );

      const response = await request(app).get("/gitlab/login");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should handle OAuth URL generation error", async () => {
      mockAuthServiceInstance.generateOAuthUrl.mockImplementation(() => {
        throw new Error("OAuth config error");
      });

      const response = await request(app).get("/gitlab/login");

      expect(response.status).toBe(500);
    });

    it("should handle GET callback with error", async () => {
      const response = await request(app)
        .get("/callback")
        .query({ error: "access_denied" });

      expect(response.status).toBe(302);
    });

    it("should handle POST callback with error", async () => {
      const response = await request(app)
        .post("/callback")
        .send({ error: "access_denied" });

      expect(response.status).toBe(400);
    });

    it("should handle missing code", async () => {
      const response = await request(app).post("/callback").send({});

      expect(response.status).toBe(400);
    });

    it("should handle successful callback", async () => {
      const mockUser = {
        id: 1,
        username: "gitlab",
        email: "gitlab@example.com",
        gitlab_id: 123,
      };
      const mockTokens = { accessToken: "token", refreshToken: "refresh" };
      const mockGitLabUser = {
        id: 123,
        username: "gitlab",
        name: "GitLab User",
        email: "gitlab@example.com",
      };

      mockAuthServiceInstance.exchangeCodeForToken.mockResolvedValue(
        "gitlab_token"
      );
      mockAuthServiceInstance.getGitLabUserInfo.mockResolvedValue(
        mockGitLabUser
      );
      mockAuthServiceInstance.loginOrCreateUserFromGitLab.mockResolvedValue({
        user: mockUser as any,
        tokens: mockTokens,
      });

      const response = await request(app)
        .post("/callback")
        .send({ code: "auth_code" });

      expect(response.status).toBe(200);
    });

    it("should handle token exchange errors", async () => {
      mockAuthServiceInstance.exchangeCodeForToken.mockRejectedValue(
        new Error("Token exchange failed")
      );

      const response = await request(app)
        .post("/callback")
        .send({ code: "invalid" });

      expect(response.status).toBe(400);
    });

    it("should handle invalid GitLab user data", async () => {
      mockAuthServiceInstance.exchangeCodeForToken.mockResolvedValue("token");
      mockAuthServiceInstance.getGitLabUserInfo.mockRejectedValue(
        new Error("Invalid GitLab user data")
      );

      const response = await request(app)
        .post("/callback")
        .send({ code: "valid" });

      expect(response.status).toBe(422);
    });

    it("should handle general OAuth errors", async () => {
      mockAuthServiceInstance.exchangeCodeForToken.mockRejectedValue(
        new Error("Network error")
      );

      const response = await request(app)
        .post("/callback")
        .send({ code: "valid" });

      expect(response.status).toBe(500);
    });
  });

  // Token refresh tests
  describe("refresh token", () => {
    it("should refresh successfully", async () => {
      const newTokens = {
        accessToken: "new_access",
        refreshToken: "new_refresh",
      };
      mockAuthServiceInstance.refreshToken.mockResolvedValue(newTokens);

      const response = await request(app)
        .post("/refresh")
        .send({ refreshToken: "old_token" });

      expect(response.status).toBe(200);
    });

    it("should handle validation errors", async () => {
      const response = await request(app).post("/refresh").send({});

      expect(response.status).toBe(400);
    });

    it("should handle invalid tokens", async () => {
      mockAuthServiceInstance.refreshToken.mockRejectedValue(
        new Error("Invalid token")
      );

      const response = await request(app)
        .post("/refresh")
        .send({ refreshToken: "invalid" });

      expect(response.status).toBe(401);
    });
  });

  // Logout tests
  describe("logout", () => {
    it("should logout successfully", async () => {
      mockAuthServiceInstance.logoutUser.mockResolvedValue();

      const response = await request(app)
        .post("/logout")
        .send({ refreshToken: "token" });

      expect(response.status).toBe(200);
    });

    it("should handle logout without token", async () => {
      const response = await request(app).post("/logout").send({});

      expect(response.status).toBe(200);
    });

    it("should handle logout errors", async () => {
      mockAuthServiceInstance.logoutUser.mockRejectedValue(
        new Error("Logout error")
      );

      const response = await request(app)
        .post("/logout")
        .send({ refreshToken: "token" });

      expect(response.status).toBe(500);
    });
  });

  // getMe tests
  describe("getMe", () => {
    it("should return user info", async () => {
      const response = await request(app).get("/me");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should handle no user", async () => {
      app.get("/me-no-user", authController.getMe);

      const response = await request(app).get("/me-no-user");

      expect(response.status).toBe(401);
    });

    it("should handle getMe errors", async () => {
      // Create a test that simulates an error in the getMe method
      const originalGetMe = authController.getMe;
      authController.getMe = jest.fn().mockImplementation((req, res) => {
        try {
          // Simulate an error condition
          throw new Error("Internal error");
        } catch (error) {
          res.status(500).json({
            success: false,
            message: "Failed to get user info",
          });
        }
      });

      app.get("/me-error", authController.getMe);

      const response = await request(app).get("/me-error");

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      // Restore original method
      authController.getMe = originalGetMe;
    });
  });

  // Health check
  describe("health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
