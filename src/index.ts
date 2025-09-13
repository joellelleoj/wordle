import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { UserRoutes } from "./routes/userRoutes";
import { GameRoutes } from "./routes/gameRoutes";
import { ProfileRoutes } from "./routes/ProfileRoutes";
import { authFilter } from "./middleware/authFilter";

dotenv.config();

class ApiGateway {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || "8002");
    this.initializeMiddlewares();
    this.initializeRoutes();
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

    // Root route with comprehensive service information
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
        microservices: {
          game_service: process.env.GAME_SERVICE_URL || "http://localhost:3002",
          user_service: process.env.USER_SERVICE_URL || "http://localhost:3003",
          profile_service:
            process.env.PROFILE_SERVICE_URL || "http://localhost:3004",
        },
        endpoints: {
          health: "/health",
          authentication: "/api/users/*",
          game: {
            create: "POST /api/game/new",
            guess: "POST /api/game/:gameId/guess",
            state: "GET /api/game/:gameId",
            stats: "GET /api/game/stats",
          },
          profile: {
            games: "GET/POST /api/profile/games",
            stats: "GET /api/profile/stats",
            posts: "GET/POST /api/profile/posts",
            albums: "GET/POST /api/profile/albums",
            search: "GET /api/profile/search/*",
            note: "All profile endpoints require authentication",
          },
        },
        features: {
          authentication: "JWT-based with mock tokens for development",
          gameRecording: "Automatic game saving for authenticated users",
          socialFeatures: "Posts and albums for sharing game achievements",
          statistics: "Comprehensive game statistics and streaks",
          wordValidation: "Dictionary-based word validation",
        },
      });
    });

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

    // Test CORS endpoint
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
          authentication: [
            "POST /api/users/auth/register",
            "POST /api/users/auth/login",
            "GET /api/users/auth/gitlab/login",
            "POST /api/users/auth/gitlab/callback",
            "POST /api/users/auth/logout",
            "POST /api/users/auth/refresh",
            "GET /api/users/auth/me",
          ],
          game: [
            "POST /api/game/new",
            "POST /api/game/:gameId/guess",
            "GET /api/game/:gameId",
            "GET /api/game/health",
          ],
          profile: [
            "POST /api/profile/games (auth required)",
            "GET /api/profile/games (auth required)",
            "GET /api/profile/stats (auth required)",
            "POST /api/profile/posts (auth required)",
            "GET /api/profile/posts (auth required)",
            "POST /api/profile/albums (auth required)",
          ],
          testing: [
            "GET /api/test - CORS test",
            "GET /api/test/auth - Authentication test",
          ],
        },
        tip: "Authentication is required for profile features. Use /api/users/auth/login to authenticate.",
      });
    });
  }

  public start(): void {
    this.app.listen(this.port, "0.0.0.0", () => {
      console.log(`🚀 Wordle API Gateway started successfully!`);
      console.log(`📍 Port: ${this.port}`);
      console.log(`🌐 Local: http://localhost:${this.port}`);
      console.log(`🧪 Test CORS: http://localhost:${this.port}/api/test`);
      console.log(`🔐 Test Auth: http://localhost:${this.port}/api/test/auth`);
      console.log(`❤️  Health: http://localhost:${this.port}/health`);
      console.log(``);
      console.log(`📋 Microservices Architecture:`);
      console.log(
        `   ├── Game Service: ${
          process.env.GAME_SERVICE_URL || "http://localhost:3002"
        }`
      );
      console.log(
        `   ├── User Service: ${
          process.env.USER_SERVICE_URL || "http://localhost:3003"
        }`
      );
      console.log(
        `   └── Profile Service: ${
          process.env.PROFILE_SERVICE_URL || "http://localhost:3004"
        }`
      );
      console.log(``);
      console.log(`🔧 Features Enabled:`);
      console.log(`   ✅ Authentication Filter (JWT + Mock tokens)`);
      console.log(`   ✅ Automatic Game Recording (authenticated users)`);
      console.log(`   ✅ Profile Management (games, stats, posts, albums)`);
      console.log(`   ✅ Cross-service Communication`);
      console.log(`   ✅ CORS Configuration`);
      console.log(``);
      console.log(`🎮 Game Flow:`);
      console.log(`   1. User plays game via /api/game/* endpoints`);
      console.log(
        `   2. If authenticated, completed games auto-save to profile`
      );
      console.log(`   3. Users can create posts/albums from saved games`);
      console.log(`   4. Statistics and streaks calculated automatically`);
      console.log(``);
      console.log(`🚦 Test Endpoints:`);
      console.log(`   📊 Health: GET /health`);
      console.log(`   🔐 Auth: GET /api/test/auth`);
      console.log(`   🌐 CORS: GET /api/test`);
      console.log(`   📖 Docs: GET / (service documentation)`);
    });
  }
}

const gateway = new ApiGateway();
gateway.start();

export default gateway;
