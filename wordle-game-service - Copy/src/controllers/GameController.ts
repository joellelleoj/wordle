import { Request, Response } from "express";
import { GameService } from "../services/GameService";
import { body, param, validationResult } from "express-validator";

export class GameController {
  private gameService: GameService;

  constructor() {
    this.gameService = new GameService();
  }

  // POST /api/game/start
  startGame = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.body.userId; // From JWT in real implementation

      const gameState = await this.gameService.startNewGame(userId);

      res.status(201).json({
        success: true,
        message: "Game started successfully",
        data: {
          gameId: gameState.id,
          gameStatus: gameState.gameStatus,
          guesses: gameState.guesses,
          remainingGuesses: gameState.maxGuesses - gameState.guesses.length,
          startTime: gameState.startTime,
        },
      });
    } catch (error) {
      console.error("Error starting game:", error);
      res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to start game",
      });
    }
  };

  // POST /api/game/:gameId/guess
  makeGuess = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors.array(),
        });
        return;
      }

      const { gameId } = req.params;
      const { guess } = req.body;
      const userId = req.body.userId; // From JWT in real implementation

      const result = await this.gameService.makeGuess(gameId, guess, userId);

      res.json({
        success: true,
        message: result.isValidWord
          ? "Guess processed"
          : "Word not in dictionary",
        data: result,
      });
    } catch (error) {
      console.error("Error making guess:", error);
      res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to process guess",
      });
    }
  };

  // GET /api/game/:gameId
  getGame = async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameId } = req.params;
      const userId = req.query.userId as string;

      const gameState = await this.gameService.getGame(gameId);
      if (!gameState) {
        res.status(404).json({
          success: false,
          message: "Game not found",
        });
        return;
      }

      // Verify user ownership
      if (userId && gameState.userId !== userId) {
        res.status(403).json({
          success: false,
          message: "Unauthorized access to game",
        });
        return;
      }

      // Hide target word unless game is finished
      const responseData = {
        ...gameState,
        targetWord:
          gameState.gameStatus === "active" ? undefined : gameState.targetWord,
      };

      res.json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      console.error("Error getting game:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve game",
      });
    }
  };

  // GET /api/game/active/:userId
  getActiveGame = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      const activeGame = await this.gameService.getActiveGame(userId);
      if (!activeGame) {
        res.json({
          success: true,
          message: "No active game found",
          data: null,
        });
        return;
      }

      // Hide target word
      const responseData = {
        ...activeGame,
        targetWord: undefined,
      };

      res.json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      console.error("Error getting active game:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve active game",
      });
    }
  };
}

export const validateGuess = [
  param("gameId").isUUID().withMessage("Invalid game ID"),
  body("guess")
    .isLength({ min: 5, max: 5 })
    .withMessage("Guess must be exactly 5 letters")
    .matches(/^[A-Za-z]+$/)
    .withMessage("Guess must contain only letters"),
];

export const validateWord = [
  param("word")
    .isLength({ min: 5, max: 5 })
    .withMessage("Word must be exactly 5 letters")
    .matches(/^[A-Za-z]+$/)
    .withMessage("Word must contain only letters"),
];

import { Request, Response } from "express";
import { GameLogicService } from "../services/GameLogicService";
import { GameRepository } from "../repositories/GameRepository";
import { DictionaryService } from "../services/DictionaryService";
import { GameStatus } from "../models/Game";

export class GameController {
  constructor(
    private gameLogicService: GameLogicService,
    private gameRepository: GameRepository,
    private dictionaryService: DictionaryService
  ) {}

  /**
   * POST /game/start - Start a new game
   */
  startGame = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id; // From JWT middleware
      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      // Check if user has active game
      const activeGame = await this.gameRepository.getActiveGameByUserId(
        userId
      );
      if (activeGame) {
        res.status(409).json({
          error: "User already has an active game",
          gameId: activeGame.id,
        });
        return;
      }

      // Get random word
      const targetWord = await this.dictionaryService.getRandomWord();

      // Create new game
      const game = await this.gameRepository.createGame({
        userId,
        targetWord,
        guesses: [],
        status: GameStatus.PLAYING,
        startTime: new Date(),
        currentAttempt: 0,
      });

      res.status(201).json({
        success: true,
        data: {
          gameId: game.id,
          status: game.status,
          startTime: game.startTime,
          currentAttempt: game.currentAttempt,
          // Note: targetWord is NOT sent to frontend for security
        },
      });
    } catch (error) {
      console.error("Error starting game:", error);
      res.status(500).json({ error: "Failed to start game" });
    }
  };

  /**
   * POST /game/guess - Submit a guess
   */
  submitGuess = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { gameId, guess } = req.body;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!gameId || !guess) {
        res.status(400).json({ error: "gameId and guess are required" });
        return;
      }

      // Get game
      const game = await this.gameRepository.getGameById(gameId);
      if (!game) {
        res.status(404).json({ error: "Game not found" });
        return;
      }

      if (game.userId !== userId) {
        res.status(403).json({ error: "Not authorized to play this game" });
        return;
      }

      if (game.status !== GameStatus.PLAYING) {
        res.status(409).json({ error: "Game is not active" });
        return;
      }

      if (game.currentAttempt >= 6) {
        res.status(409).json({ error: "Maximum attempts reached" });
        return;
      }

      // Validate guess
      const validation = await this.gameLogicService.validateGuess(guess);
      if (!validation.valid) {
        res.status(400).json({
          error: "Invalid word",
          reason: validation.reason,
        });
        return;
      }

      // Process guess
      const result = await this.gameLogicService.processGuess(game, guess);

      // Add guess to game
      const guessData = {
        word: guess.toUpperCase(),
        feedback: result.feedback,
        timestamp: new Date(),
      };

      await this.gameRepository.addGuessToGame(gameId, guessData);

      // Update game status if finished
      const updates: any = {
        status: result.gameStatus,
      };

      if (result.gameStatus !== GameStatus.PLAYING) {
        updates.endTime = new Date();
      }

      const updatedGame = await this.gameRepository.updateGame(gameId, updates);

      res.json({
        success: true,
        data: {
          feedback: result.feedback,
          gameStatus: result.gameStatus,
          isCorrect: result.isCorrect,
          attempts: updatedGame.currentAttempt,
          gameFinished: result.gameStatus !== GameStatus.PLAYING,
          ...(result.gameStatus !== GameStatus.PLAYING && {
            targetWord: game.targetWord,
            finalStats: {
              attempts: updatedGame.currentAttempt,
              duration: updatedGame.endTime
                ? Math.floor(
                    (updatedGame.endTime.getTime() -
                      updatedGame.startTime.getTime()) /
                      1000
                  )
                : 0,
              won: result.gameStatus === GameStatus.WON,
            },
          }),
        },
      });
    } catch (error) {
      console.error("Error submitting guess:", error);
      res.status(500).json({ error: "Failed to submit guess" });
    }
  };

  /**
   * GET /game/current - Get current active game
   */
  getCurrentGame = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const activeGame = await this.gameRepository.getActiveGameByUserId(
        userId
      );
      if (!activeGame) {
        res.status(404).json({ error: "No active game found" });
        return;
      }

      res.json({
        success: true,
        data: {
          gameId: activeGame.id,
          status: activeGame.status,
          startTime: activeGame.startTime,
          currentAttempt: activeGame.currentAttempt,
          guesses: activeGame.guesses.map((g) => ({
            word: g.word,
            feedback: g.feedback,
            timestamp: g.timestamp,
          })),
          // targetWord is NOT included for security
        },
      });
    } catch (error) {
      console.error("Error getting current game:", error);
      res.status(500).json({ error: "Failed to get current game" });
    }
  };

  /**
   * GET /game/history - Get user's game history
   */
  getGameHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const games = await this.gameRepository.getUserGames(
        userId,
        limit,
        offset
      );

      const gameHistory = games.map((game) => ({
        id: game.id,
        status: game.status,
        startTime: game.startTime,
        endTime: game.endTime,
        attempts: game.currentAttempt,
        guesses: game.guesses.map((g) => ({
          word: g.word,
          feedback: g.feedback,
          timestamp: g.timestamp,
        })),
        // Only include targetWord for finished games
        ...(game.status !== GameStatus.PLAYING && {
          targetWord: game.targetWord,
          won: game.status === GameStatus.WON,
          duration: game.endTime
            ? Math.floor(
                (game.endTime.getTime() - game.startTime.getTime()) / 1000
              )
            : 0,
        }),
      }));

      res.json({
        success: true,
        data: gameHistory,
        pagination: {
          limit,
          offset,
          hasMore: games.length === limit,
        },
      });
    } catch (error) {
      console.error("Error getting game history:", error);
      res.status(500).json({ error: "Failed to get game history" });
    }
  };

  /**
   * POST /dict/validate - Validate a word (public endpoint)
   */
  validateWord = async (req: Request, res: Response): Promise<void> => {
    try {
      const { word } = req.body;

      if (!word) {
        res.status(400).json({ error: "Word is required" });
        return;
      }

      const isValid = await this.dictionaryService.validateWord(word);

      res.json({
        success: true,
        data: {
          word: word.toUpperCase(),
          valid: isValid,
        },
      });
    } catch (error) {
      console.error("Error validating word:", error);
      res.status(500).json({ error: "Failed to validate word" });
    }
  };

  /**
   * GET /dict/stats - Get dictionary statistics
   */
  getDictionaryStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const size = this.dictionaryService.getDictionarySize();

      res.json({
        success: true,
        data: {
          totalWords: size,
          status: size > 0 ? "loaded" : "empty",
        },
      });
    } catch (error) {
      console.error("Error getting dictionary stats:", error);
      res.status(500).json({ error: "Failed to get dictionary stats" });
    }
  };
}
