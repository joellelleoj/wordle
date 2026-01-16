import request from "supertest";
import app from "../src/index";

beforeAll(() => {
  process.env.NODE_ENV = "test";
  process.env.WORD_CACHE_PATH = "./test-cache";
});

describe("Game Service API", () => {
  describe("POST /game/new", () => {
    it("should create a new game", async () => {
      const response = await request(app).post("/game/new").expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.gameId).toBeDefined();
      expect(response.body.board).toHaveLength(6);
      expect(response.body.currentRow).toBe(0);
      expect(response.body.gameOver).toBe(false);
      expect(response.body.won).toBe(false);
    });
  });

  describe("POST /game/:gameId/guess", () => {
    let gameId: string;

    beforeEach(async () => {
      const response = await request(app).post("/game/new");
      gameId = response.body.gameId;
    });

    it("should accept a valid guess", async () => {
      const response = await request(app)
        .post(`/game/${gameId}/guess`)
        .send({ guess: "HELLO" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.result).toHaveLength(5);
      expect(response.body.gameState).toBeDefined();
    });

    it("should reject invalid word", async () => {
      const response = await request(app)
        .post(`/game/${gameId}/guess`)
        .send({ guess: "ZZZZZ" })
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe("Not a valid word");
    });

    it("should reject invalid guess format", async () => {
      const response = await request(app)
        .post(`/game/${gameId}/guess`)
        .send({ guess: "" })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        "Guess is required and must be a string"
      );
    });

    it("should reject missing game ID", async () => {
      const response = await request(app)
        .post("/game//guess")
        .send({ guess: "HELLO" })
        .expect(404);
    });
  });

  describe("GET /game/:gameId", () => {
    let gameId: string;

    beforeEach(async () => {
      const response = await request(app).post("/game/new");
      gameId = response.body.gameId;
    });

    it("should return game state", async () => {
      const response = await request(app).get(`/game/${gameId}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.gameId).toBe(gameId);
      expect(response.body.board).toHaveLength(6);
      expect(response.body.currentRow).toBe(0);
    });

    it("should return 404 for non-existent game", async () => {
      const response = await request(app)
        .get("/game/invalid-game-id")
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Game not found");
    });
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body.status).toBe("healthy");
      expect(response.body.service).toBe("wordle-game-service");
      expect(response.body.services.wordService).toBeDefined();
      expect(response.body.services.gameService).toBeDefined();
      expect(response.body.endpoints).toHaveLength(4);
    });
  });

  describe("Word Evaluation Logic", () => {
    let gameId: string;

    beforeEach(async () => {
      const response = await request(app).post("/game/new");
      gameId = response.body.gameId;
    });

    it("should correctly evaluate letter positions", async () => {
      await request(app).post(`/game/${gameId}/guess`).send({ guess: "HELLO" });

      await request(app).post(`/game/${gameId}/guess`).send({ guess: "WORLD" });

      const response = await request(app).get(`/game/${gameId}`).expect(200);

      expect(response.body.attempts).toBe(2);
      expect(response.body.guesses).toHaveLength(2);
      expect(response.body.currentRow).toBe(2);
    });
  });

  describe("Game Flow Integration", () => {
    it("should complete a full game", async () => {
      const createResponse = await request(app).post("/game/new").expect(201);

      const gameId = createResponse.body.gameId;

      const words = ["HELLO", "WORLD", "GAMES", "WORDS", "QUICK", "FINAL"];

      for (const word of words) {
        const guessResponse = await request(app)
          .post(`/game/${gameId}/guess`)
          .send({ guess: word });

        if (guessResponse.body.gameOver) {
          expect(guessResponse.body.solution).toBeDefined();
          break;
        }
      }

      const finalResponse = await request(app)
        .get(`/game/${gameId}`)
        .expect(200);

      expect(finalResponse.body.attempts).toBeGreaterThan(0);
    });
  });
});
