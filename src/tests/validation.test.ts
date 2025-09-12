import {
  validateRegistration,
  validateLogin,
  validateTokenRefresh,
  validateOAuthCallback,
  validateUserUpdate,
} from "../utils/validation";

describe("Validation Utils", () => {
  describe("validateRegistration", () => {
    it("should validate correct data", () => {
      const { error } = validateRegistration({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });
      expect(error).toBeUndefined();
    });

    it("should reject short username", () => {
      const { error } = validateRegistration({
        username: "ab",
        email: "test@example.com",
        password: "password123",
      });
      expect(error).toBeDefined();
    });

    it("should reject invalid email", () => {
      const { error } = validateRegistration({
        username: "testuser",
        email: "invalid",
        password: "password123",
      });
      expect(error).toBeDefined();
    });

    it("should reject short password", () => {
      const { error } = validateRegistration({
        username: "testuser",
        email: "test@example.com",
        password: "123",
      });
      expect(error).toBeDefined();
    });

    it("should reject non-alphanumeric username", () => {
      const { error } = validateRegistration({
        username: "test@user",
        email: "test@example.com",
        password: "password123",
      });
      expect(error).toBeDefined();
    });

    it("should reject long username", () => {
      const { error } = validateRegistration({
        username: "a".repeat(31),
        email: "test@example.com",
        password: "password123",
      });
      expect(error).toBeDefined();
    });

    it("should reject long password", () => {
      const { error } = validateRegistration({
        username: "testuser",
        email: "test@example.com",
        password: "a".repeat(129),
      });
      expect(error).toBeDefined();
    });

    it("should require all fields", () => {
      const { error } = validateRegistration({});
      expect(error).toBeDefined();
    });
  });

  describe("validateLogin", () => {
    it("should validate correct data", () => {
      const { error } = validateLogin({
        username: "testuser",
        password: "password123",
      });
      expect(error).toBeUndefined();
    });

    it("should reject missing username", () => {
      const { error } = validateLogin({ password: "password123" });
      expect(error).toBeDefined();
    });

    it("should reject missing password", () => {
      const { error } = validateLogin({ username: "testuser" });
      expect(error).toBeDefined();
    });

    it("should reject short username", () => {
      const { error } = validateLogin({
        username: "ab",
        password: "password123",
      });
      expect(error).toBeDefined();
    });

    it("should reject long username", () => {
      const { error } = validateLogin({
        username: "a".repeat(31),
        password: "password123",
      });
      expect(error).toBeDefined();
    });

    it("should reject empty password", () => {
      const { error } = validateLogin({
        username: "testuser",
        password: "",
      });
      expect(error).toBeDefined();
    });
  });

  describe("validateTokenRefresh", () => {
    it("should validate correct data", () => {
      const { error } = validateTokenRefresh({ refreshToken: "token" });
      expect(error).toBeUndefined();
    });

    it("should reject missing token", () => {
      const { error } = validateTokenRefresh({});
      expect(error).toBeDefined();
    });

    it("should reject empty token", () => {
      const { error } = validateTokenRefresh({ refreshToken: "" });
      expect(error).toBeDefined();
    });
  });

  describe("validateOAuthCallback", () => {
    it("should validate correct data", () => {
      const { error } = validateOAuthCallback({ code: "auth-code-123" });
      expect(error).toBeUndefined();
    });

    it("should validate with state", () => {
      const { error } = validateOAuthCallback({
        code: "auth-code-123",
        state: "csrf-state",
      });
      expect(error).toBeUndefined();
    });

    it("should validate with redirect_uri", () => {
      const { error } = validateOAuthCallback({
        code: "auth-code-123",
        redirect_uri: "http://localhost:3003/callback",
      });
      expect(error).toBeUndefined();
    });

    it("should reject missing code", () => {
      const { error } = validateOAuthCallback({});
      expect(error).toBeDefined();
    });

    it("should reject invalid redirect_uri", () => {
      const { error } = validateOAuthCallback({
        code: "auth-code-123",
        redirect_uri: "not-a-url",
      });
      expect(error).toBeDefined();
    });
  });

  describe("validateUserUpdate", () => {
    it("should validate correct data", () => {
      const { error } = validateUserUpdate({
        display_name: "Test User",
        avatar_url: "https://example.com/avatar.jpg",
      });
      expect(error).toBeUndefined();
    });

    it("should accept empty data", () => {
      const { error } = validateUserUpdate({});
      expect(error).toBeUndefined();
    });

    it("should reject empty display_name", () => {
      const { error } = validateUserUpdate({ display_name: "" });
      expect(error).toBeDefined();
    });

    it("should reject long display_name", () => {
      const { error } = validateUserUpdate({
        display_name: "a".repeat(101),
      });
      expect(error).toBeDefined();
    });

    it("should reject invalid avatar_url", () => {
      const { error } = validateUserUpdate({
        avatar_url: "not-a-url",
      });
      expect(error).toBeDefined();
    });
  });
});
