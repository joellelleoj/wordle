// profile-service/src/middleware/debugAuthMiddleware.ts - TEMPORARY DEBUG VERSION
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-super-secret-jwt-key-for-development-only";

export const debugAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log("🔍 =================================");
    console.log("🔍 DEBUG AUTH MIDDLEWARE ACTIVATED");
    console.log("🔍 =================================");

    const authHeader = req.headers.authorization;
    console.log("🔍 Auth header:", authHeader ? "present" : "missing");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ No valid auth header");
      res.status(401).json({
        success: false,
        error: "Authorization header required",
      });
      return;
    }

    const token = authHeader.substring(7);
    console.log("🔍 Token prefix:", token.substring(0, 20) + "...");
    console.log("🔍 Token type:", token.startsWith("mock_") ? "mock" : "jwt");
    console.log(
      "🔍 JWT_SECRET being used:",
      JWT_SECRET.substring(0, 10) + "..."
    );

    if (
      token.startsWith("mock_access_token_") ||
      token.startsWith("gitlab_token_")
    ) {
      console.log("🔍 Handling mock token...");
      // Handle mock tokens
      req.auth = {
        isAuthenticated: true,
        user: {
          id: "mock_user",
          username: "joelle", // Match the username from logs
          email: "joelle@example.com",
        },
        token: token,
      };
      console.log("✅ Mock auth successful");
      next();
      return;
    }

    // Handle JWT tokens
    console.log("🔍 Attempting JWT verification...");
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      console.log("🔍 JWT verification successful!");
      console.log("🔍 Decoded JWT payload:", JSON.stringify(decoded, null, 2));

      // List all available properties
      console.log("🔍 Available JWT properties:", Object.keys(decoded));

      // Try different property mappings
      const possibleUserIds = [
        decoded.id,
        decoded.user_id,
        decoded.sub,
        decoded.userId,
        decoded.uid,
      ].filter(Boolean);

      const possibleUsernames = [
        decoded.username,
        decoded.preferred_username,
        decoded.name,
        decoded.user_name,
        decoded.login,
      ].filter(Boolean);

      console.log("🔍 Possible user IDs:", possibleUserIds);
      console.log("🔍 Possible usernames:", possibleUsernames);
      console.log("🔍 Email field:", decoded.email);

      // Use the first available values
      const userId = possibleUserIds[0];
      const username = possibleUsernames[0];

      if (!userId || !username) {
        console.log("❌ Missing required user fields in JWT");
        console.log("❌ userId found:", !!userId, userId);
        console.log("❌ username found:", !!username, username);

        res.status(401).json({
          success: false,
          error: "Invalid token",
          message: "Token does not contain required user information",
          debug: {
            availableProperties: Object.keys(decoded),
            userId: !!userId,
            username: !!username,
          },
        });
        return;
      }

      req.auth = {
        isAuthenticated: true,
        user: {
          id: userId,
          username: username,
          email: decoded.email,
          gitlab_id: decoded.gitlab_id,
        },
        token: token,
      };

      console.log("✅ JWT auth successful for user:", username);
      console.log("🔍 =================================");
      next();
    } catch (jwtError) {
      console.error("❌ JWT verification failed:", jwtError);
      console.log("❌ JWT_SECRET used:", JWT_SECRET.substring(0, 10) + "...");

      const errorMessage =
        jwtError instanceof Error ? jwtError.message : String(jwtError);

      res.status(401).json({
        success: false,
        error: "Invalid token",
        message: "Token verification failed",
        debug: {
          jwtError: errorMessage,
          tokenPrefix: token.substring(0, 20),
        },
      });
      return;
    }
  } catch (error) {
    console.error("❌ Auth middleware error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication error",
      message: "Internal authentication error",
    });
  }
};
