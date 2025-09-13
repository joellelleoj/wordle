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
  targetWord?: string;
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

export class GameService {
  private games: Map<string, GameState> = new Map();
  private profileServiceUrl: string;
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.profileServiceUrl =
      process.env.PROFILE_SERVICE_URL || "http://localhost:3004";

    if (process.env.NODE_ENV !== "test") {
      this.cleanupInterval = setInterval(
        () => this.cleanupOldGames(),
        60 * 60 * 1000
      );
    }
  }

  createGame(
    targetWord: string,
    userId?: string
  ): { gameId: string; publicState: PublicGameState } {
    const gameId = `game_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

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
      targetWord: targetWord.toUpperCase(),
    };

    this.games.set(gameId, gameState);

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
    authToken?: string
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

    // Record completed game if authenticated
    if (gameOver && authToken) {
      await this.recordCompletedGame(gameState, authToken);
    }

    return {
      valid: true,
      result,
      gameOver,
      won,
      solution: gameOver ? gameState.targetWord : undefined,
      gameState: publicState,
    };
  }

  getPublicGameState(gameId: string): PublicGameState | null {
    const gameState = this.games.get(gameId);
    if (!gameState) return null;

    return {
      gameId: gameState.gameId,
      board: gameState.board,
      evaluations: gameState.evaluations,
      currentRow: gameState.currentRow,
      gameOver: gameState.gameOver,
      won: gameState.won,
      attempts: gameState.attempts,
      guesses: gameState.guesses,
    };
  }

  getGameCount(): number {
    return this.games.size;
  }

  // Fixed evaluation logic
  private evaluateGuess(
    guess: string,
    target: string
  ): ("correct" | "present" | "absent")[] {
    const result: ("correct" | "present" | "absent")[] = new Array(5).fill(
      "absent"
    );
    const targetChars = target.split("");
    const guessChars = guess.split("");

    // Create arrays to track letter usage
    const targetUsed = new Array(5).fill(false);
    const guessProcessed = new Array(5).fill(false);

    // First pass: Find all exact matches (green)
    for (let i = 0; i < 5; i++) {
      if (guessChars[i] === targetChars[i]) {
        result[i] = "correct";
        targetUsed[i] = true;
        guessProcessed[i] = true;
      }
    }

    // Second pass: Find letters in wrong positions (yellow)
    for (let i = 0; i < 5; i++) {
      if (guessProcessed[i]) continue; // Already processed as correct

      const guessLetter = guessChars[i];

      // Look for this letter in unused positions of target
      for (let j = 0; j < 5; j++) {
        if (!targetUsed[j] && targetChars[j] === guessLetter) {
          result[i] = "present";
          targetUsed[j] = true;
          break;
        }
      }
    }

    return result;
  }

  private async recordCompletedGame(
    gameState: GameState,
    authToken: string
  ): Promise<void> {
    try {
      const gameRecord = {
        gameId: gameState.gameId,
        word: gameState.targetWord,
        guesses: gameState.guesses,
        won: gameState.won,
        attempts: gameState.attempts,
        date: new Date().toISOString().split("T")[0],
      };

      await axios.post(`${this.profileServiceUrl}/api/games`, gameRecord, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        timeout: 5000,
      });
    } catch (error: any) {
      console.error(
        `Failed to record game ${gameState.gameId}:`,
        error.message
      );
    }
  }

  cleanupOldGames(): number {
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

    return cleanedCount;
  }

  // Cleanup method for tests to prevent memory leaks
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.games.clear();
  }

  // Test helper method
  testEvaluation(
    guess: string,
    target: string
  ): ("correct" | "present" | "absent")[] {
    return this.evaluateGuess(guess.toUpperCase(), target.toUpperCase());
  }
}
