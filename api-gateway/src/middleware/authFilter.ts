import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  gitlab_id?: number;
}

export interface AuthContext {
  isAuthenticated: boolean;
  user?: AuthenticatedUser;
  token?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export const authFilter = (
  req: Request,
  res: Response,
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

  const token = authHeader.substring(7);

  if (!token) {
    next();
    return;
  }

  try {
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
        console.log(`Mock auth successful for user: ${mockUser.username}`);
      }
      next();
      return;
    }

    // Handle real JWT tokens from user service
    const jwtSecret =
      process.env.JWT_SECRET || "fallback-secret-change-in-production";
    const decoded = jwt.verify(token, jwtSecret) as any;

    const user: AuthenticatedUser = {
      id: String(decoded.userId || decoded.id || decoded.sub),
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
      console.log(`JWT auth successful for user: ${user.username}`);
    }

    next();
  } catch (error) {
    console.error("Auth filter error:", error);
    // Continue as anonymous on token validation failure
    next();
  }
};

// Helper function to parse mock tokens for development
function parseMockToken(token: string): AuthenticatedUser | null {
  try {
    console.log(`Parsing mock token: ${token.substring(0, 20)}...`);

    if (token.startsWith("mock_access_token_")) {
      const parts = token.split("_");
      const userId = parts[3];

      console.log(`Mock token user ID: ${userId}`);

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
        "4": { id: "4", username: "jenkelma", email: "jenkelma@example.com" },
        "5": { id: "5", username: "jenkelma", email: "jenkelma@example.com" },
      };

      const user = mockUsers[userId];
      console.log(`Mock user found:`, user);
      return user || null;
    }

    if (token.startsWith("gitlab_token_")) {
      const gitlabTokenPart = token.replace("gitlab_token_", "");

      const gitlabUser = {
        id: "gitlab_123456",
        username: "gitlab_user",
        email: "gitlab@example.com",
        gitlab_id: 123456,
      };

      console.log(`GitLab user found:`, gitlabUser);
      return gitlabUser;
    }

    return null;
  } catch (error) {
    console.error("Error parsing mock token:", error);
    return null;
  }
}

// Middleware to require authentication
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.auth?.isAuthenticated) {
    console.log(`Authentication required for ${req.method} ${req.path}`);
    res.status(401).json({
      success: false,
      error: "Authentication required",
      message: "Please log in to access this resource",
    });
    return;
  }

  console.log(`Authentication passed for ${req.auth.user?.username}`);
  next();
};
