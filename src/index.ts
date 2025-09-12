// user-service/src/index.ts - Enhanced with Swagger documentation
import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AuthRoutes } from "./routes/authRoutes";
import { dbConnection } from "./database/connection";
import { swaggerSetup } from "./swagger/swagger";

dotenv.config();

/**
 * @swagger
 * /:
 *   get:
 *     summary: Service root endpoint
 *     tags: [Service Info]
 *     description: Returns basic information about the User Service
 *     responses:
 *       200:
 *         description: Service information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   type: string
 *                   example: "Wordle User Service"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 status:
 *                   type: string
 *                   example: "running"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     auth:
 *                       type: string
 *                       example: "/api/v1/auth"
 *                     health:
 *                       type: string
 *                       example: "/health"
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Service health check
 *     tags: [Health]
 *     description: Returns the health status of the User Service and database connection
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       503:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   type: string
 *                   example: "User Service"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 status:
 *                   type: string
 *                   example: "unhealthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 database:
 *                   type: string
 *                   example: "disconnected"
 *                 error:
 *                   type: string
 *                   example: "Database connection failed"
 */

class UserService {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || "3003");
    this.initializeMiddlewares();
    this.setupSwagger();
    this.initializeRoutes();
    this.setupErrorHandling();
  }

  private initializeMiddlewares(): void {
    const corsOptions = {
      origin: [
        "http://localhost:3000", // Frontend development
        "http://127.0.10.11:8080", // Production frontend
        "https://devstud.imn.htwk-leipzig.de", // Production domain
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

  private setupSwagger(): void {
    // Initialize Swagger documentation
    swaggerSetup.setupSwagger(this.app);
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
          documentation: "/api-docs",
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
          "GET /api-docs (Swagger UI)",
          "GET /api-docs.json (OpenAPI spec)",
          "GET /api/v1/auth/gitlab/login",
          "ALL /api/v1/auth/callback",
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
      console.log(" Database connection successful:", result.status);
    } catch (error) {
      console.error(" Database connection failed:", error);
      throw new Error("Unable to connect to database");
    }
  }

  public async start(): Promise<void> {
    try {
      // Test database connection
      await this.testDatabaseConnection();

      this.app.listen(this.port, "0.0.0.0", () => {
        console.log(` User Service running on port ${this.port}`);
        console.log(` Environment: ${process.env.NODE_ENV || "development"}`);
        console.log(` Health check: http://localhost:${this.port}/health`);
        console.log(
          ` API Documentation: http://localhost:${this.port}/api-docs`
        );
        console.log(
          ` OpenAPI Spec: http://localhost:${this.port}/api-docs.json`
        );
        console.log(` Auth endpoints:`);
        console.log(
          `   GET http://localhost:${this.port}/api/v1/auth/gitlab/login`
        );
        console.log(
          `   ALL http://localhost:${this.port}/api/v1/auth/callback`
        );
        console.log(`   POST http://localhost:${this.port}/api/v1/auth/login`);
        console.log(
          `   POST http://localhost:${this.port}/api/v1/auth/register`
        );
        console.log(`   GET http://localhost:${this.port}/api/v1/auth/me`);
        console.log(`\n User Service started successfully!`);
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
