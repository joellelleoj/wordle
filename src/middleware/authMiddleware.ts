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

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  req.auth = {
    isAuthenticated: false,
    user: undefined,
    token: undefined,
  };

  const forwardedUserId = req.headers["x-user-id"] as string;
  const forwardedUsername = req.headers["x-user-username"] as string;

  if (forwardedUserId && forwardedUsername) {
    req.auth = {
      isAuthenticated: true,
      user: {
        id: forwardedUserId,
        username: forwardedUsername,
        email: `${forwardedUsername}@example.com`, // Fallback email
      },
      token: req.headers.authorization?.replace("Bearer ", "") || "",
    };
    console.log(`🔐 Forwarded auth successful for user: ${forwardedUsername}`);
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log(`No authentication provided for ${req.method} ${req.path}`);
    res.status(401).json({
      success: false,
      error: "Authentication required",
      message: "Please provide a valid Bearer token",
    });
    return;
  }

  const token = authHeader.substring(7);

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
        next();
        return;
      }
    }

    const jwtSecret =
      process.env.JWT_SECRET || "fallback-secret-change-in-production";
    const decoded = jwt.verify(token, jwtSecret) as any;

    const user: AuthenticatedUser = {
      id: decoded.userId || decoded.id || decoded.sub,
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
      console.log(`🔐 JWT auth successful for user: ${user.username}`);
      next();
      return;
    }

    console.log(`Invalid JWT token for ${req.method} ${req.path}`);
    res.status(401).json({
      success: false,
      error: "Invalid authentication token",
    });
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({
      success: false,
      error: "Authentication failed",
      message: "Invalid or expired token",
    });
  }
};

function parseMockToken(token: string): AuthenticatedUser | null {
  try {
    console.log(`🔐 Parsing mock token: ${token.substring(0, 20)}...`);

    if (token.startsWith("mock_access_token_")) {
      const parts = token.split("_");
      const userId = parts[3];

      const mockUsers: { [key: string]: AuthenticatedUser } = {
        "1": { id: "1", username: "testuser", email: "test@example.com" },
        "2": { id: "2", username: "demo", email: "demo@example.com" },
        "3": { id: "3", username: "player1", email: "player1@example.com" },
        "4": { id: "4", username: "jenkelma", email: "jenkelma@example.com" },
        "5": { id: "5", username: "jenkelma", email: "jenkelma@example.com" },
      };

      return mockUsers[userId] || null;
    }

    if (token.startsWith("gitlab_token_")) {
      return {
        id: "gitlab_user",
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
