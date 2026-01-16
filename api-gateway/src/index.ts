import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { UserRoutes } from "./routes/userRoutes";
import { GameRoutes } from "./routes/gameRoutes";
import { ProfileRoutes } from "./routes/ProfileRoutes";
import { authFilter } from "./middleware/authFilter";
import { setupSwagger } from "./swagger";

dotenv.config();

class ApiGateway {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || "8002");
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeSwagger();
    this.setupErrorHandling();
  }

  private initializeMiddlewares(): void {
    const corsOptions = {
      origin: [
        "http://localhost:3000",
        "http://127.0.10.11:8080",
        "https://devstud.imn.htwk-leipzig.de",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
      ],
      credentials: true,
      optionsSuccessStatus: 200,
    };

    this.app.use(cors(corsOptions));
    this.app.options("*", cors(corsOptions));
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Add authentication filter to all requests
    this.app.use(authFilter);

    // Request logging
    this.app.use((req: Request, res: Response, next) => {
      const authStatus = req.auth?.isAuthenticated
        ? `authenticated as ${req.auth.user?.username}`
        : "anonymous";

      console.log(
        `${new Date().toISOString()} - ${req.method} ${
          req.url
        } (${authStatus}) from ${req.headers.origin || "unknown"}`
      );
      next();
    });
  }

  private initializeSwagger(): void {
    // Setup Swagger documentation
    setupSwagger(this.app);
  }

  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Health check endpoint
   *     tags: [System]
   *     responses:
   *       200:
   *         description: Gateway is healthy
   */
  private initializeRoutes(): void {
    // Health check
    this.app.get("/health", (req: Request, res: Response) => {
      res.status(200).json({
        service: "API Gateway",
        status: "healthy",
        timestamp: new Date().toISOString(),
        port: this.port,
        environment: process.env.NODE_ENV || "development",
        authentication: {
          filterEnabled: true,
          currentUser: req.auth?.isAuthenticated
            ? req.auth.user?.username
            : null,
        },
      });
    });

    // User service routes (authentication)
    const userRoutes = new UserRoutes();
    this.app.use("/api/users", userRoutes.getRouter());

    // Game service routes (with auth context passed through)
    const gameRoutes = new GameRoutes();
    this.app.use("/api/game", gameRoutes.getRouter());

    // Profile service routes (requires authentication)
    const profileRoutes = new ProfileRoutes();
    this.app.use("/api/profile", profileRoutes.getRouter());

    /**
     * @swagger
     * /:
     *   get:
     *     summary: Get API Gateway service information
     *     tags: [Gateway Info]
     *     responses:
     *       200:
     *         description: Service information
     */
    // Root route
    this.app.get("/", (req: Request, res: Response) => {
      res.json({
        service: "Wordle API Gateway",
        version: "1.0.0",
        port: this.port,
        status: "running",
        timestamp: new Date().toISOString(),
        authentication: {
          currentUser: req.auth?.isAuthenticated
            ? {
                username: req.auth.user?.username,
                id: req.auth.user?.id,
              }
            : null,
          status: req.auth?.isAuthenticated ? "authenticated" : "anonymous",
        },
        endpoints: {
          health: "/health",
          documentation: "GET /api-docs",
        },
      });
    });

    /**
     * @swagger
     * /api/test/auth:
     *   get:
     *     summary: Test authentication status
     *     tags: [Testing]
     *     responses:
     *       200:
     *         description: Authentication status
     */
    // Test authentication endpoint
    this.app.get("/api/test/auth", (req: Request, res: Response) => {
      res.json({
        success: true,
        authentication: {
          isAuthenticated: req.auth?.isAuthenticated || false,
          user: req.auth?.user || null,
          timestamp: new Date().toISOString(),
        },
        message: req.auth?.isAuthenticated
          ? `Hello ${req.auth.user?.username}! You are authenticated.`
          : "You are not authenticated. Some features may be limited.",
      });
    });

    /**
     * @swagger
     * /api/test:
     *   get:
     *     summary: Test CORS functionality
     *     tags: [Testing]
     *     responses:
     *       200:
     *         description: CORS test successful
     */
    this.app.get("/api/test", (req: Request, res: Response) => {
      res.json({
        message: "CORS is working!",
        origin: req.headers.origin,
        timestamp: new Date().toISOString(),
        authentication: req.auth?.isAuthenticated
          ? "authenticated"
          : "anonymous",
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
      console.error("API Gateway error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
        timestamp: new Date().toISOString(),
      });
    });

    this.app.use("*", (req: Request, res: Response) => {
      console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString(),
        availableRoutes: {
          health: "GET /health",
        },
      });
    });
  }

  public start(): void {
    this.app.listen(this.port, "0.0.0.0", () => {
      console.log(`Wordle API Gateway started successfully!`);
      console.log(`Local: http://localhost:${this.port}`);
      console.log(`Health: http://localhost:${this.port}/health`);
      console.log(`Documentation: http://127.0.10.11:${this.port}/api-docs`);
      console.log(``);
    });
  }

  public getApp(): Application {
    return this.app;
  }
}

const gateway = new ApiGateway();
if (process.env.NODE_ENV !== "test") {
  gateway.start();
}

export default gateway;
