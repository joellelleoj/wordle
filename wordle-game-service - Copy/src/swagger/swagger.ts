import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Wordle Game Service API",
      version: "1.0.0",
      description: "REST API for Wordle game logic and dictionary management",
      contact: {
        name: "Wordle Game Service",
        email: "support@wordlegame.com",
      },
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:3001",
        description: "Game Service",
      },
    ],
    tags: [
      {
        name: "Game",
        description: "Game management endpoints",
      },
      {
        name: "Dictionary",
        description: "Word validation and dictionary management",
      },
    ],
    components: {
      schemas: {
        GameState: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique game identifier",
            },
            userId: {
              type: "string",
              description: "User identifier (optional for anonymous games)",
            },
            guesses: {
              type: "array",
              items: { type: "string", minLength: 5, maxLength: 5 },
              description: "Array of user guesses",
            },
            gameStatus: {
              type: "string",
              enum: ["active", "won", "lost"],
              description: "Current game status",
            },
            remainingGuesses: {
              type: "integer",
              minimum: 0,
              maximum: 6,
              description: "Number of guesses remaining",
            },
            startTime: {
              type: "string",
              format: "date-time",
              description: "Game start timestamp",
            },
            endTime: {
              type: "string",
              format: "date-time",
              description: "Game end timestamp (if finished)",
            },
          },
        },
        GuessResult: {
          type: "object",
          properties: {
            guess: {
              type: "string",
              minLength: 5,
              maxLength: 5,
              description: "The guessed word",
            },
            result: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  letter: { type: "string", minLength: 1, maxLength: 1 },
                  status: {
                    type: "string",
                    enum: ["correct", "present", "absent"],
                  },
                  position: { type: "integer", minimum: 0, maximum: 4 },
                },
              },
            },
            gameStatus: {
              type: "string",
              enum: ["active", "won", "lost"],
            },
            remainingGuesses: {
              type: "integer",
              minimum: 0,
            },
            isValidWord: {
              type: "boolean",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"], // Path to the API routes
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Wordle Game Service API",
    })
  );

  console.log("📚 Swagger UI available at /api-docs");
};

// ============================================================================
// ROUTE DOCUMENTATION (JSDoc comments for Swagger)
// ============================================================================

/**
 * @swagger
 * /api/game/start:
 *   post:
 *     tags: [Game]
 *     summary: Start a new Wordle game
 *     description: Creates a new game instance with a random target word
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Optional user identifier
 *     responses:
 *       201:
 *         description: Game started successfully
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
 *                   example: "Game started successfully"
 *                 data:
 *                   $ref: '#/components/schemas/GameState'
 *       400:
 *         description: User already has an active game
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/game/{gameId}/guess:
 *   post:
 *     tags: [Game]
 *     summary: Make a guess in an active game
 *     description: Submit a 5-letter word guess and receive feedback
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guess
 *             properties:
 *               guess:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 5
 *                 pattern: '^[A-Za-z]+$'
 *                 example: "HOUSE"
 *               userId:
 *                 type: string
 *                 description: Optional user identifier for verification
 *     responses:
 *       200:
 *         description: Guess processed successfully
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
 *                   example: "Guess processed"
 *                 data:
 *                   $ref: '#/components/schemas/GuessResult'
 *       400:
 *         description: Invalid guess or game state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/game/{gameId}:
 *   get:
 *     tags: [Game]
 *     summary: Get game state
 *     description: Retrieve current state of a specific game
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: User identifier for verification
 *     responses:
 *       200:
 *         description: Game state retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/GameState'
 *       404:
 *         description: Game not found
 */

/**
 * @swagger
 * /api/dictionary/validate/{word}:
 *   get:
 *     tags: [Dictionary]
 *     summary: Validate a word
 *     description: Check if a 5-letter word exists in the game dictionary
 *     parameters:
 *       - in: path
 *         name: word
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 5
 *           maxLength: 5
 *           pattern: '^[A-Za-z]+$'
 *         example: "HOUSE"
 *     responses:
 *       200:
 *         description: Word validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     word:
 *                       type: string
 *                       example: "HOUSE"
 *                     isValid:
 *                       type: boolean
 *                       example: true
 */

/**
 * @swagger
 * /api/dictionary/stats:
 *   get:
 *     tags: [Dictionary]
 *     summary: Get dictionary statistics
 *     description: Retrieve information about the loaded word dictionary
 *     responses:
 *       200:
 *         description: Dictionary statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalWords:
 *                       type: integer
 *                       example: 2315
 *                     source:
 *                       type: string
 *                       example: "GitHub + Redis Cache + Fallback"
 */
