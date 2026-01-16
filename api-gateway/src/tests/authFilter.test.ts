import { Request, Response, NextFunction } from "express";
import {
  authFilter,
  requireAuth,
  AuthenticatedUser,
} from "../middleware/authFilter";

// Mock request and response objects
const mockRequest = (headers: any = {}) =>
  ({
    headers,
    auth: undefined,
  } as Request);

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as NextFunction;

describe("Authentication Filter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("authFilter", () => {
    it("should initialize auth context for requests without authorization", () => {
      const req = mockRequest();
      const res = mockResponse();

      authFilter(req, res, mockNext);

      expect(req.auth).toEqual({
        isAuthenticated: false,
        user: undefined,
        token: undefined,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle Bearer token format correctly", () => {
      const req = mockRequest({
        authorization: "Bearer mock_access_token_1_123456789",
      });
      const res = mockResponse();

      authFilter(req, res, mockNext);

      expect(req.auth?.isAuthenticated).toBe(true);
      expect(req.auth?.user?.username).toBe("testuser");
      expect(req.auth?.user?.id).toBe("1");
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle invalid Bearer token format", () => {
      const req = mockRequest({
        authorization: "InvalidFormat token",
      });
      const res = mockResponse();

      authFilter(req, res, mockNext);

      expect(req.auth?.isAuthenticated).toBe(false);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle empty Bearer token", () => {
      const req = mockRequest({
        authorization: "Bearer ",
      });
      const res = mockResponse();

      authFilter(req, res, mockNext);

      expect(req.auth?.isAuthenticated).toBe(false);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle different mock user IDs", () => {
      const req = mockRequest({
        authorization: "Bearer mock_access_token_2_123456789",
      });
      const res = mockResponse();

      authFilter(req, res, mockNext);

      expect(req.auth?.isAuthenticated).toBe(true);
      expect(req.auth?.user?.username).toBe("demo");
      expect(req.auth?.user?.id).toBe("2");
    });

    it("should handle unknown mock user IDs gracefully", () => {
      const req = mockRequest({
        authorization: "Bearer mock_access_token_999_123456789",
      });
      const res = mockResponse();

      authFilter(req, res, mockNext);

      expect(req.auth?.isAuthenticated).toBe(false);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle GitLab tokens", () => {
      const req = mockRequest({
        authorization: "Bearer gitlab_token_abc123",
      });
      const res = mockResponse();

      authFilter(req, res, mockNext);

      expect(req.auth?.isAuthenticated).toBe(true);
      expect(req.auth?.user?.username).toBe("gitlab_user");
      expect(req.auth?.user?.gitlab_id).toBe(123456);
    });
  });

  describe("requireAuth middleware", () => {
    it("should allow authenticated requests to proceed", () => {
      const req = mockRequest();
      req.auth = {
        isAuthenticated: true,
        user: {
          id: "1",
          username: "testuser",
          email: "test@example.com",
        } as AuthenticatedUser,
      };
      const res = mockResponse();

      requireAuth(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should block unauthenticated requests", () => {
      const req = mockRequest();
      req.auth = {
        isAuthenticated: false,
      };
      const res = mockResponse();

      requireAuth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Authentication required",
        message: "Please log in to access this resource",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should block requests without auth context", () => {
      const req = mockRequest();
      const res = mockResponse();

      requireAuth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
