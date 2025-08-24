import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Access token required",
    });
    return;
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "fallback-secret",
    (err, decoded) => {
      if (err) {
        res.status(403).json({
          success: false,
          message: "Invalid or expired token",
        });
        return;
      }

      req.user = decoded as { id: string; email: string };
      next();
    }
  );
};

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JWTPayload {
  id: string;
  email: string;
  username: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: "Access token required" });
    return;
  }

  const jwtSecret =
    process.env.JWT_SECRET || "your-secret-key-change-in-production";

  try {
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    req.user = decoded;
    next();
  } catch (error) {
    console.error("JWT verification failed:", error);
    res.status(403).json({ error: "Invalid or expired token" });
  }
};

// Optional: Middleware for endpoints that don't require auth but can use it
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (token) {
    try {
      const jwtSecret =
        process.env.JWT_SECRET || "your-secret-key-change-in-production";
      const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
      req.user = decoded;
    } catch (error) {
      // Token invalid, but continue without auth
      console.warn("Invalid token in optional auth:", error);
    }
  }

  next();
};
