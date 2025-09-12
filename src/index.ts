import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import { GameController } from "./controllers/gameController";
import { setupSwagger } from "./swagger/swagger";

dotenv.config();

const app = express();
const PORT = process.env.PORT;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for Swagger UI
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.10.11:8080",
      "https://devstud.imn.htwk-leipzig.de",
    ],
    credentials: true,
  })
);

app.use(compression());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

setupSwagger(app);

const gameController = new GameController();

app.post("/game/new", gameController.createGame);
app.post("/game/:gameId/guess", gameController.submitGuess);
app.get("/game/:gameId", gameController.getGameState);

app.get("/health", gameController.healthCheck);
app.post("/admin/refresh-words", gameController.refreshWords);

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Game service error:", err);
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
  });
});

let server: any = null;

if (process.env.NODE_ENV !== "test") {
  server = app.listen(PORT, () => {
    console.log(`Game Service running on port ${PORT}`);
    console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down ...`);

  if (gameController && typeof gameController.cleanup === "function") {
    gameController.cleanup();
  }

  if (server) {
    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
