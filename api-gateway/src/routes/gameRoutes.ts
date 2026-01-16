import { Router, Request, Response } from "express";
import axios from "axios";

export class GameRoutes {
  private router: Router;
  private gameServiceUrl: string;

  constructor() {
    this.router = Router();
    this.gameServiceUrl =
      process.env.GAME_SERVICE_URL || "http://localhost:3002";
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/new", this.createGame.bind(this));
    this.router.post("/:gameId/guess", this.submitGuess.bind(this));
    this.router.get("/:gameId", this.getGameState.bind(this));
    this.router.get("/health", this.healthCheck.bind(this));
    this.router.post("/admin/refresh-words", this.refreshWords.bind(this));
    this.router.get("/admin/stats", this.getStats.bind(this));
  }

  /**
   * @swagger
   * /api/game/new:
   *   post:
   *     summary: Create a new Wordle game
   *     tags: [Game]
   *     responses:
   *       200:
   *         description: Game created successfully
   *       503:
   *         description: Game service unavailable
   */
  private async createGame(req: Request, res: Response): Promise<void> {
    try {
      console.log(
        `Forwarding create game request to: ${this.gameServiceUrl}/game/new`
      );
      const response = await axios.post(
        `${this.gameServiceUrl}/game/new`,
        {},
        {
          timeout: 10000,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      console.log(
        "Game Service Response:",
        response.status,
        response.statusText
      );
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error("Error forwarding create game request:", error.message);
      this.handleServiceError(error, res, "create game");
    }
  }

  /**
   * @swagger
   * /api/game/{gameId}/guess:
   *   post:
   *     summary: Submit a guess for a game
   *     tags: [Game]
   *     parameters:
   *       - in: path
   *         name: gameId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               guess:
   *                 type: string
   *                 example: "HELLO"
   *     responses:
   *       200:
   *         description: Guess processed successfully
   *       400:
   *         description: Invalid guess
   */
  private async submitGuess(req: Request, res: Response): Promise<void> {
    try {
      const { gameId } = req.params;
      const { guess } = req.body;
      if (!gameId) {
        res.status(400).json({
          success: false,
          error: "Game ID required",
        });
        return;
      }
      if (!guess || typeof guess !== "string") {
        res.status(400).json({
          success: false,
          error: "Valid guess required",
        });
        return;
      }
      console.log(`Forwarding guess submission for game ${gameId}: ${guess}`);
      const response = await axios.post(
        `${this.gameServiceUrl}/game/${gameId}/guess`,
        { guess: guess.toUpperCase() },
        {
          timeout: 10000,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );
      console.log("Game Service Guess Response:", response.status);
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error("Error forwarding guess submission:", error.message);
      this.handleServiceError(error, res, "submit guess");
    }
  }

  /**
   * @swagger
   * /api/game/{gameId}:
   *   get:
   *     summary: Get game state
   *     tags: [Game]
   *     parameters:
   *       - in: path
   *         name: gameId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Game state retrieved successfully
   *       400:
   *         description: Invalid game ID
   *       404:
   *         description: Game not found
   */
  private async getGameState(req: Request, res: Response): Promise<void> {
    try {
      const { gameId } = req.params;
      if (!gameId) {
        res.status(400).json({
          success: false,
          error: "Game ID required",
        });
        return;
      }
      console.log(`Forwarding game state request for game ${gameId}`);
      const response = await axios.get(
        `${this.gameServiceUrl}/game/${gameId}`,
        {
          timeout: 5000,
          headers: {
            Accept: "application/json",
          },
        }
      );
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error("Error forwarding game state request:", error.message);
      this.handleServiceError(error, res, "get game state");
    }
  }

  /**
   * @swagger
   * /api/game/health:
   *   get:
   *     summary: Game service health check
   *     tags: [Game]
   *     responses:
   *       200:
   *         description: Game service is healthy
   *       503:
   *         description: Game service is unhealthy
   */
  private async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const gameHealthResponse = await axios.get(
        `${this.gameServiceUrl}/health`,
        { timeout: 5000 }
      );
      res.json({
        service: "api-gateway-game-routes",
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
        dependencies: {
          gameService: {
            status: "healthy",
            url: this.gameServiceUrl,
            response: gameHealthResponse.data,
          },
        },
      });
    } catch (error: any) {
      console.error("Game service health check failed:", error.message);
      res.status(503).json({
        service: "api-gateway-game-routes",
        status: "degraded",
        timestamp: new Date().toISOString(),
        error: error.message,
        dependencies: {
          gameService: {
            status: "unhealthy",
            url: this.gameServiceUrl,
            error: error.message,
          },
        },
      });
    }
  }

  private async refreshWords(req: Request, res: Response): Promise<void> {
    try {
      console.log("Forwarding word refresh request to game service");
      const response = await axios.post(
        `${this.gameServiceUrl}/admin/refresh-words`,
        {},
        {
          timeout: 30000,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error("Error forwarding word refresh request:", error.message);
      this.handleServiceError(error, res, "refresh words");
    }
  }

  private async getStats(req: Request, res: Response): Promise<void> {
    try {
      const response = await axios.get(`${this.gameServiceUrl}/stats`, {
        timeout: 5000,
      });
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error("Error forwarding stats request:", error.message);
      this.handleServiceError(error, res, "get statistics");
    }
  }

  private handleServiceError(
    error: any,
    res: Response,
    operation: string
  ): void {
    if (error.response) {
      console.log(
        `Game service error for ${operation}:`,
        error.response.status,
        error.response.data
      );
      res.status(error.response.status).json(error.response.data);
    } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      // Game service is not running
      console.error(
        `Game service unavailable for ${operation}:`,
        error.message
      );
      res.status(503).json({
        success: false,
        error: "Game service unavailable",
        details: `Cannot connect to game service at ${this.gameServiceUrl}`,
        operation: operation,
      });
    } else if (error.code === "ETIMEDOUT") {
      // Timeout
      res.status(504).json({
        success: false,
        error: "Game service timeout",
        details: `Request to game service timed out`,
        operation: operation,
      });
    } else {
      // Other errors
      console.error(`Unexpected error for ${operation}:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to ${operation}`,
        details: error.message,
      });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}
