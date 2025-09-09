// api-gateway/src/routes/GameRoutes.ts - Forwards to Game Service
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
    // Create new game - Forward to Game Service
    this.router.post("/new", this.createGame.bind(this));

    // Submit guess - Forward to Game Service
    this.router.post("/:gameId/guess", this.submitGuess.bind(this));

    // Get game state - Forward to Game Service
    this.router.get("/:gameId", this.getGameState.bind(this));

    // Health check that includes game service
    this.router.get("/health", this.healthCheck.bind(this));

    // Admin endpoints
    this.router.post("/admin/refresh-words", this.refreshWords.bind(this));
    this.router.get("/admin/stats", this.getStats.bind(this));
  }

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
          timeout: 30000, // Word refresh might take longer
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
      // Game service responded with an error
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

/*import { Router } from "express";
import axios from "axios";

const router = Router();

// Use environment variables for service discovery
const GAME_SERVICE_URL =
  process.env.GAME_SERVICE_URL || "http://game-service:3001";
const DATA_ACCESS_SERVICE_URL =
  process.env.DATA_ACCESS_SERVICE_URL || "http://data-access-service:3002";

// Create new game
router.post("/new", async (req, res) => {
  try {
    console.log("Creating game via API Gateway");
    const response = await axios.post(`${GAME_SERVICE_URL}/game`);
    res.json(response.data);
  } catch (error: any) {
    console.error("Error creating game:", error.message);
    res.status(500).json({ error: "Failed to create game" });
  }
});

// Submit guess
router.post("/:gameId/guess", async (req, res) => {
  try {
    const { gameId } = req.params;
    const { guess } = req.body;

    if (!gameId) {
      return res.status(400).json({ error: "Game ID required" });
    }

    if (!guess || typeof guess !== "string") {
      return res.status(400).json({ error: "Valid guess required" });
    }

    const response = await axios.post(
      `${GAME_SERVICE_URL}/game/${gameId}/guess`,
      { guess: guess.toUpperCase() }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error("Error submitting guess:", error.message);
    if (error.response?.status === 404) {
      res.status(404).json({ error: "Game not found" });
    } else {
      res.status(500).json({ error: "Failed to submit guess" });
    }
  }
});

// Get game state
router.get("/:gameId", async (req, res) => {
  try {
    const { gameId } = req.params;

    if (!gameId) {
      return res.status(400).json({ error: "Game ID required" });
    }

    const response = await axios.get(`${GAME_SERVICE_URL}/game/${gameId}`);
    res.json(response.data);
  } catch (error: any) {
    console.error("Error getting game:", error.message);
    if (error.response?.status === 404) {
      res.status(404).json({ error: "Game not found" });
    } else {
      res.status(500).json({ error: "Failed to get game state" });
    }
  }
});

// Word validation endpoint - proxies to data access service
router.post("/validate", async (req, res) => {
  try {
    const { word } = req.body;

    if (!word || typeof word !== "string") {
      return res.status(400).json({ error: "Word required" });
    }

    const response = await axios.post(
      `${DATA_ACCESS_SERVICE_URL}/words/validate`,
      {
        word: word.toUpperCase(),
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error("Error validating word:", error.message);
    res.status(500).json({ error: "Failed to validate word" });
  }
});

// Get random word endpoint - proxies to data access service
router.get("/word/random", async (req, res) => {
  try {
    const response = await axios.get(`${DATA_ACCESS_SERVICE_URL}/words/random`);
    res.json(response.data);
  } catch (error: any) {
    console.error("Error getting random word:", error.message);
    res.status(500).json({ error: "Failed to get random word" });
  }
});

// Health check that verifies all downstream services
router.get("/health", async (req, res) => {
  try {
    const gameHealthPromise = axios.get(`${GAME_SERVICE_URL}/health`);
    const dataHealthPromise = axios.get(`${DATA_ACCESS_SERVICE_URL}/health`);

    const [gameHealth, dataHealth] = await Promise.all([
      gameHealthPromise,
      dataHealthPromise,
    ]);

    res.json({
      status: "ok",
      services: {
        gameService: gameHealth.data,
        dataAccessService: dataHealth.data,
      },
    });
  } catch (error: any) {
    console.error("Health check failed:", error.message);
    res.status(503).json({
      status: "degraded",
      error: error.message,
    });
  }
});

export default router; /*import { Router } from "express";
import axios from "axios";

const router = Router();
// Change this to localhost for local testing
const GAME_SERVICE_URL =
  process.env.GAME_SERVICE_URL || "http://localhost:3001";

// Create new game
router.post("/new", async (req, res) => {
  try {
    console.log("Creating game at:", `${GAME_SERVICE_URL}/game`);
    const response = await axios.post(`${GAME_SERVICE_URL}/game`);
    res.json(response.data);
  } catch (error: any) {
    console.error("Error creating game:", error.message);
    res.status(500).json({ error: "Failed to create game" });
  }
});

// Submit guess
router.post("/:gameId/guess", async (req, res) => {
  try {
    const { gameId } = req.params;
    const { guess } = req.body;

    const response = await axios.post(
      `${GAME_SERVICE_URL}/game/${gameId}/guess`,
      { guess }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error("Error submitting guess:", error.message);
    res.status(500).json({ error: "Failed to submit guess" });
  }
});

// Get game state
router.get("/:gameId", async (req, res) => {
  try {
    const { gameId } = req.params;
    const response = await axios.get(`${GAME_SERVICE_URL}/game/${gameId}`);
    res.json(response.data);
  } catch (error: any) {
    console.error("Error getting game:", error.message);
    res.status(500).json({ error: "Failed to get game state" });
  }
});

export default router;
*/
