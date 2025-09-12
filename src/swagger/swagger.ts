import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Application } from "express";

export class SwaggerSetup {
  private options: swaggerJSDoc.Options;

  constructor() {
    this.options = {
      definition: {
        openapi: "3.0.0",
        info: {
          title: "Wordle User Service API",
          version: "1.0.0",
          description:
            "Authentication and user management service for the Wordle application",
          contact: {
            name: "Wordle Team",
            email: "support@wordle.example.com",
          },
          license: {
            name: "MIT",
            url: "https://opensource.org/licenses/MIT",
          },
        },
        servers: [
          {
            url: "http://localhost:3003",
            description: "Development server (local)",
          },
          {
            url: "http://127.0.10.11:8081",
            description: "Production server (devstud)",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
          schemas: {
            User: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "User unique identifier",
                },
                username: {
                  type: "string",
                  description: "User username",
                },
                email: {
                  type: "string",
                  format: "email",
                  description: "User email address",
                },
                display_name: {
                  type: "string",
                  description: "User display name (optional)",
                },
                gitlab_id: {
                  type: "number",
                  description: "GitLab user ID (for OAuth users)",
                },
                created_at: {
                  type: "string",
                  format: "date-time",
                  description: "Account creation timestamp",
                },
              },
            },
            AuthResponse: {
              type: "object",
              properties: {
                success: {
                  type: "boolean",
                  description: "Operation success status",
                },
                message: {
                  type: "string",
                  description: "Response message",
                },
                data: {
                  type: "object",
                  properties: {
                    user: {
                      $ref: "#/components/schemas/User",
                    },
                    accessToken: {
                      type: "string",
                      description: "JWT access token",
                    },
                    refreshToken: {
                      type: "string",
                      description: "JWT refresh token",
                    },
                  },
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
                message: {
                  type: "string",
                  description: "Error message",
                },
                errors: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "Validation error details",
                },
              },
            },
            HealthResponse: {
              type: "object",
              properties: {
                service: {
                  type: "string",
                  description: "Service name",
                },
                version: {
                  type: "string",
                  description: "Service version",
                },
                status: {
                  type: "string",
                  enum: ["healthy", "unhealthy"],
                  description: "Service health status",
                },
                timestamp: {
                  type: "string",
                  format: "date-time",
                  description: "Health check timestamp",
                },
                database: {
                  type: "string",
                  description: "Database connection status",
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
      apis: ["./src/routes/*.ts", "./src/controllers/*.ts", "./src/index.ts"],
    };
  }

  public setupSwagger(app: Application): void {
    const specs = swaggerJSDoc(this.options);

    // Serve Swagger UI at /api-docs
    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(specs, {
        explorer: true,
        swaggerOptions: {
          docExpansion: "none",
          filter: true,
          showRequestDuration: true,
        },
      })
    );

    // Serve OpenAPI JSON spec
    app.get("/api-docs.json", (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(specs);
    });

    console.log("📚 Swagger UI available at: http://localhost:3003/api-docs");
    console.log(
      "📄 OpenAPI spec available at: http://localhost:3003/api-docs.json"
    );
  }
}

// Export for use in main application
export const swaggerSetup = new SwaggerSetup();
