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
/*// user-service/src/middleware/authMiddleware.ts
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

// src/middleware/authMiddleware.ts

import { Request, Response, NextFunction } from "express";
import AuthService from "../services/AuthService";
import { JWTPayload } from "../types/user.types";

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // Middleware to verify JWT token
  authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({
          success: false,
          error: "No authorization header provided",
        });
        return;
      }

      const token = this.extractTokenFromHeader(authHeader);
      if (!token) {
        res.status(401).json({
          success: false,
          error: "Invalid authorization header format",
        });
        return;
      }

      // Verify token
      const payload = await this.authService.verifyAccessToken(token);
      req.user = payload;

      next();
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: "Invalid or expired token",
        message: error.message,
      });
    }
  };

  // Optional authentication - doesn't fail if no token
  optionalAuthenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader) {
        const token = this.extractTokenFromHeader(authHeader);
        if (token) {
          try {
            const payload = await this.authService.verifyAccessToken(token);
            req.user = payload;
          } catch {
            // Ignore invalid token in optional auth
          }
        }
      }

      next();
    } catch {
      // Continue without authentication
      next();
    }
  };

  // Middleware to check if user is authenticated
  requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    next();
  };

  // Middleware to check if user owns resource (by user ID in params)
  requireOwnership = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const userId = req.params.userId || req.params.id;
    if (userId && userId !== req.user.sub) {
      res.status(403).json({
        success: false,
        error: "Access denied: You can only access your own resources",
      });
      return;
    }

    next();
  };

  // Extract token from Authorization header
  private extractTokenFromHeader(authHeader: string): string | null {
    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }

  // Middleware to validate refresh token
  validateRefreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        res.status(400).json({
          success: false,
          error: "Refresh token is required",
        });
        return;
      }

      // The actual validation happens in the service layer
      next();
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: "Invalid refresh token format",
        message: error.message,
      });
    }
  };

  // Rate limiting for auth endpoints
  createAuthRateLimit = () => {
    const rateLimit = require("express-rate-limit");

    return rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "5"), // 5 requests per window for auth
      message: {
        success: false,
        error: "Too many authentication attempts, please try again later",
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Skip successful requests
      skipSuccessfulRequests: true,
    });
  };

  // Rate limiting for general API endpoints
  createGeneralRateLimit = () => {
    const rateLimit = require("express-rate-limit");

    return rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"), // 100 requests per window
      message: {
        success: false,
        error: "Too many requests, please try again later",
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  };

  // CORS middleware
  createCorsMiddleware = () => {
    const cors = require("cors");

    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ];

    return cors({
      origin: (origin: string | undefined, callback: Function) => {
        // Allow requests with no origin (mobile apps, curl requests, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });
  };
}

export default AuthMiddleware;*/
