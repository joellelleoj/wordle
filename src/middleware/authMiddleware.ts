// user-service/src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export class AuthMiddleware {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret =
      process.env.JWT_SECRET || "fallback-secret-change-in-production";
  }

  authenticate = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({
          success: false,
          message: "Authorization header is required",
        });
        return;
      }

      const token = authHeader.split(" ")[1]; // Bearer TOKEN

      if (!token) {
        res.status(401).json({
          success: false,
          message: "Token is required",
        });
        return;
      }

      const decoded = jwt.verify(token, this.jwtSecret);
      (req as any).user = decoded;

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          message: "Token has expired",
        });
        return;
      }

      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          message: "Invalid token",
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Authentication error",
      });
    }
  };
}

/*// game-service/src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  gitlab_id?: number;
}

// Extend Express Request type to include authentication context
declare global {
  namespace Express {
    interface Request {
      auth?: {
        isAuthenticated: boolean;
        user?: AuthenticatedUser;
        token?: string;
      };
    }
  }
}

export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // Initialize auth context
  req.auth = {
    isAuthenticated: false,
    user: undefined,
    token: undefined,
  };

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // No authentication provided - continue as anonymous
    next();
    return;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  if (!token) {
    next();
    return;
  }

  try {
    // Handle mock tokens for development
    if (
      token.startsWith("mock_access_token_") ||
      token.startsWith("gitlab_token_")
    ) {
      const mockUser = parseMockToken(token);
      if (mockUser) {
        req.auth = {
          isAuthenticated: true,
          user: mockUser,
          token: token,
        };
      }
      next();
      return;
    }

    // Handle JWT tokens for production
    const jwtSecret = process.env.JWT_SECRET || "your-super-secret-jwt-key";
    const decoded = jwt.verify(token, jwtSecret) as any;

    const user: AuthenticatedUser = {
      id: decoded.id || decoded.user_id || decoded.sub,
      username: decoded.username || decoded.preferred_username,
      email: decoded.email,
      gitlab_id: decoded.gitlab_id,
    };

    if (user.id && user.username) {
      req.auth = {
        isAuthenticated: true,
        user: user,
        token: token,
      };
    }

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    // Continue as anonymous on token validation failure
    next();
  }
};

// Helper function to parse mock tokens for development
function parseMockToken(token: string): AuthenticatedUser | null {
  try {
    if (token.startsWith("mock_access_token_")) {
      // Extract user ID from mock token: mock_access_token_1_timestamp
      const parts = token.split("_");
      const userId = parts[3];

      const mockUsers: { [key: string]: AuthenticatedUser } = {
        "1": {
          id: "1",
          username: "testuser",
          email: "test@example.com",
        },
        "2": {
          id: "2",
          username: "demo",
          email: "demo@example.com",
        },
        "3": {
          id: "3",
          username: "player1",
          email: "player1@example.com",
        },
      };

      return mockUsers[userId] || null;
    }

    if (token.startsWith("gitlab_token_")) {
      // For GitLab tokens, return a mock GitLab user
      return {
        id: "gitlab_123456",
        username: "gitlab_user",
        email: "gitlab@example.com",
        gitlab_id: 123456,
      };
    }

    return null;
  } catch (error) {
    console.error("Error parsing mock token:", error);
    return null;
  }
}

// Middleware to require authentication (optional usage)
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.auth?.isAuthenticated) {
    res.status(401).json({
      success: false,
      error: "Authentication required",
      message: "Please log in to access this resource",
    });
    return;
  }
  next();
};
*/
