import { GameService } from "../src/services/gameService";

describe("GameService - Core Game Logic", () => {
  let gameService: GameService;

  beforeEach(() => {
    gameService = new GameService();
  });

  afterEach(() => {
    gameService.cleanup();
  });

  describe("Game Creation", () => {
    it("should create a new game with valid structure", () => {
      const { gameId, publicState } = gameService.createGame("HELLO");

      expect(gameId).toMatch(/^game_\d+_[a-z0-9]+$/);
      expect(publicState.gameId).toBe(gameId);
      expect(publicState.board).toHaveLength(6);
      expect(publicState.board[0]).toHaveLength(5);
      expect(publicState.currentRow).toBe(0);
      expect(publicState.gameOver).toBe(false);
      expect(publicState.won).toBe(false);
      expect(publicState.attempts).toBe(0);
      expect(publicState.guesses).toHaveLength(0);
    });

    it("should create unique game IDs", () => {
      const game1 = gameService.createGame("HELLO");
      const game2 = gameService.createGame("WORLD");

      expect(game1.gameId).not.toBe(game2.gameId);
    });
  });

  describe("Guess Submission", () => {
    let gameId: string;

    beforeEach(() => {
      const { gameId: id } = gameService.createGame("HELLO");
      gameId = id;
    });

    it("should accept valid guess", async () => {
      const result = await gameService.submitGuess(gameId, "WORLD");

      expect(result.valid).toBe(true);
      expect(result.result).toHaveLength(5);
      expect(result.gameOver).toBe(false);
      expect(result.won).toBe(false);
      expect(result.gameState?.attempts).toBe(1);
      expect(result.gameState?.currentRow).toBe(1);
    });

    it("should win with correct word", async () => {
      const result = await gameService.submitGuess(gameId, "HELLO");

      expect(result.valid).toBe(true);
      expect(result.won).toBe(true);
      expect(result.gameOver).toBe(true);
      expect(result.solution).toBe("HELLO");
      expect(result.result).toEqual([
        "correct",
        "correct",
        "correct",
        "correct",
        "correct",
      ]);
    });

    it("should reject invalid game ID", async () => {
      const result = await gameService.submitGuess("invalid-id", "HELLO");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Game not found");
    });

    it("should reject guess on completed game", async () => {
      await gameService.submitGuess(gameId, "HELLO");
      const result = await gameService.submitGuess(gameId, "WORLD");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Game is already over");
    });

    it("should end game after 6 unsuccessful guesses", async () => {
      const badGuesses = ["AAAAA", "BBBBB", "CCCCC", "DDDDD", "EEEEE", "FFFFF"];

      let finalResult;
      for (const guess of badGuesses) {
        finalResult = await gameService.submitGuess(gameId, guess);
      }

      expect(finalResult?.gameOver).toBe(true);
      expect(finalResult?.won).toBe(false);
      expect(finalResult?.solution).toBe("HELLO");
    });
  });

  describe("Letter Evaluation", () => {
    let gameId: string;

    beforeEach(() => {
      const { gameId: id } = gameService.createGame("HELLO");
      gameId = id;
    });

    it("should mark correct letters", async () => {
      const result = await gameService.submitGuess(gameId, "HALLO");

      expect(result.result?.[0]).toBe("correct"); // H
      expect(result.result?.[1]).toBe("absent"); // A
      expect(result.result?.[2]).toBe("correct"); // L
      expect(result.result?.[3]).toBe("correct"); // L
      expect(result.result?.[4]).toBe("correct"); // O
    });

    it("should mark present letters", async () => {
      const result = await gameService.submitGuess(gameId, "OLLEH");

      expect(result.result?.[0]).toBe("present"); // O (in word but wrong position)
      expect(result.result?.[1]).toBe("present"); // L (in word but wrong position)
      expect(result.result?.[2]).toBe("correct"); // L (CORRECT - exact match at position 2!)
      expect(result.result?.[3]).toBe("present"); // E (in word but wrong position)
      expect(result.result?.[4]).toBe("present"); // H (in word but wrong position)
    });

    it("should mark absent letters", async () => {
      const result = await gameService.submitGuess(gameId, "QUEEN");

      expect(result.result?.[0]).toBe("absent"); // Q
      expect(result.result?.[1]).toBe("absent"); // U
      expect(result.result?.[2]).toBe("present"); // E (in HELLO)
      expect(result.result?.[3]).toBe("absent"); // E (second E, but HELLO only has one E)
      expect(result.result?.[4]).toBe("absent"); // N
    });

    it("should handle duplicate letters correctly", async () => {
      const { gameId: id } = gameService.createGame("SPEED");
      const result = await gameService.submitGuess(id, "ERASE");

      expect(result.result?.[0]).toBe("present"); // E (in word but wrong position)
      expect(result.result?.[1]).toBe("absent"); // R (not in SPEED)
      expect(result.result?.[2]).toBe("absent"); // A (not in SPEED)
      expect(result.result?.[3]).toBe("present"); // S (in word but wrong position)
      expect(result.result?.[4]).toBe("present"); // E (PRESENT - second E finds second E in SPEED)
    });

    it("should handle complex duplicate scenarios", async () => {
      const { gameId: id } = gameService.createGame("HELLO");
      const result = await gameService.submitGuess(id, "LLAMA");

      expect(result.result?.[0]).toBe("present"); // L (finds match at target position 2)
      expect(result.result?.[1]).toBe("present"); // L (finds match at target position 3)
      expect(result.result?.[2]).toBe("absent"); // A (not in HELLO)
      expect(result.result?.[3]).toBe("absent"); // M (not in HELLO)
      expect(result.result?.[4]).toBe("absent"); // A (not in HELLO)
    });
  });

  describe("Game State Management", () => {
    it("should return public game state", () => {
      const { gameId } = gameService.createGame("HELLO");
      const state = gameService.getPublicGameState(gameId);

      expect(state).toBeDefined();
      expect(state?.gameId).toBe(gameId);
      expect(state?.board).toHaveLength(6);
      // targetWord should not be in public state
      expect((state as any)?.targetWord).toBeUndefined();
    });

    it("should return null for invalid game ID", () => {
      const state = gameService.getPublicGameState("invalid-id");
      expect(state).toBeNull();
    });

    it("should track game count", () => {
      const initialCount = gameService.getGameCount();

      gameService.createGame("HELLO");
      gameService.createGame("WORLD");

      expect(gameService.getGameCount()).toBe(initialCount + 2);
    });
  });

  describe("Game Cleanup", () => {
    it("should clean up old games", () => {
      const oldGameId = `game_${Date.now() - 2 * 60 * 60 * 1000}_test`;
      const gameService = new GameService() as any;

      gameService.games.set(oldGameId, {
        gameId: oldGameId,
        board: [],
        evaluations: [],
        currentRow: 0,
        gameOver: false,
        won: false,
        attempts: 0,
        guesses: [],
        targetWord: "TEST",
      });

      const initialCount = gameService.getGameCount();
      const cleanedCount = gameService.cleanupOldGames();

      expect(cleanedCount).toBeGreaterThan(0);
      expect(gameService.getGameCount()).toBe(initialCount - cleanedCount);
    });
  });
});
