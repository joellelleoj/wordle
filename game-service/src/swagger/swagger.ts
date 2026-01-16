import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Wordle Game Service API",
      version: "1.0.0",
      description: `
        RESTful API for Wordle game mechanics and state management.
        This microservice implements:
        - Game creation and lifecycle management
        - Word validation using comprehensive dictionary
        - Authentic Wordle letter evaluation algorithm
        - Profile service integration for game recording
      `,
    },
    servers: [
      {
        url: "http://localhost:3002",
        description: "Development server",
      },
      {
        url: "https://devstud.imn.htwk-leipzig.de/dev11/api",
        description: "Production server (HTWK deployment)",
      },
    ],
    components: {
      schemas: {
        GameState: {
          type: "object",
          properties: {
            gameId: {
              type: "string",
              description: "Unique game identifier",
              example: "game_1672531200000_abc123def",
            },
            board: {
              type: "array",
              items: {
                type: "array",
                items: { type: "string" },
              },
              description: "6x5 grid of guessed letters",
              example: [
                ["H", "E", "L", "L", "O"],
                ["", "", "", "", ""],
                ["", "", "", "", ""],
                ["", "", "", "", ""],
                ["", "", "", "", ""],
                ["", "", "", "", ""],
              ],
            },
            evaluations: {
              type: "array",
              items: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["correct", "present", "absent", null],
                },
              },
              description: "6x5 grid of letter evaluations",
              example: [
                ["correct", "present", "absent", "present", "correct"],
                [null, null, null, null, null],
                [null, null, null, null, null],
                [null, null, null, null, null],
                [null, null, null, null, null],
                [null, null, null, null, null],
              ],
            },
            currentRow: {
              type: "integer",
              minimum: 0,
              maximum: 6,
              description: "Current guess attempt (0-6)",
              example: 1,
            },
            gameOver: {
              type: "boolean",
              description: "Whether game is completed",
              example: false,
            },
            won: {
              type: "boolean",
              description: "Whether player won the game",
              example: false,
            },
            attempts: {
              type: "integer",
              minimum: 0,
              maximum: 6,
              description: "Number of guesses made",
              example: 1,
            },
            guesses: {
              type: "array",
              items: { type: "string" },
              description: "Array of word guesses made",
              example: ["HELLO"],
            },
          },
          required: [
            "gameId",
            "board",
            "evaluations",
            "currentRow",
            "gameOver",
            "won",
            "attempts",
            "guesses",
          ],
        },
        GuessRequest: {
          type: "object",
          properties: {
            guess: {
              type: "string",
              minLength: 5,
              maxLength: 5,
              pattern: "^[A-Za-z]{5}$",
              description: "5-letter word guess",
              example: "WORLD",
            },
          },
          required: ["guess"],
        },
        GuessResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              description: "Whether the request was successful",
              example: true,
            },
            valid: {
              type: "boolean",
              description: "Whether the guess was valid",
              example: true,
            },
            result: {
              type: "array",
              items: {
                type: "string",
                enum: ["correct", "present", "absent"],
              },
              description: "Letter-by-letter evaluation results",
              example: ["absent", "correct", "present", "correct", "absent"],
            },
            gameOver: {
              type: "boolean",
              description: "Whether game ended with this guess",
              example: false,
            },
            won: {
              type: "boolean",
              description: "Whether player won with this guess",
              example: false,
            },
            solution: {
              type: "string",
              description: "Target word (only shown when game ends)",
              example: "STUDY",
            },
            gameState: {
              $ref: "#/components/schemas/GameState",
            },
            message: {
              type: "string",
              description: "Optional message for user",
              example: "Great guess! Keep trying.",
            },
            error: {
              type: "string",
              description: "Error message if guess was invalid",
              example: "Not a valid word",
            },
          },
        },
        HealthResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["healthy", "unhealthy"],
              example: "healthy",
            },
            service: {
              type: "string",
              example: "wordle-game-service",
            },
            version: {
              type: "string",
              example: "1.0.0",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2025-01-15T10:30:00.000Z",
            },
            uptime: {
              type: "number",
              description: "Service uptime in seconds",
              example: 3600,
            },
            environment: {
              type: "string",
              example: "production",
            },
            services: {
              type: "object",
              properties: {
                wordService: {
                  type: "object",
                  properties: {
                    initialized: { type: "boolean", example: true },
                    wordCount: { type: "integer", example: 12972 },
                  },
                },
                gameService: {
                  type: "object",
                  properties: {
                    activeGames: { type: "integer", example: 15 },
                  },
                },
              },
            },
            endpoints: {
              type: "array",
              items: { type: "string" },
              example: [
                "POST /game/new",
                "POST /game/:gameId/guess",
                "GET /game/:gameId",
                "GET /health",
              ],
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            error: {
              type: "string",
              description: "Error type or category",
              example: "Validation Error",
            },
            message: {
              type: "string",
              description: "Human-readable error message",
              example: "Game ID is required",
            },
          },
          required: ["success", "error"],
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    "./src/controllers/*.ts",
    "./src/routes/*.ts", // Include routes if you have separate route files
  ],
};

const specs = swaggerJsdoc(options);

/**
 * Setup Swagger UI middleware
 *
 * @param app - Express application instance
 */
export const setupSwagger = (app: Express): void => {
  // Serve Swagger UI at /api-docs
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      explorer: true,
      customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info hgroup.main h2 { color: #1976d2 }
    `,
      customSiteTitle: "Wordle Game Service API Documentation",
      swaggerOptions: {
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        docExpansion: "list",
        filter: true,
        showRequestHeaders: true,
      },
    })
  );

  // Provide JSON spec endpoint
  app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(specs);
  });

  console.log("Swagger documentation available at /api-docs");
  console.log("OpenAPI JSON specification available at /api-docs.json");
};
