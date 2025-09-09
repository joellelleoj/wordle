// profile-service/src/index.ts - Cleaned for game albums only
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import { ProfileController } from "./controllers/ProfileController";
import { authMiddleware } from "./middleware/authMiddleware";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);
app.use(compression());
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Initialize controller
const profileController = new ProfileController();

// Health check (no auth required)
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "profile-service",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    features: [
      "game-recording",
      "statistics",
      "game-albums",
      "game-visualization",
    ],
  });
});

// Protected routes - require authentication
app.use("/api", authMiddleware);

// === GAME RECORDING ROUTES ===
app.post("/api/games", profileController.saveGame);
app.get("/api/games", profileController.getUserGames);

// === USER STATISTICS ===
app.get("/api/stats", profileController.getUserStats);

// === GAME ALBUM ROUTES ===
app.post("/api/albums", profileController.createAlbum);
app.get("/api/albums", profileController.getUserAlbums);
app.get("/api/albums/:albumId", profileController.getAlbumById);
app.put("/api/albums/:albumId", profileController.updateAlbum);
app.delete("/api/albums/:albumId", profileController.deleteAlbum);

// Album-Game relationship management
app.post(
  "/api/albums/:albumId/games/:gameId",
  profileController.addGameToAlbum
);
app.delete(
  "/api/albums/:albumId/games/:gameId",
  profileController.removeGameFromAlbum
);

// === GAME VISUALIZATION ENDPOINT ===
app.get(
  "/api/games/:gameId/visualization",
  profileController.getGameVisualization
);

// Error handling middleware
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Profile service error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Something went wrong",
    });
  }
);

// 404 handler
app.use("*", (_req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    availableEndpoints: {
      public: ["GET /health"],
      authenticated: [
        "POST /api/games - Record completed game",
        "GET /api/games - Get user's game history",
        "GET /api/stats - Get user statistics",
        "POST /api/albums - Create game album",
        "GET /api/albums - Get user's albums",
        "GET /api/albums/:albumId - Get album with games",
        "PUT /api/albums/:albumId - Update album",
        "DELETE /api/albums/:albumId - Delete album",
        "POST /api/albums/:albumId/games/:gameId - Add game to album",
        "DELETE /api/albums/:albumId/games/:gameId - Remove game from album",
        "GET /api/games/:gameId/visualization - Get game visualization",
      ],
    },
    note: "All /api/* routes require authentication with Bearer token",
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`🔗 Profile Service running on port ${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 All /api/* routes require authentication`);
    console.log(`🎮 Game Recording: /api/games`);
    console.log(`📊 Statistics: /api/stats`);
    console.log(`📚 Game Albums: /api/albums`);
    console.log(`🎨 Game Visualization: /api/games/:gameId/visualization`);
    console.log(`✨ Features: Game history, stats, and picture albums`);
  });
}

export default app;
