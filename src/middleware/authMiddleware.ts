// profile-service/src/middleware/authMiddleware.ts - Fixed authentication
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedUser {
  id: string; // Always string to avoid type conflicts
  username: string;
  email: string;
  gitlab_id?: number;
}

export interface AuthContext {
  isAuthenticated: boolean;
  user?: AuthenticatedUser;
  token?: string;
}

// Extend Express Request type globally
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
  // Initialize auth context
  req.auth = {
    isAuthenticated: false,
    user: undefined,
    token: undefined,
  };

  // Check for forwarded auth from API Gateway
  const forwardedUserId = req.headers["x-user-id"] as string;
  const forwardedUsername = req.headers["x-user-username"] as string;

  if (forwardedUserId && forwardedUsername) {
    // Use forwarded authentication from API Gateway
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

  // Fallback to direct token validation
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log(`❌ No authentication provided for ${req.method} ${req.path}`);
    res.status(401).json({
      success: false,
      error: "Authentication required",
      message: "Please provide a valid Bearer token",
    });
    return;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

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
        console.log(`🔐 Mock auth successful for user: ${mockUser.username}`);
        next();
        return;
      }
    }

    // Handle real JWT tokens
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

    console.log(`❌ Invalid JWT token for ${req.method} ${req.path}`);
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

// Helper function to parse mock tokens for development
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
/*// profile-service/src/middleware/authMiddleware.ts - Simple fix with better property mapping
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  gitlab_id?: number;
}

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

const JWT_SECRET =
  process.env.JWT_SECRET || "your-super-secret-jwt-key-for-development-only";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    req.auth = {
      isAuthenticated: false,
      user: undefined,
      token: undefined,
    };

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Authorization header required",
        message: "Please provide a valid Bearer token",
      });
      return;
    }

    const token = authHeader.substring(7);
    if (!token) {
      res.status(401).json({
        success: false,
        error: "Token required",
        message: "No token provided in Authorization header",
      });
      return;
    }

    // Handle development mock tokens
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

    // Handle production JWT tokens
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      // Try all possible property mappings for user data
      const userId =
        decoded.id ||
        decoded.user_id ||
        decoded.sub ||
        decoded.userId ||
        decoded.uid ||
        String(decoded.iat); // fallback to timestamp
      const username =
        decoded.username ||
        decoded.preferred_username ||
        decoded.name ||
        decoded.user_name ||
        decoded.login ||
        decoded.email?.split("@")[0];
      const email = decoded.email || `${username}@example.com`; // fallback email

      console.log(
        `Decoded JWT - Available properties: ${Object.keys(decoded).join(", ")}`
      );
      console.log(
        `Extracted - ID: ${userId}, Username: ${username}, Email: ${email}`
      );

      if (!userId || !username) {
        console.error(
          `Missing user data - ID: ${!!userId}, Username: ${!!username}`
        );
        console.error(`JWT payload:`, JSON.stringify(decoded, null, 2));

        res.status(401).json({
          success: false,
          error: "Invalid token",
          message: "Token does not contain required user information",
        });
        return;
      }

      const user: AuthenticatedUser = {
        id: String(userId),
        username: String(username),
        email: String(email),
        gitlab_id: decoded.gitlab_id,
      };

      req.auth = {
        isAuthenticated: true,
        user: user,
        token: token,
      };

      console.log(`JWT auth successful for user: ${user.username}`);
      next();
    } catch (jwtError) {
      const errorMessage =
        jwtError instanceof Error ? jwtError.message : String(jwtError);
      console.error("JWT verification failed:", errorMessage);

      res.status(401).json({
        success: false,
        error: "Invalid token",
        message: "Token verification failed",
      });
      return;
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication error",
      message: "Internal authentication error",
    });
  }
};

// Helper function to parse mock tokens
function parseMockToken(token: string): AuthenticatedUser | null {
  try {
    if (token.startsWith("mock_access_token_")) {
      const parts = token.split("_");
      const userId = parts[3];
      const mockUsers: { [key: string]: AuthenticatedUser } = {
        "1": { id: "1", username: "testuser", email: "test@example.com" },
        "2": { id: "2", username: "demo", email: "demo@example.com" },
        "3": { id: "3", username: "player1", email: "player1@example.com" },
        "4": { id: "4", username: "joelle", email: "joelle@example.com" },
        "5": { id: "5", username: "jenkelma", email: "jenkelma@example.com" },
      };
      return mockUsers[userId] || null;
    }

    if (token.startsWith("gitlab_token_")) {
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
*/
