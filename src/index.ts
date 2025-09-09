// user-service/src/index.ts
import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AuthRoutes } from "./routes/authRoutes";
import { dbConnection } from "./database/connection";

dotenv.config();

class UserService {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || "3003");
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.setupErrorHandling();
  }

  private initializeMiddlewares(): void {
    const corsOptions = {
      origin: [
        "http://localhost:3000", // Frontend development
        "http://127.0.10.11:8080", // Production frontend
        "http://localhost:8002", // API Gateway
        "http://127.0.10.11:8082", // Production API Gateway
        "https://git.imn.htwk-leipzig.de", // GitLab OAuth
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    };

    this.app.use(cors(corsOptions));
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check at root level
    this.app.get("/health", async (req: Request, res: Response) => {
      try {
        const healthResult = await dbConnection.healthCheck();
        res.status(200).json({
          service: "User Service",
          version: "1.0.0",
          status: "healthy",
          timestamp: new Date().toISOString(),
          database: healthResult.status,
        });
      } catch (error) {
        res.status(503).json({
          service: "User Service",
          version: "1.0.0",
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          database: "disconnected",
          error: "Database connection failed",
        });
      }
    });

    // Root route
    this.app.get("/", (req: Request, res: Response) => {
      res.status(200).json({
        service: "Wordle User Service",
        version: "1.0.0",
        status: "running",
        timestamp: new Date().toISOString(),
        endpoints: {
          auth: "/api/v1/auth",
          health: "/health",
        },
      });
    });

    // Mount auth routes with proper prefix
    const authRoutes = new AuthRoutes();
    this.app.use("/api/v1/auth", authRoutes.getRouter());

    // Also mount at /api for API Gateway compatibility
    this.app.use("/api/auth", authRoutes.getRouter());
  }

  private setupErrorHandling(): void {
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
      console.error("Global error handler:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        ...(process.env.NODE_ENV === "development" && { error: error.message }),
      });
    });

    this.app.use("*", (req: Request, res: Response) => {
      console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        availableRoutes: [
          "GET /health",
          "GET /api/v1/auth/gitlab/login",
          "GET /api/v1/auth/callback",
          "POST /api/v1/auth/callback",
          "POST /api/v1/auth/login",
          "POST /api/v1/auth/register",
          "POST /api/v1/auth/refresh",
          "POST /api/v1/auth/logout",
          "GET /api/v1/auth/me",
        ],
      });
    });
  }

  private async testDatabaseConnection(): Promise<void> {
    try {
      const result = await dbConnection.healthCheck();
      console.log("✅ Database connection successful:", result.status);
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      throw new Error("Unable to connect to database");
    }
  }

  public async start(): Promise<void> {
    try {
      // Test database connection (no migrations needed since database folder handles schema creation)
      await this.testDatabaseConnection();

      this.app.listen(this.port, "0.0.0.0", () => {
        console.log(`🚀 User Service running on port ${this.port}`);
        console.log(`📚 Environment: ${process.env.NODE_ENV || "development"}`);
        console.log(`🔗 Health check: http://localhost:${this.port}/health`);
        console.log(`🔐 Auth endpoints:`);
        console.log(
          `   GET http://localhost:${this.port}/api/v1/auth/gitlab/login`
        );
        console.log(
          `   GET http://localhost:${this.port}/api/v1/auth/callback`
        );
        console.log(`   POST http://localhost:${this.port}/api/v1/auth/login`);
        console.log(
          `   POST http://localhost:${this.port}/api/v1/auth/register`
        );
        console.log(`   GET http://localhost:${this.port}/api/v1/auth/me`);
        console.log(`\n✅ User Service started successfully!`);
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  }
}

const userService = new UserService();
userService.start();

export default userService;
/*import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AppRoutes } from "./routes";
import { pool } from "./database/connection";

// Load environment variables
dotenv.config();

class UserService {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || "3003");
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.setupErrorHandling();
  }

  private initializeMiddlewares(): void {
    // CORS configuration
    const corsOptions = {
      origin: [
        "http://localhost:3000", // Frontend development
        "http://127.0.10.11:8080", // Production frontend via reverse proxy
        "http://localhost:8002", // API Gateway
        "http://127.0.10.11:8082", // Production API Gateway via reverse proxy
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    };

    this.app.use(cors(corsOptions));
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
      next();
    });
  }

  private initializeRoutes(): void {
    const appRoutes = new AppRoutes();
    this.app.use("/api", appRoutes.getRouter());

    // Root route
    this.app.get("/", (req: Request, res: Response) => {
      res.status(200).json({
        service: "Wordle User Service",
        version: "1.0.0",
        status: "running",
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
      console.error("Global error handler:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        ...(process.env.NODE_ENV === "development" && { error: error.message }),
      });
    });

    // 404 handler
    this.app.use("*", (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
      });
    });
  }

  private async testDatabaseConnection(): Promise<void> {
    try {
      const client = await pool.connect();
      await client.query("SELECT NOW()");
      client.release();
      console.log("Database connection successful");
    } catch (error) {
      console.error("Database connection failed:", error);
      throw new Error("Unable to connect to database");
    }
  }

  public async start(): Promise<void> {
    try {
      // Test database connection
      await this.testDatabaseConnection();

      // Start server
      this.app.listen(this.port, "0.0.0.0", () => {
        console.log(`🚀 User Service running on port ${this.port}`);
        console.log(`📚 Environment: ${process.env.NODE_ENV || "development"}`);
        console.log(
          `🔗 Health check: http://localhost:${this.port}/api/health`
        );
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  }

  public getApp(): Application {
    return this.app;
  }
}

// Start the service
const userService = new UserService();
userService.start();

export default userService;

// src/index.ts

import express, { Application, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import db from "./database/connection";
import AuthRoutes from "./routes/authRoutes";
import UserRoutes from "./routes/userRoutes";
import AuthMiddleware from "./middleware/authMiddleware";
import AuthService from "./services/AuthService";

// Load environment variables
dotenv.config();

class UserService {
  private app: Application;
  private port: number;
  private authMiddleware: AuthMiddleware;
  private authService: AuthService;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || "3003");
    this.authMiddleware = new AuthMiddleware();
    this.authService = new AuthService();

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeCleanupTasks();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );

    // CORS middleware
    this.app.use(this.authMiddleware.createCorsMiddleware());

    // Body parsing middleware
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // General rate limiting
    this.app.use(this.authMiddleware.createGeneralRateLimit());

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();

      res.on("finish", () => {
        const duration = Date.now() - start;
        console.log(
          `${req.method} ${req.path} ${res.statusCode} - ${duration}ms - ${req.ip}`
        );
      });

      next();
    });

    // Health check middleware (before routes)
    this.app.use("/health", async (req: Request, res: Response) => {
      try {
        const dbHealthy = await db.isHealthy();

        res.status(dbHealthy ? 200 : 503).json({
          success: true,
          status: dbHealthy ? "healthy" : "degraded",
          service: "user-service",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || "development",
          database: dbHealthy ? "connected" : "disconnected",
          port: this.port,
        });
      } catch (error) {
        res.status(503).json({
          success: false,
          status: "unhealthy",
          service: "user-service",
          error: "Health check failed",
        });
      }
    });
  }

  private initializeRoutes(): void {
    const apiPrefix = process.env.API_PREFIX || "/api/v1";

    // Initialize route classes
    const authRoutes = new AuthRoutes();
    const userRoutes = new UserRoutes();

    // Mount routes
    this.app.use(`${apiPrefix}/auth`, authRoutes.getRouter());
    this.app.use(`${apiPrefix}/users`, userRoutes.getRouter());

    // Root endpoint
    this.app.get("/", (req: Request, res: Response) => {
      res.json({
        success: true,
        service: "wordle-user-service",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        endpoints: {
          auth: `${apiPrefix}/auth`,
          users: `${apiPrefix}/users`,
          health: "/health",
        },
      });
    });

    // 404 handler
    this.app.use("*", (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: "Endpoint not found",
        path: req.path,
        method: req.method,
        available_endpoints: {
          auth: `${apiPrefix}/auth`,
          users: `${apiPrefix}/users`,
          health: "/health",
        },
      });
    });
  }

  private initializeErrorHandling(): void {
    // Global error handler
    this.app.use(
      (error: any, req: Request, res: Response, next: NextFunction) => {
        console.error("Global error handler:", error);

        // JWT errors
        if (error.name === "JsonWebTokenError") {
          return res.status(401).json({
            success: false,
            error: "Invalid token",
            message: error.message,
          });
        }

        if (error.name === "TokenExpiredError") {
          return res.status(401).json({
            success: false,
            error: "Token expired",
            message: error.message,
          });
        }

        // Database errors
        if (error.code === "23505") {
          // PostgreSQL unique violation
          return res.status(409).json({
            success: false,
            error: "Resource already exists",
            message: "A record with this information already exists",
          });
        }

        // CORS errors
        if (error.message && error.message.includes("CORS")) {
          return res.status(403).json({
            success: false,
            error: "CORS policy violation",
            message: "Origin not allowed",
          });
        }

        // Default error response
        const statusCode = error.statusCode || error.status || 500;
        const message =
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : error.message;

        res.status(statusCode).json({
          success: false,
          error: "Server error",
          message: message,
          ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
        });
      }
    );

    // Unhandled promise rejection handler
    process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
      console.error(
        "Unhandled Promise Rejection at:",
        promise,
        "reason:",
        reason
      );
      // Don't exit the process in production, just log
      if (process.env.NODE_ENV !== "production") {
        process.exit(1);
      }
    });

    // Uncaught exception handler
    process.on("uncaughtException", (error: Error) => {
      console.error("Uncaught Exception:", error);
      // Graceful shutdown
      this.gracefulShutdown();
    });
  }

  private initializeCleanupTasks(): void {
    // Set up periodic cleanup of expired tokens and states
    const cleanupInterval = setInterval(async () => {
      try {
        await this.authService.cleanupExpiredTokens();
        console.log("Cleanup task completed successfully");
      } catch (error) {
        console.error("Cleanup task failed:", error);
      }
    }, 60 * 60 * 1000); // Run every hour

    // Clear interval on shutdown
    process.on("SIGTERM", () => clearInterval(cleanupInterval));
    process.on("SIGINT", () => clearInterval(cleanupInterval));
  }

  private async gracefulShutdown(): Promise<void> {
    console.log("Initiating graceful shutdown...");

    try {
      // Close database connections
      await db.close();
      console.log("Database connections closed");

      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  }

  public async start(): Promise<void> {
    try {
      // Test database connection and run migrations if needed
      if (process.env.NODE_ENV !== "production") {
        console.log("Running database migrations...");
        await db.migrate();
      }

      // Start server
      this.app.listen(this.port, () => {
        console.log(`
 User Service started successfully!
 Port: ${this.port}
 Environment: ${process.env.NODE_ENV || "development"}
 API Base: ${process.env.API_PREFIX || "/api/v1"}
 Health Check: http://localhost:${this.port}/health
 Endpoints:
   - Auth: http://localhost:${this.port}${
          process.env.API_PREFIX || "/api/v1"
        }/auth
   - Users: http://localhost:${this.port}${
          process.env.API_PREFIX || "/api/v1"
        }/users
        `);
      });

      // Graceful shutdown handlers
      process.on("SIGTERM", () => this.gracefulShutdown());
      process.on("SIGINT", () => this.gracefulShutdown());
    } catch (error) {
      console.error("Failed to start user service:", error);
      process.exit(1);
    }
  }
}

// Start the service
const userService = new UserService();
userService.start().catch((error) => {
  console.error("Failed to start user service:", error);
  process.exit(1);
});

export default UserService;
*/
