import { v4 as uuidv4 } from "uuid";
import { createClient, RedisClientType } from "redis";
import { GameState, GuessResult, LetterResult } from "../types/game";
import { dictionaryService } from "./DictionaryService";

export class GameService {
  private redisClient: RedisClientType | null = null;
  private readonly GAME_PREFIX = "game:";
  private readonly ACTIVE_GAME_PREFIX = "active_game:";
  private readonly GAME_TTL = 24 * 60 * 60; // 24 hours

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
      this.redisClient = createClient({ url: redisUrl });

      this.redisClient.on("error", (err) => {
        console.warn("⚠️ Game Service Redis Error:", err);
      });

      await this.redisClient.connect();
      console.log("✅ Game Service Redis connected");
    } catch (error) {
      console.error("❌ Game Service Redis failed to connect:", error);
      throw new Error("Game service requires Redis connection");
    }
  }

  async startNewGame(userId?: string): Promise<GameState> {
    if (!this.redisClient) {
      throw new Error("Redis connection not available");
    }

    // Check if user already has an active game
    if (userId) {
      const activeGame = await this.getActiveGame(userId);
      if (activeGame && activeGame.gameStatus === "active") {
        throw new Error("User already has an active game");
      }
    }

    // Get random target word
    const targetWord = await dictionaryService.getRandomWord();

    const gameState: GameState = {
      id: uuidv4(),
      userId,
      targetWord,
      guesses: [],
      gameStatus: "active",
      startTime: new Date(),
      maxGuesses: 6,
    };

    // Store game in Redis
    await this.saveGame(gameState);

    // Track active game for user
    if (userId) {
      await this.redisClient.setEx(
        `${this.ACTIVE_GAME_PREFIX}${userId}`,
        this.GAME_TTL,
        gameState.id
      );
    }

    console.log(
      `🎮 New game started: ${gameState.id} for user: ${userId || "anonymous"}`
    );

    // Return game state without revealing target word
    return {
      ...gameState,
      targetWord: "****", // Hide target word from client
    } as GameState;
  }

  async makeGuess(
    gameId: string,
    guess: string,
    userId?: string
  ): Promise<GuessResult> {
    if (!this.redisClient) {
      throw new Error("Redis connection not available");
    }

    // Validate input
    const normalizedGuess = guess.toUpperCase().trim();
    if (normalizedGuess.length !== 5) {
      throw new Error("Guess must be exactly 5 letters");
    }

    if (!/^[A-Z]+$/.test(normalizedGuess)) {
      throw new Error("Guess must contain only letters");
    }

    // Get game state
    const gameState = await this.getGame(gameId);
    if (!gameState) {
      throw new Error("Game not found");
    }

    // Verify user ownership
    if (userId && gameState.userId !== userId) {
      throw new Error("Unauthorized access to game");
    }

    // Check if game is still active
    if (gameState.gameStatus !== "active") {
      throw new Error("Game is not active");
    }

    // Check guess limit
    if (gameState.guesses.length >= gameState.maxGuesses) {
      throw new Error("Maximum guesses exceeded");
    }

    // Validate word against dictionary
    const isValidWord = await dictionaryService.validateWord(normalizedGuess);
    if (!isValidWord) {
      return {
        guess: normalizedGuess,
        result: [],
        gameStatus: gameState.gameStatus,
        remainingGuesses: gameState.maxGuesses - gameState.guesses.length,
        isValidWord: false,
      };
    }

    // Process the guess
    const result = this.evaluateGuess(normalizedGuess, gameState.targetWord);

    // Update game state
    gameState.guesses.push(normalizedGuess);

    // Check win condition
    if (normalizedGuess === gameState.targetWord) {
      gameState.gameStatus = "won";
      gameState.endTime = new Date();
    }
    // Check lose condition
    else if (gameState.guesses.length >= gameState.maxGuesses) {
      gameState.gameStatus = "lost";
      gameState.endTime = new Date();
    }

    // Save updated game state
    await this.saveGame(gameState);

    // Clear active game if finished
    if (gameState.gameStatus !== "active" && userId) {
      await this.redisClient.del(`${this.ACTIVE_GAME_PREFIX}${userId}`);
    }

    console.log(
      `🎯 Guess made: ${normalizedGuess} for game: ${gameId}, Status: ${gameState.gameStatus}`
    );

    return {
      guess: normalizedGuess,
      result,
      gameStatus: gameState.gameStatus,
      remainingGuesses: gameState.maxGuesses - gameState.guesses.length,
      isValidWord: true,
    };
  }

  private evaluateGuess(guess: string, target: string): LetterResult[] {
    const result: LetterResult[] = [];
    const targetLetters = target.split("");
    const guessLetters = guess.split("");
    const usedTargetIndices = new Set<number>();

    // First pass: Find exact matches (correct position)
    for (let i = 0; i < guessLetters.length; i++) {
      if (guessLetters[i] === targetLetters[i]) {
        result[i] = {
          letter: guessLetters[i],
          status: "correct",
          position: i,
        };
        usedTargetIndices.add(i);
      }
    }

    // Second pass: Find letters in wrong positions
    for (let i = 0; i < guessLetters.length; i++) {
      if (result[i]) continue; // Skip if already marked as correct

      const letter = guessLetters[i];
      let foundInTarget = false;

      // Look for this letter in unused target positions
      for (let j = 0; j < targetLetters.length; j++) {
        if (usedTargetIndices.has(j)) continue;

        if (targetLetters[j] === letter) {
          result[i] = {
            letter,
            status: "present",
            position: i,
          };
          usedTargetIndices.add(j);
          foundInTarget = true;
          break;
        }
      }

      // If not found in target at all
      if (!foundInTarget) {
        result[i] = {
          letter,
          status: "absent",
          position: i,
        };
      }
    }

    return result;
  }

  async getGame(gameId: string): Promise<GameState | null> {
    if (!this.redisClient) {
      throw new Error("Redis connection not available");
    }

    try {
      const gameData = await this.redisClient.get(
        `${this.GAME_PREFIX}${gameId}`
      );
      if (!gameData) {
        return null;
      }

      const parsed = JSON.parse(gameData);
      return {
        ...parsed,
        startTime: new Date(parsed.startTime),
        endTime: parsed.endTime ? new Date(parsed.endTime) : undefined,
      };
    } catch (error) {
      console.error("Error retrieving game:", error);
      return null;
    }
  }

  async getActiveGame(userId: string): Promise<GameState | null> {
    if (!this.redisClient) {
      throw new Error("Redis connection not available");
    }

    try {
      const activeGameId = await this.redisClient.get(
        `${this.ACTIVE_GAME_PREFIX}${userId}`
      );
      if (!activeGameId) {
        return null;
      }

      return await this.getGame(activeGameId);
    } catch (error) {
      console.error("Error retrieving active game:", error);
      return null;
    }
  }

  private async saveGame(gameState: GameState): Promise<void> {
    if (!this.redisClient) {
      throw new Error("Redis connection not available");
    }

    await this.redisClient.setEx(
      `${this.GAME_PREFIX}${gameState.id}`,
      this.GAME_TTL,
      JSON.stringify(gameState)
    );
  }

  async getGameHistory(userId: string): Promise<GameState[]> {
    // For now, return empty array as we're focusing on current game
    // In full implementation, this would query a persistent database
    return [];
  }

  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}
