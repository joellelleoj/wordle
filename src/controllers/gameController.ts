import { Request, Response } from "express";
import { WordService } from "../services/wordService";
import { GameService } from "../services/gameService";

// Extend Request interface to include auth context from API Gateway
interface AuthenticatedRequest extends Request {
  auth?: {
    isAuthenticated: boolean;
    user?: {
      id: string;
      username: string;
      email: string;
    };
    token?: string;
  };
}

export class GameController {
  private wordService: WordService;
  private gameService: GameService;

  constructor() {
    this.wordService = new WordService();
    this.gameService = new GameService();
    this.initializeServices();

    // Setup periodic cleanup
    setInterval(() => {
      this.gameService.cleanupOldGames();
    }, 60 * 60 * 1000); // Cleanup every hour
  }

  private async initializeServices(): Promise<void> {
    try {
      await this.wordService.initialize();
      console.log("Game controller services initialized successfully");
    } catch (error) {
      console.error("Failed to initialize game controller services:", error);
    }
  }

  // POST /game/new - Create a new game
  createGame = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const targetWord = this.wordService.getRandomWord();

      // Extract user ID if authenticated (from API Gateway auth filter)
      const userId = req.auth?.isAuthenticated ? req.auth.user?.id : undefined;

      const { gameId, publicState } = this.gameService.createGame(
        targetWord,
        userId
      );

      console.log(
        `New game created: ${gameId} (word: ${targetWord}) for user: ${
          userId || "anonymous"
        }`
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

  // POST /game/:gameId/guess - Submit a guess
  submitGuess = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
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

      // Validate the word exists in our dictionary
      if (!this.wordService.isValidWord(guess)) {
        res.status(200).json({
          valid: false,
          error: "Not a valid word",
        });
        return;
      }

      // Get auth token to pass to game service for profile recording
      const authToken = req.auth?.isAuthenticated ? req.auth.token : undefined;

      // Submit guess to game service (now with auth token for profile integration)
      const result = await this.gameService.submitGuess(
        gameId,
        guess,
        authToken
      );

      if (!result.valid) {
        res.status(200).json(result);
        return;
      }

      // Enhanced response with user context
      const response: any = {
        success: true,
        ...result,
      };

      // Add helpful messages for authenticated users
      if (result.gameOver && req.auth?.isAuthenticated) {
        if (result.won) {
          response.message = "Congratulations! Game saved to your profile.";
        } else {
          response.message = "Game over! Your progress has been saved.";
        }
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

  // GET /game/:gameId - Get game state
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

  // GET /stats - Get service statistics
  getStatistics = async (_req: Request, res: Response): Promise<void> => {
    try {
      const wordStats = this.wordService.getStatistics();
      const gameStats = this.gameService.getStatistics();

      res.status(200).json({
        success: true,
        words: wordStats,
        games: gameStats,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to get statistics:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get statistics",
      });
    }
  };

  // POST /admin/refresh-words - Refresh word dictionary (admin only)
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

  // DELETE /admin/cleanup - Manual cleanup of old games
  cleanupGames = async (_req: Request, res: Response): Promise<void> => {
    try {
      const cleanedCount = this.gameService.cleanupOldGames();

      res.status(200).json({
        success: true,
        message: `Cleaned up ${cleanedCount} expired games`,
        cleanedCount,
      });
    } catch (error) {
      console.error("Failed to cleanup games:", error);
      res.status(500).json({
        success: false,
        error: "Failed to cleanup games",
      });
    }
  };

  // GET /health - Health check endpoint
  healthCheck = async (_req: Request, res: Response): Promise<void> => {
    try {
      const wordStats = this.wordService.getStatistics();
      const gameCount = this.gameService.getGameCount();

      res.status(200).json({
        status: "healthy",
        services: {
          wordService: {
            initialized: wordStats.initialized,
            wordCount: wordStats.totalWords,
          },
          gameService: {
            activeGames: gameCount,
          },
          profileIntegration: {
            enabled: true,
            serviceUrl:
              process.env.PROFILE_SERVICE_URL || "http://localhost:3004",
          },
        },
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // GET /admin/test-evaluation - Test word evaluation logic
  testEvaluation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { guess, target } = req.query;

      if (
        !guess ||
        !target ||
        typeof guess !== "string" ||
        typeof target !== "string"
      ) {
        res.status(400).json({
          success: false,
          error: "Both 'guess' and 'target' query parameters are required",
        });
        return;
      }

      const result = this.gameService.testEvaluation(guess, target);

      res.status(200).json({
        success: true,
        guess: guess.toUpperCase(),
        target: target.toUpperCase(),
        evaluation: result,
      });
    } catch (error) {
      console.error("Test evaluation failed:", error);
      res.status(500).json({
        success: false,
        error: "Test evaluation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}

/*import { Request, Response } from "express";
import { WordService } from "../services/wordService";
import { GameService } from "../services/gameService";

export class GameController {
  private wordService: WordService;
  private gameService: GameService;

  constructor() {
    this.wordService = new WordService();
    this.gameService = new GameService();

    // Initialize word service
    this.initializeServices();

    // Setup periodic cleanup
    setInterval(() => {
      this.gameService.cleanupOldGames();
    }, 60 * 60 * 1000); // Cleanup every hour
  }

  private async initializeServices(): Promise<void> {
    try {
      await this.wordService.initialize();
      console.log("Game controller services initialized successfully");
    } catch (error) {
      console.error("Failed to initialize game controller services:", error);
    }
  }

  // POST /game/new  Create a new game
  createGame = async (_req: Request, res: Response): Promise<void> => {
    try {
      // Get a random word securely
      const targetWord = this.wordService.getRandomWord();
      // Create the game
      const { gameId, publicState } = this.gameService.createGame(targetWord);

      console.log(`New game created: ${gameId} (word: ${targetWord})`); // Log for debugging

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

  // POST /game/:gameId/guess Submit a guess
  submitGuess = async (req: Request, res: Response): Promise<void> => {
    try {
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

      // Validate the word exists in our dictionary
      if (!this.wordService.isValidWord(guess)) {
        res.status(200).json({
          valid: false,
          error: "Not a valid word",
        });
        return;
      }

      // Submit guess to game service
      const result = this.gameService.submitGuess(gameId, guess);

      if (!result.valid) {
        res.status(200).json(result);
        return;
      }

      // Return successful guess result
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("Failed to submit guess:", error);
      res.status(500).json({
        success: false,
        error: "Failed to submit guess",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // GET /game/:gameId Get game state
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

  // GET /stats Get service statistics
  getStatistics = async (_req: Request, res: Response): Promise<void> => {
    try {
      const wordStats = this.wordService.getStatistics();
      const gameStats = this.gameService.getStatistics();

      res.status(200).json({
        success: true,
        words: wordStats,
        games: gameStats,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to get statistics:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get statistics",
      });
    }
  };

  // POST /admin/refresh-words Refresh word dictionary (admin only)
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

  // DELETE /admin/cleanup Manual cleanup of old games
  cleanupGames = async (_req: Request, res: Response): Promise<void> => {
    try {
      const cleanedCount = this.gameService.cleanupOldGames();

      res.status(200).json({
        success: true,
        message: `Cleaned up ${cleanedCount} expired games`,
        cleanedCount,
      });
    } catch (error) {
      console.error("Failed to cleanup games:", error);
      res.status(500).json({
        success: false,
        error: "Failed to cleanup games",
      });
    }
  };

  // GET /health Health check endpoint
  healthCheck = async (_req: Request, res: Response): Promise<void> => {
    try {
      const wordStats = this.wordService.getStatistics();
      const gameCount = this.gameService.getGameCount();

      res.status(200).json({
        status: "healthy",
        services: {
          wordService: {
            initialized: wordStats.initialized,
            wordCount: wordStats.totalWords,
          },
          gameService: {
            activeGames: gameCount,
          },
        },
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // GET /admin/test-evaluation Test word evaluation logic
  testEvaluation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { guess, target } = req.query;

      if (
        !guess ||
        !target ||
        typeof guess !== "string" ||
        typeof target !== "string"
      ) {
        res.status(400).json({
          success: false,
          error: "Both 'guess' and 'target' query parameters are required",
        });
        return;
      }

      const result = this.gameService.testEvaluation(guess, target);

      res.status(200).json({
        success: true,
        guess: guess.toUpperCase(),
        target: target.toUpperCase(),
        evaluation: result,
      });
    } catch (error) {
      console.error("Test evaluation failed:", error);
      res.status(500).json({
        success: false,
        error: "Test evaluation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}
/*import { Request, Response } from "express";
import { GameService } from "../services/gameService";
import { WordService } from "../services/wordService";

const gameService = new GameService();
const wordService = new WordService();

export default {
  createGame: (req: Request, res: Response) => {
    const gameId = `game-${Date.now()}`;
    const word = wordService.getRandomWord();
    gameService.createGame(gameId, word);
    res.json({ gameId });
  },

  submitGuess: (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { guess } = req.body;

    // Add validation
    if (!gameId) {
      return res.status(400).json({ error: "Game ID required" });
    }

    const game = gameService.getGame(gameId);
    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    if (!guess || !wordService.isValidWord(guess.toUpperCase())) {
      return res.json({ valid: false });
    }

    const result = gameService.evaluateGuess(gameId, guess.toUpperCase());
    return res.json(result);
  },

  getGameState: (req: Request, res: Response) => {
    const { gameId } = req.params;

    // Add validation
    if (!gameId) {
      return res.status(400).json({ error: "Game ID required" });
    }

    const game = gameService.getGame(gameId);

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    return res.json(game);
  },
};
*/
