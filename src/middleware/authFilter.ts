// api-gateway/src/middleware/authFilter.ts - Fixed authentication with consistent types
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

// Extend Express Request type to include authentication context
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

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  if (!token) {
    next();
    return;
  }

  try {
    // Handle mock tokens for development (created by frontend auth service)
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
      id: String(decoded.userId || decoded.id || decoded.sub), // Ensure string type
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
      // Extract user ID from mock token: mock_access_token_1_timestamp
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
      // For GitLab tokens, extract the actual access token and try to identify user
      const gitlabTokenPart = token.replace("gitlab_token_", "");

      // For now, return a generic GitLab user - in production this would verify with GitLab
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
}; /*// api-gateway/src/middleware/authFilter.ts - FIXED VERSION
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedUser {
  id: string | number;
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

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  if (!token) {
    next();
    return;
  }

  try {
    console.log(`🔐 Processing token: ${token.substring(0, 20)}...`);

    // Handle mock tokens for development (created by frontend auth service)
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
        console.log(`✅ Mock auth successful for user: ${mockUser.username}`);
      } else {
        console.log(
          `❌ Mock token parsing failed for: ${token.substring(0, 20)}...`
        );
      }
      next();
      return;
    }

    // Handle real JWT tokens from user service
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
      console.log(`✅ JWT auth successful for user: ${user.username}`);
    }

    next();
  } catch (error) {
    console.error("❌ Auth filter error:", error);
    // Continue as anonymous on token validation failure
    next();
  }
};

// FIXED: Helper function to parse mock tokens for development
function parseMockToken(token: string): AuthenticatedUser | null {
  try {
    console.log(`🔍 Parsing mock token: ${token.substring(0, 30)}...`);

    if (token.startsWith("mock_access_token_")) {
      // Extract user ID from mock token: mock_access_token_1_timestamp
      const parts = token.split("_");
      if (parts.length < 4) {
        console.log(`❌ Invalid mock token format: ${parts.length} parts`);
        return null;
      }

      const userId = parts[3];
      console.log(`🔍 Extracted user ID: ${userId}`);

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
        "4": {
          id: "4",
          username: "jenkelma",
          email: "jenkelma@example.com",
        },
        "5": {
          id: "5",
          username: "jenkelma",
          email: "jenkelma@example.com",
        },
      };

      const user = mockUsers[userId];
      if (user) {
        console.log(`✅ Mock user found:`, user);
        return user;
      } else {
        console.log(`❌ No mock user found for ID: ${userId}`);
        return null;
      }
    }

    if (token.startsWith("gitlab_token_")) {
      // For GitLab tokens, extract the actual access token and try to identify user
      const gitlabTokenPart = token.replace("gitlab_token_", "");

      // For now, return a generic GitLab user - in production this would verify with GitLab
      const gitlabUser = {
        id: "gitlab_123456",
        username: "gitlab_user",
        email: "gitlab@example.com",
        gitlab_id: 123456,
      };

      console.log(`✅ GitLab user found:`, gitlabUser);
      return gitlabUser;
    }

    console.log(`❌ Unknown token format: ${token.substring(0, 20)}...`);
    return null;
  } catch (error) {
    console.error("❌ Error parsing mock token:", error);
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
    console.log(`❌ Authentication required for ${req.method} ${req.path}`);
    res.status(401).json({
      success: false,
      error: "Authentication required",
      message: "Please log in to access this resource",
    });
    return;
  }

  console.log(`✅ Authentication passed for ${req.auth.user?.username}`);
  next();
}; // api-gateway/src/middleware/authFilter.ts
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
    console.error("Auth filter error:", error);
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

// Middleware to require authentication
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
