/**
 * Game Controller - HTTP Request Handler with Swagger Documentation
 *
 * This controller acts as the HTTP interface for the Wordle game service,
 * handling all REST API endpoints and coordinating between the business logic
 * layers (WordService and GameService).
 */

import { Request, Response } from "express";
import { WordService } from "../services/wordService";
import { GameService } from "../services/gameService";

interface AuthenticatedRequest extends Request {
  auth?: {
    isAuthenticated: boolean;
    user?: { id: string; username: string; email: string };
    token?: string;
  };
}

export class GameController {
  private wordService: WordService;
  private gameService: GameService;
  private initialized: boolean = false;

  constructor() {
    this.wordService = new WordService();
    this.gameService = new GameService();
    this.initializeServices();
  }

  private async initializeServices(): Promise<void> {
    try {
      await this.wordService.initialize();
      this.initialized = true;
      console.log("Game controller initialized successfully");
    } catch (error) {
      console.error("Failed to initialize game controller:", error);
      this.initialized = false;
    }
  }

  private async ensureInitialized(): Promise<boolean> {
    if (this.initialized) return true;

    const maxWait = 10000;
    const startTime = Date.now();

    while (!this.initialized && Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return this.initialized;
  }

  /**
   * @swagger
   * /game/new:
   *   post:
   *     summary: Create a new Wordle game
   *     responses:
   *       201:
   *         description: Game created successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - type: object
   *                   properties:
   *                     success:
   *                       type: boolean
   *                       example: true
   *                 - $ref: '#/components/schemas/GameState'
   *             example:
   *               success: true
   *               gameId: "game_1672531200000_abc123def"
   *               board: [["","","","",""],["","","","",""],["","","","",""],["","","","",""],["","","","",""],["","","","",""]]
   *               evaluations: [[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null]]
   *               currentRow: 0
   *               gameOver: false
   *               won: false
   *               attempts: 0
   *               guesses: []
   *       500:
   *         description: Server error or service not ready
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               error: "Failed to create game"
   *               message: "Word service initialization failed"
   *       503:
   *         description: Service not ready
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  createGame = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const isReady = await this.ensureInitialized();
      if (!isReady) {
        res.status(503).json({
          success: false,
          error: "Service not ready",
          message: "Game service is still initializing. Please try again.",
        });
        return;
      }

      const targetWord = this.wordService.getRandomWord();
      const userId = req.auth?.isAuthenticated ? req.auth.user?.id : undefined;

      const { gameId, publicState } = this.gameService.createGame(
        targetWord,
        userId
      );

      res.status(201).json({
        success: true,
        ...publicState,
      });
    } catch (error) {
      console.error("Failed to create game:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create game",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  /**
   * @swagger
   * /game/{gameId}/guess:
   *   post:
   *     summary: Submit a word guess
   *     parameters:
   *       - in: path
   *         name: gameId
   *         required: true
   *         description: Unique game identifier from game creation
   *         schema:
   *           type: string
   *           example: "game_1672531200000_abc123def"
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GuessRequest'
   *     responses:
   *       200:
   *         description: Guess processed successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/GuessResponse'
   *             examples:
   *               validGuess:
   *                 summary: Valid guess with evaluation
   *                 value:
   *                   success: true
   *                   valid: true
   *                   result: ["absent", "correct", "present", "correct", "absent"]
   *                   gameOver: false
   *                   won: false
   *                   gameState:
   *                     gameId: "game_1672531200000_abc123def"
   *                     currentRow: 1
   *                     attempts: 1
   *                     guesses: ["WORLD"]
   *               invalidWord:
   *                 summary: Invalid word not in dictionary
   *                 value:
   *                   valid: false
   *                   error: "Not a valid word"
   *               winningGuess:
   *                 summary: Winning guess ends game
   *                 value:
   *                   success: true
   *                   valid: true
   *                   result: ["correct", "correct", "correct", "correct", "correct"]
   *                   gameOver: true
   *                   won: true
   *                   solution: "STUDY"
   *                   message: "Congratulations! Game saved to your profile."
   *       400:
   *         description: Invalid request parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             examples:
   *               missingGuess:
   *                 summary: Missing guess in request body
   *                 value:
   *                   success: false
   *                   error: "Guess is required and must be a string"
   *               invalidGameId:
   *                 summary: Missing or invalid game ID
   *                 value:
   *                   success: false
   *                   error: "Game ID is required"
   *       404:
   *         description: Game not found or expired
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  submitGuess = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const isReady = await this.ensureInitialized();
      if (!isReady) {
        res.status(503).json({
          success: false,
          error: "Service not ready",
          message: "Game service is still initializing. Please try again.",
        });
        return;
      }

      const { gameId } = req.params;
      const { guess } = req.body;

      if (!gameId) {
        res.status(400).json({
          success: false,
          error: "Game ID is required",
        });
        return;
      }

      if (!guess || typeof guess !== "string") {
        res.status(400).json({
          success: false,
          error: "Guess is required and must be a string",
        });
        return;
      }

      if (!this.wordService.isValidWord(guess)) {
        res.status(200).json({
          valid: false,
          error: "Not a valid word",
        });
        return;
      }

      const authToken = req.auth?.isAuthenticated ? req.auth.token : undefined;
      const result = await this.gameService.submitGuess(
        gameId,
        guess,
        authToken
      );

      if (!result.valid) {
        res.status(200).json(result);
        return;
      }

      const response: any = {
        success: true,
        ...result,
      };

      if (result.gameOver && req.auth?.isAuthenticated) {
        response.message = result.won
          ? "Congratulations! Game saved to your profile."
          : "Game over! Your progress has been saved.";
      } else if (result.gameOver && !req.auth?.isAuthenticated) {
        response.message = result.won
          ? "Congratulations! Login to save your progress."
          : "Game over! Login to track your statistics.";
      }

      res.status(200).json(response);
    } catch (error) {
      console.error("Failed to submit guess:", error);
      res.status(500).json({
        success: false,
        error: "Failed to submit guess",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  /**
   * @swagger
   * /game/{gameId}:
   *   get:
   *     summary: Get current game state
   *     parameters:
   *       - in: path
   *         name: gameId
   *         required: true
   *         description: Unique game identifier
   *         schema:
   *           type: string
   *           example: "game_1672531200000_abc123def"
   *     responses:
   *       200:
   *         description: Game state retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - type: object
   *                   properties:
   *                     success:
   *                       type: boolean
   *                       example: true
   *                 - $ref: '#/components/schemas/GameState'
   *             example:
   *               success: true
   *               gameId: "game_1672531200000_abc123def"
   *               board: [["W","O","R","L","D"],["T","E","S","T","S"],["","","","",""],["","","","",""],["","","","",""],["","","","",""]]
   *               evaluations: [["absent","correct","present","correct","absent"],["present","absent","absent","present","correct"],[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null]]
   *               currentRow: 2
   *               gameOver: false
   *               won: false
   *               attempts: 2
   *               guesses: ["WORLD", "TESTS"]
   *       400:
   *         description: Missing or invalid game ID
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Game not found (may have expired)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               error: "Game not found"
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  getGameState = async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameId } = req.params;

      if (!gameId) {
        res.status(400).json({
          success: false,
          error: "Game ID is required",
        });
        return;
      }

      const publicState = this.gameService.getPublicGameState(gameId);

      if (!publicState) {
        res.status(404).json({
          success: false,
          error: "Game not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        ...publicState,
      });
    } catch (error) {
      console.error("Failed to get game state:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get game state",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  /**
   * @swagger
   * /admin/refresh-words:
   *   post:
   *     summary: Refresh word dictionary
   *     responses:
   *       200:
   *         description: Dictionary refreshed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Words refreshed successfully"
   *                 statistics:
   *                   type: object
   *                   properties:
   *                     totalWords:
   *                       type: integer
   *                       example: 12972
   *                     initialized:
   *                       type: boolean
   *                       example: true
   *                     lastRefresh:
   *                       type: string
   *                       format: date-time
   *                       example: "2025-01-15T10:30:00.000Z"
   *       500:
   *         description: Failed to refresh dictionary
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  refreshWords = async (_req: Request, res: Response): Promise<void> => {
    try {
      await this.wordService.refreshWords();
      const stats = this.wordService.getStatistics();

      res.status(200).json({
        success: true,
        message: "Words refreshed successfully",
        statistics: stats,
      });
    } catch (error) {
      console.error("Failed to refresh words:", error);
      res.status(500).json({
        success: false,
        error: "Failed to refresh words",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Service health check
   *     responses:
   *       200:
   *         description: Service is healthy and operational
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthResponse'
   *             example:
   *               status: "healthy"
   *               service: "wordle-game-service"
   *               version: "1.0.0"
   *               timestamp: "2025-01-15T10:30:00.000Z"
   *               uptime: 3600
   *               environment: "production"
   *               services:
   *                 wordService:
   *                   initialized: true
   *                   wordCount: 12972
   *                 gameService:
   *                   activeGames: 15
   *               endpoints: ["POST /game/new", "POST /game/:gameId/guess", "GET /game/:gameId", "GET /health"]
   *       500:
   *         description: Service is unhealthy or experiencing issues
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: "unhealthy"
   *                 service:
   *                   type: string
   *                   example: "wordle-game-service"
   *                 error:
   *                   type: string
   *                   example: "Word service initialization failed"
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   */
  healthCheck = async (_req: Request, res: Response): Promise<void> => {
    try {
      const wordStats = this.wordService.getStatistics();
      const gameCount = this.gameService.getGameCount();

      res.status(200).json({
        status: "healthy",
        service: "wordle-game-service",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
        services: {
          wordService: {
            initialized: wordStats.initialized,
            wordCount: wordStats.totalWords,
          },
          gameService: {
            activeGames: gameCount,
          },
        },
        endpoints: [
          "POST /game/new",
          "POST /game/:gameId/guess",
          "GET /game/:gameId",
          "GET /health",
        ],
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({
        status: "unhealthy",
        service: "wordle-game-service",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  };

  public cleanup(): void {
    this.gameService.cleanup();
  }
}
