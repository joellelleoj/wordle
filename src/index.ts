import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import { GameController } from "./controllers/gameController";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

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
const gameController = new GameController();

// Routes
app.post("/game/new", gameController.createGame);
app.post("/game/:gameId/guess", gameController.submitGuess);
app.get("/game/:gameId", gameController.getGameState);
app.get("/health", gameController.healthCheck);
app.get("/stats", gameController.getStatistics);
app.post("/admin/refresh-words", gameController.refreshWords);

// Error handling middleware
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
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
  res.status(404).json({ error: "Endpoint not found" });
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

// Single app.listen call
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Game Service running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

export default app;

/*import express from "express";
import cors from "cors";
import gameController from "./controllers/gameController";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Test route
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "game-service" });
});

// Game routes
app.post("/game", gameController.createGame);
app.post("/game/:gameId/guess", gameController.submitGuess);
app.get("/game/:gameId", gameController.getGameState);

app.listen(PORT, () => {
  console.log(`Game Service running on port ${PORT}`);
});

export default app;
*/
