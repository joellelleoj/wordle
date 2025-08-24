import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { gameRoutes } from "./routes/gameRoutes";
import { dictionaryRoutes } from "./routes/dictionaryRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ],
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP",
});
app.use("/api/", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Logging middleware
app.use(requestLogger);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "game-service",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/game", gameRoutes);
app.use("/api/dictionary", dictionaryRoutes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🎮 Game Service running on port ${PORT}`);
  console.log(`📚 Dictionary initialization starting...`);
});

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { HybridDictionaryService } from "./services/DictionaryService";
import { GameLogicService } from "./services/GameLogicService";
import { InMemoryGameRepository } from "./repositories/GameRepository";
import { GameController } from "./controllers/GameController";
import { createGameRoutes } from "./routes/gameRoutes";
import { createHealthRoutes } from "./routes/healthRoutes";

export class GameServiceApp {
  private app: express.Application;
  private dictionaryService: HybridDictionaryService;
  private gameLogicService: GameLogicService;
  private gameRepository: InMemoryGameRepository;
  private gameController: GameController;

  constructor() {
    this.app = express();
    this.setupServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupServices(): void {
    // Initialize services
    this.dictionaryService = new HybridDictionaryService(process.env.REDIS_URL);
    this.gameLogicService = new GameLogicService(this.dictionaryService);
    this.gameRepository = new InMemoryGameRepository();
    this.gameController = new GameController(
      this.gameLogicService,
      this.gameRepository,
      this.dictionaryService
    );
  }

  private setupMiddleware(): void {
    // Security
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
      })
    );

    // CORS - Allow requests from API Gateway and frontend
    this.app.use(
      cors({
        origin: [
          "http://127.0.10.11:8080", // Frontend
          "http://127.0.10.11:8082", // API Gateway
          "http://localhost:3000", // Development frontend
          "http://localhost:8082", // Development API Gateway
          "https://devstud.imn.htwk-leipzig.de", // Production domain
        ],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      })
    );

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: "Too many requests from this IP, please try again later.",
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // Stricter rate limiting for guess endpoint
    const guessLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // 10 guesses per minute max
      message: {
        error: "Too many guesses, please slow down.",
      },
    });

    // Body parsing
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(
        `${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${
          req.ip
        }`
      );
      next();
    });

    // Apply guess rate limiter to specific route
    this.app.use("/game/guess", guessLimiter);
  }

  private setupRoutes(): void {
    // Health check routes
    this.app.use("/health", createHealthRoutes(this.dictionaryService));

    // Game routes
    this.app.use("/game", createGameRoutes(this.gameController));

    // Dictionary routes (alternative path)
    this.app.use("/dict", createGameRoutes(this.gameController));

    // API documentation route
    this.app.get("/api-docs", (req, res) => {
      res.json({
        service: "Wordle Game Service",
        version: "1.0.0",
        endpoints: {
          health: {
            "GET /health": "Basic health check",
            "GET /health/detailed": "Detailed health information",
          },
          game: {
            "POST /game/start": "Start a new game (requires auth)",
            "POST /game/guess": "Submit a guess (requires auth)",
            "GET /game/current": "Get current active game (requires auth)",
            "GET /game/history": "Get game history (requires auth)",
          },
          dictionary: {
            "POST /dict/validate": "Validate a word (public)",
            "GET /dict/stats": "Get dictionary statistics (public)",
          },
        },
        authentication: {
          type: "Bearer Token",
          header: "Authorization: Bearer <jwt-token>",
        },
      });
    });

    // Root route
    this.app.get("/", (req, res) => {
      res.json({
        service: "Wordle Game Service",
        status: "running",
        version: "1.0.0",
        docs: "/api-docs",
        health: "/health",
      });
    });

    // 404 handler
    this.app.use("*", (req, res) => {
      res.status(404).json({
        error: "Endpoint not found",
        availableEndpoints: [
          "GET /",
          "GET /health",
          "GET /api-docs",
          "POST /game/start",
          "POST /game/guess",
          "GET /game/current",
          "GET /game/history",
          "POST /dict/validate",
          "GET /dict/stats",
        ],
      });
    });
  }

  private setupErrorHandling(): void {
    // Error handling middleware
    this.app.use(
      (
        error: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        console.error("Unhandled error:", error);

        // JWT errors
        if (error.name === "JsonWebTokenError") {
          res.status(401).json({ error: "Invalid token" });
          return;
        }

        if (error.name === "TokenExpiredError") {
          res.status(401).json({ error: "Token expired" });
          return;
        }

        // Validation errors
        if (error.name === "ValidationError") {
          res.status(400).json({
            error: "Validation failed",
            details: error.message,
          });
          return;
        }

        // Default error
        res.status(500).json({
          error: "Internal server error",
          ...(process.env.NODE_ENV === "development" && {
            details: error.message,
            stack: error.stack,
          }),
        });
      }
    );
  }

  async initialize(): Promise<void> {
    try {
      console.log("🔄 Initializing Game Service...");

      // Initialize dictionary service
      await this.dictionaryService.initialize();

      console.log("✅ Game Service initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Game Service:", error);
      throw error;
    }
  }

  getApp(): express.Application {
    return this.app;
  }

  async close(): Promise<void> {
    console.log("🔄 Shutting down Game Service...");

    try {
      await this.dictionaryService.close();
      console.log("✅ Game Service shut down successfully");
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
    }
  }
}
