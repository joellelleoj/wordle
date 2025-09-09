// middleware/auth.ts - JWT Authentication Middleware

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { DataAccessService } from "../services/dataAccessService";

interface AuthenticatedRequest extends Request {
  user?: any;
}

class AuthMiddleware {
  private dataAccess: DataAccessService;

  constructor() {
    this.dataAccess = new DataAccessService();
  }

  // Verify JWT token and attach user to request
  verifyToken = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = this.extractToken(req);

      if (!token) {
        res.status(401).json({
          success: false,
          error: "Authentication token required",
        });
        return;
      }

      // Verify JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      // Get fresh user data from database
      const user = await this.dataAccess.findUserById(decoded.userId);

      if (!user) {
        res.status(401).json({
          success: false,
          error: "User not found",
        });
        return;
      }

      if (!user.is_active) {
        res.status(401).json({
          success: false,
          error: "Account deactivated",
        });
        return;
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      console.error("Token verification failed:", error);

      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          error: "Token expired",
        });
        return;
      }

      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          error: "Invalid token",
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: "Authentication failed",
      });
    }
  };

  // Optional authentication - allows both authenticated and guest users
  optionalAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = this.extractToken(req);

      if (!token) {
        // No token provided - continue as guest
        req.user = null;
        next();
        return;
      }

      // Token provided - verify it
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await this.dataAccess.findUserById(decoded.userId);

      if (user && user.is_active) {
        req.user = user;
      } else {
        req.user = null;
      }

      next();
    } catch (error) {
      // Invalid token - continue as guest
      req.user = null;
      next();
    }
  };

  // Extract token from Authorization header or cookies
  private extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    // Check cookies
    const cookieToken = req.cookies?.authToken;
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  // Rate limiting middleware (simple implementation)
  rateLimit = (
    maxRequests: number = 100,
    windowMs: number = 15 * 60 * 1000
  ) => {
    const requestCounts = new Map<
      string,
      { count: number; resetTime: number }
    >();

    return (req: Request, res: Response, next: NextFunction) => {
      const clientId = req.ip || "unknown";
      const now = Date.now();

      const clientData = requestCounts.get(clientId);

      if (!clientData || now > clientData.resetTime) {
        // Reset counter for this client
        requestCounts.set(clientId, {
          count: 1,
          resetTime: now + windowMs,
        });
        next();
        return;
      }

      if (clientData.count >= maxRequests) {
        res.status(429).json({
          success: false,
          error: "Too many requests. Please try again later.",
          retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
        });
        return;
      }

      clientData.count++;
      next();
    };
  };

  // CORS middleware for API Gateway communication
  corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || "http://localhost:5173",
      process.env.API_GATEWAY_URL || "http://localhost:8082",
      "http://localhost:3000", // Development
    ];

    const origin = req.headers.origin;

    if (!origin || allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours

    if (req.method === "OPTIONS") {
      res.status(204).send();
      return;
    }

    next();
  };

  // Input validation middleware
  validateInput = (requiredFields: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const missing = requiredFields.filter((field) => {
        const value = req.body[field];
        return value === undefined || value === null || value === "";
      });

      if (missing.length > 0) {
        res.status(400).json({
          success: false,
          error: `Missing required fields: ${missing.join(", ")}`,
        });
        return;
      }

      next();
    };
  };

  // Sanitize input middleware
  sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
    const sanitize = (obj: any): any => {
      if (typeof obj !== "object" || obj === null) {
        return obj;
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
          sanitized[key] = value.trim();
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    req.body = sanitize(req.body);
    next();
  };
}

// Export singleton instance
export const authMiddleware = new AuthMiddleware();
