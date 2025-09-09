// game-service/src/services/gameService.ts - Fixed implementation
import axios from "axios";

export interface GameState {
  gameId: string;
  board: string[][];
  evaluations: ("correct" | "present" | "absent" | null)[][];
  currentRow: number;
  gameOver: boolean;
  won: boolean;
  attempts: number;
  guesses: string[];
  targetWord?: string; // Only included in complete state
}

export interface PublicGameState {
  gameId: string;
  board: string[][];
  evaluations: ("correct" | "present" | "absent" | null)[][];
  currentRow: number;
  gameOver: boolean;
  won: boolean;
  attempts: number;
  guesses: string[];
  // targetWord is excluded from public state unless game is over
}

export interface GuessResult {
  valid: boolean;
  result?: ("correct" | "present" | "absent")[];
  gameOver?: boolean;
  won?: boolean;
  solution?: string;
  gameState?: PublicGameState;
  error?: string;
}

export interface GameStatistics {
  totalGames: number;
  activeGames: number;
  completedGames: number;
  wonGames: number;
  winRate: number;
  averageAttempts: number;
}

export class GameService {
  private games: Map<string, GameState> = new Map();
  private words: string[] = [
    "HELLO",
    "WORLD",
    "GAMES",
    "WORDS",
    "QUICK",
    "BROWN",
    "JUMPS",
    "FOXES",
    "APPLE",
    "GRAPE",
    "LEMON",
    "PEACH",
    "MELON",
    "BERRY",
    "CREAM",
    "SUGAR",
    "BREAD",
    "FLOUR",
    "WATER",
    "GLASS",
    "PLATE",
    "SPOON",
    "KNIFE",
    "FORKS",
    "CHAIR",
    "TABLE",
    "HOUSE",
    "PLANT",
    "LIGHT",
    "PHONE",
    "MOUSE",
    "PRINT",
    "SOUND",
    "MIGHT",
    "THINK",
    "PLACE",
    "WHERE",
    "EVERY",
    "GREAT",
    "AFTER",
    "NEVER",
    "AGAIN",
    "COULD",
    "WOULD",
    "SHOULD",
    "THEIR",
    "THERE",
    "ABOUT",
  ];

  private profileServiceUrl: string;

  constructor() {
    this.profileServiceUrl =
      process.env.PROFILE_SERVICE_URL || "http://localhost:3004";
    // Start cleanup interval
    setInterval(() => this.cleanupOldGames(), 60 * 60 * 1000); // Every hour
  }

  createGame(
    targetWord?: string,
    userId?: string
  ): { gameId: string; publicState: PublicGameState } {
    const gameId = `game_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const selectedWord = targetWord || this.getRandomWord();

    const gameState: GameState = {
      gameId,
      board: Array(6)
        .fill(null)
        .map(() => Array(5).fill("")),
      evaluations: Array(6)
        .fill(null)
        .map(() => Array(5).fill(null)),
      currentRow: 0,
      gameOver: false,
      won: false,
      attempts: 0,
      guesses: [],
      targetWord: selectedWord.toUpperCase(),
    };

    this.games.set(gameId, gameState);
    console.log(
      `Created game ${gameId} with word: ${selectedWord}${
        userId ? ` for user ${userId}` : ""
      }`
    );

    // Return public state (without targetWord)
    const publicState: PublicGameState = {
      gameId: gameState.gameId,
      board: gameState.board,
      evaluations: gameState.evaluations,
      currentRow: gameState.currentRow,
      gameOver: gameState.gameOver,
      won: gameState.won,
      attempts: gameState.attempts,
      guesses: gameState.guesses,
    };

    return { gameId, publicState };
  }

  async submitGuess(
    gameId: string,
    guess: string,
    userId?: string
  ): Promise<GuessResult> {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return {
        valid: false,
        error: "Game not found",
      };
    }

    if (gameState.gameOver) {
      return {
        valid: false,
        error: "Game is already over",
      };
    }

    const normalizedGuess = guess.toUpperCase();

    // Validate guess
    if (!this.isValidWord(normalizedGuess)) {
      return {
        valid: false,
        error: "Not a valid word",
      };
    }

    // Process guess
    const result = this.evaluateGuess(normalizedGuess, gameState.targetWord!);
    const won = normalizedGuess === gameState.targetWord;

    // Update game state
    gameState.board[gameState.currentRow] = normalizedGuess.split("");
    gameState.evaluations[gameState.currentRow] = result;
    gameState.guesses.push(normalizedGuess);
    gameState.attempts = gameState.currentRow + 1;
    gameState.currentRow++;

    // Check game over conditions
    const gameOver = won || gameState.currentRow >= 6;
    gameState.gameOver = gameOver;
    gameState.won = won;

    // Create public state for response
    const publicState: PublicGameState = {
      gameId: gameState.gameId,
      board: [...gameState.board],
      evaluations: [...gameState.evaluations],
      currentRow: gameState.currentRow,
      gameOver: gameState.gameOver,
      won: gameState.won,
      attempts: gameState.attempts,
      guesses: [...gameState.guesses],
    };

    // Prepare response
    const response: GuessResult = {
      valid: true,
      result,
      gameOver,
      won,
      solution: gameOver ? gameState.targetWord : undefined,
      gameState: publicState,
    };

    // Record completed game automatically if user is authenticated
    if (gameOver && userId) {
      await this.recordCompletedGame(gameState, userId);
    }

    return response;
  }

  getGameState(gameId: string): GameState | null {
    return this.games.get(gameId) || null;
  }

  getPublicGameState(gameId: string): PublicGameState | null {
    const gameState = this.games.get(gameId);
    if (!gameState) return null;

    const publicState: PublicGameState = {
      gameId: gameState.gameId,
      board: gameState.board,
      evaluations: gameState.evaluations,
      currentRow: gameState.currentRow,
      gameOver: gameState.gameOver,
      won: gameState.won,
      attempts: gameState.attempts,
      guesses: gameState.guesses,
    };

    return publicState;
  }

  getStatistics(): GameStatistics {
    const allGames = Array.from(this.games.values());
    const completedGames = allGames.filter((g) => g.gameOver);
    const wonGames = completedGames.filter((g) => g.won);

    return {
      totalGames: allGames.length,
      activeGames: allGames.length - completedGames.length,
      completedGames: completedGames.length,
      wonGames: wonGames.length,
      winRate:
        completedGames.length > 0
          ? (wonGames.length / completedGames.length) * 100
          : 0,
      averageAttempts:
        wonGames.length > 0
          ? wonGames.reduce((sum, g) => sum + g.attempts, 0) / wonGames.length
          : 0,
    };
  }

  getGameCount(): number {
    return this.games.size;
  }

  testEvaluation(
    guess: string,
    target: string
  ): ("correct" | "present" | "absent")[] {
    return this.evaluateGuess(guess.toUpperCase(), target.toUpperCase());
  }

  private getRandomWord(): string {
    return this.words[Math.floor(Math.random() * this.words.length)];
  }

  private isValidWord(word: string): boolean {
    // Basic validation - in a real implementation, check against dictionary
    if (word.length !== 5 || !/^[A-Z]+$/.test(word)) {
      return false;
    }

    // Check if word is in our word list or is a reasonable English word
    return this.words.includes(word) || this.isReasonableEnglishWord(word);
  }

  private isReasonableEnglishWord(word: string): boolean {
    // Basic heuristic for English words - no repeated patterns, reasonable letter combinations
    const commonPatterns = /^[A-Z]{5}$/;
    const invalidPatterns = /(.)\1{3,}|[QX]{2,}|[BCDFGHJKLMNPQRSTVWXYZ]{4,}/;

    return commonPatterns.test(word) && !invalidPatterns.test(word);
  }

  private evaluateGuess(
    guess: string,
    target: string
  ): ("correct" | "present" | "absent")[] {
    const result: ("correct" | "present" | "absent")[] = [];
    const targetLetters = target.split("");
    const guessLetters = guess.split("");

    // First pass: mark correct letters
    for (let i = 0; i < 5; i++) {
      if (guessLetters[i] === targetLetters[i]) {
        result[i] = "correct";
        targetLetters[i] = "*"; // Mark as used
        guessLetters[i] = "*"; // Mark as processed
      }
    }

    // Second pass: mark present/absent letters
    for (let i = 0; i < 5; i++) {
      if (guessLetters[i] !== "*") {
        const letterIndex = targetLetters.indexOf(guessLetters[i]);
        if (letterIndex !== -1) {
          result[i] = "present";
          targetLetters[letterIndex] = "*"; // Mark as used
        } else {
          result[i] = "absent";
        }
      }
    }

    return result;
  }

  // Automatically record completed games to profile service
  private async recordCompletedGame(
    gameState: GameState,
    userId: string
  ): Promise<void> {
    try {
      console.log(
        `Recording completed game ${gameState.gameId} for user ${userId}`
      );

      const gameRecord = {
        gameId: gameState.gameId,
        word: gameState.targetWord,
        guesses: gameState.guesses,
        won: gameState.won,
        attempts: gameState.attempts,
        date: new Date().toISOString().split("T")[0],
      };

      // Send to profile service via internal service communication
      await axios.post(`${this.profileServiceUrl}/api/games`, gameRecord, {
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": userId, // Internal service header
          "X-Service": "game-service", // Service identification
        },
        timeout: 5000,
      });

      console.log(
        `Successfully recorded game ${gameState.gameId} for user ${userId}`
      );
    } catch (error: any) {
      console.error(
        `Failed to record game ${gameState.gameId}:`,
        error.message
      );
      // Don't throw - game completion should work even if recording fails
    }
  }

  // Health check
  healthCheck(): any {
    return {
      status: "healthy",
      service: "game-service",
      timestamp: new Date().toISOString(),
      stats: {
        activeGames: this.games.size,
        availableWords: this.words.length,
      },
    };
  }

  // Cleanup old games (memory management)
  cleanupOldGames(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let cleanedCount = 0;

    for (const [gameId] of this.games.entries()) {
      const gameTime = parseInt(gameId.split("_")[1]);
      if (gameTime < oneHourAgo) {
        this.games.delete(gameId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} old games`);
    }
  }

  // Get daily word (for future daily mode implementation)
  getDailyWord(): string {
    const today = new Date().toISOString().split("T")[0];
    const seed = today
      .split("-")
      .reduce((acc, part) => acc + parseInt(part), 0);
    return this.words[seed % this.words.length];
  }

  // Debug methods
  getAllGames(): GameState[] {
    return Array.from(this.games.values());
  }

  deleteGame(gameId: string): boolean {
    return this.games.delete(gameId);
  }
}
