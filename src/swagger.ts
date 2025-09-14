// api-gateway/src/swagger.ts
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Application } from "express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Wordle API Gateway",
      version: "1.0.0",
      description: `
        # Wordle Microservices API Gateway
        This is the central API Gateway for the Wordle game microservices architecture.
        It handles authentication, request routing, and service coordination.
      `,
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token obtained from /api/users/auth/login",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Unique user identifier",
            },
            username: {
              type: "string",
              description: "User's username",
            },
            email: {
              type: "string",
              format: "email",
              description: "User's email address",
            },
          },
        },
        AuthContext: {
          type: "object",
          properties: {
            isAuthenticated: {
              type: "boolean",
              description: "Whether the user is authenticated",
            },
            user: {
              $ref: "#/components/schemas/User",
            },
          },
        },
        Game: {
          type: "object",
          properties: {
            gameId: {
              type: "string",
              description: "Unique game identifier",
            },
            word: {
              type: "string",
              description: "The target word (hidden from players)",
            },
            guesses: {
              type: "array",
              items: {
                type: "string",
              },
              description: "List of guesses made by the player",
            },
            status: {
              type: "string",
              enum: ["active", "won", "lost"],
              description: "Current game status",
            },
          },
        },
        GameStats: {
          type: "object",
          properties: {
            gamesPlayed: {
              type: "integer",
              description: "Total number of games played",
            },
            winRate: {
              type: "number",
              format: "float",
              description: "Win rate as a decimal (0.0 - 1.0)",
            },
            currentStreak: {
              type: "integer",
              description: "Current winning streak",
            },
            maxStreak: {
              type: "integer",
              description: "Maximum winning streak achieved",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            error: {
              type: "string",
              description: "Error message",
            },
            message: {
              type: "string",
              description: "Detailed error description",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Error timestamp",
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/index.ts", "./src/middleware/*.ts"],
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Application): void => {
  // Swagger UI setup
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2c3e50; }
    `,
      customSiteTitle: "Wordle API Gateway Documentation",
      swaggerOptions: {
        docExpansion: "none",
        filter: true,
        showRequestDuration: true,
        requestInterceptor: (req: any) => {
          console.log("Swagger request:", req.method, req.url);
          return req;
        },
      },
    })
  );

  // JSON documentation endpoint
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(specs);
  });
};

export default specs;
