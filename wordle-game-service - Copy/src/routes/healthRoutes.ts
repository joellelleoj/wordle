import { Router, Request, Response } from "express";
import { DictionaryService } from "../services/DictionaryService";

export const createHealthRoutes = (
  dictionaryService: DictionaryService
): Router => {
  const router = Router();

  // Basic health check
  router.get("/", (req: Request, res: Response) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "wordle-game-service",
      version: process.env.SERVICE_VERSION || "1.0.0",
    });
  });

  // Detailed health check
  router.get("/detailed", async (req: Request, res: Response) => {
    try {
      const dictionarySize = dictionaryService.getDictionarySize();

      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "wordle-game-service",
        version: process.env.SERVICE_VERSION || "1.0.0",
        checks: {
          dictionary: {
            status: dictionarySize > 0 ? "healthy" : "unhealthy",
            wordCount: dictionarySize,
          },
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            unit: "MB",
          },
          uptime: Math.round(process.uptime()),
        },
      });
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
      });
    }
  });

  return router;
};
