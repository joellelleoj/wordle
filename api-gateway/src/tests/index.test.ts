import request from "supertest";
import { jest } from "@jest/globals";

// Mock axios for service calls
jest.mock("axios");
const mockAxios = jest.mocked(require("axios"));

// Import the gateway after mocking
import gateway from "../index";

describe("API Gateway", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Health Check", () => {
    it("should return health status", async () => {
      const response = await request(gateway.getApp())
        .get("/health")
        .expect(200);

      expect(response.body).toHaveProperty("service", "API Gateway");
      expect(response.body).toHaveProperty("status", "healthy");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("port");
      expect(response.body).toHaveProperty("environment");
      expect(response.body).toHaveProperty("authentication");
    });
  });

  describe("Root Endpoint", () => {
    it("should return service documentation", async () => {
      const response = await request(gateway.getApp()).get("/").expect(200);

      expect(response.body).toHaveProperty("service", "Wordle API Gateway");
      expect(response.body).toHaveProperty("version", "1.0.0");
    });
  });

  describe("Authentication Filter", () => {
    it("should handle anonymous requests", async () => {
      const response = await request(gateway.getApp())
        .get("/api/test/auth")
        .expect(200);

      expect(response.body.authentication.isAuthenticated).toBe(false);
      expect(response.body.authentication.user).toBe(null);
    });

    it("should handle mock authentication tokens", async () => {
      const response = await request(gateway.getApp())
        .get("/api/test/auth")
        .set("Authorization", "Bearer mock_access_token_1_123456789")
        .expect(200);

      expect(response.body.authentication.isAuthenticated).toBe(true);
      expect(response.body.authentication.user).toHaveProperty(
        "username",
        "testuser"
      );
      expect(response.body.authentication.user).toHaveProperty("id", "1");
    });

    it("should handle invalid tokens gracefully", async () => {
      const response = await request(gateway.getApp())
        .get("/api/test/auth")
        .set("Authorization", "Bearer invalid_token")
        .expect(200);

      expect(response.body.authentication.isAuthenticated).toBe(false);
    });
  });

  describe("CORS Configuration", () => {
    it("should handle CORS preflight requests", async () => {
      const response = await request(gateway.getApp())
        .options("/api/test")
        .set("Origin", "http://localhost:3000")
        .expect(200);

      expect(response.headers["access-control-allow-origin"]).toBeDefined();
    });

    it("should return CORS test response", async () => {
      const response = await request(gateway.getApp())
        .get("/api/test")
        .set("Origin", "http://localhost:3000")
        .expect(200);

      expect(response.body).toHaveProperty("message", "CORS is working!");
      expect(response.body).toHaveProperty("origin", "http://localhost:3000");
    });
  });

  describe("Game Routes", () => {
    it("should forward new game requests", async () => {
      const mockGameResponse = {
        success: true,
        gameId: "test-game-123",
        word: "HELLO",
      };

      mockAxios.post.mockResolvedValueOnce({
        status: 200,
        data: mockGameResponse,
      });

      const response = await request(gateway.getApp())
        .post("/api/game/new")
        .expect(200);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/game/new"),
        {},
        expect.any(Object)
      );
      expect(response.body).toEqual(mockGameResponse);
    });

    it("should handle game service errors", async () => {
      const mockError = {
        response: {
          status: 503,
          data: { error: "Service unavailable" },
        },
      };

      mockAxios.post.mockRejectedValueOnce(mockError);

      const response = await request(gateway.getApp())
        .post("/api/game/new")
        .expect(503);

      expect(response.body).toHaveProperty("error", "Service unavailable");
    });

    it("should validate guess submission", async () => {
      const response = await request(gateway.getApp())
        .post("/api/game/test-game-123/guess")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error", "Valid guess required");
    });
  });

  describe("Profile Routes Authentication", () => {
    it("should require authentication for profile routes", async () => {
      const response = await request(gateway.getApp())
        .get("/api/profile/games")
        .expect(401);

      expect(response.body).toHaveProperty("error", "Authentication required");
    });

    it("should allow authenticated access to profile routes", async () => {
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: { games: [] },
      });

      const response = await request(gateway.getApp())
        .get("/api/profile/games")
        .set("Authorization", "Bearer mock_access_token_1_123456789")
        .expect(200);

      expect(response.body).toHaveProperty("games");
    });
  });

  describe("Error Handling", () => {
    it("should handle 404 routes gracefully", async () => {
      const response = await request(gateway.getApp())
        .get("/api/nonexistent/route")
        .expect(404);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("message");
    });
  });
});
