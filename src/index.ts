// api-gateway/src/index.ts - Final complete implementation
import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { UserRoutes } from "./routes/userRoutes";
import { GameRoutes } from "./routes/gameRoutes";
import { ProfileRoutes } from "./routes/ProfileRoutes";
import { authFilter } from "./middleware/authFilter";

dotenv.config();

class ApiGateway {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || "8002");
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.setupErrorHandling();
  }

  private initializeMiddlewares(): void {
    const corsOptions = {
      origin: [
        "http://localhost:3000",
        "http://127.0.10.11:8080",
        "https://devstud.imn.htwk-leipzig.de",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
      ],
      credentials: true,
      optionsSuccessStatus: 200,
    };

    this.app.use(cors(corsOptions));
    this.app.options("*", cors(corsOptions));
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Add authentication filter to all requests
    this.app.use(authFilter);

    // Request logging
    this.app.use((req: Request, res: Response, next) => {
      const authStatus = req.auth?.isAuthenticated
        ? `authenticated as ${req.auth.user?.username}`
        : "anonymous";

      console.log(
        `${new Date().toISOString()} - ${req.method} ${
          req.url
        } (${authStatus}) from ${req.headers.origin || "unknown"}`
      );
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get("/health", (req: Request, res: Response) => {
      res.status(200).json({
        service: "API Gateway",
        status: "healthy",
        timestamp: new Date().toISOString(),
        port: this.port,
        environment: process.env.NODE_ENV || "development",
        authentication: {
          filterEnabled: true,
          currentUser: req.auth?.isAuthenticated
            ? req.auth.user?.username
            : null,
        },
      });
    });

    // User service routes (authentication)
    const userRoutes = new UserRoutes();
    this.app.use("/api/users", userRoutes.getRouter());

    // Game service routes (with auth context passed through)
    const gameRoutes = new GameRoutes();
    this.app.use("/api/game", gameRoutes.getRouter());

    // Profile service routes (requires authentication)
    const profileRoutes = new ProfileRoutes();
    this.app.use("/api/profile", profileRoutes.getRouter());

    // Root route with comprehensive service information
    this.app.get("/", (req: Request, res: Response) => {
      res.json({
        service: "Wordle API Gateway",
        version: "1.0.0",
        port: this.port,
        status: "running",
        timestamp: new Date().toISOString(),
        authentication: {
          currentUser: req.auth?.isAuthenticated
            ? {
                username: req.auth.user?.username,
                id: req.auth.user?.id,
              }
            : null,
          status: req.auth?.isAuthenticated ? "authenticated" : "anonymous",
        },
        microservices: {
          game_service: process.env.GAME_SERVICE_URL || "http://localhost:3002",
          user_service: process.env.USER_SERVICE_URL || "http://localhost:3003",
          profile_service:
            process.env.PROFILE_SERVICE_URL || "http://localhost:3004",
        },
        endpoints: {
          health: "/health",
          authentication: "/api/users/*",
          game: {
            create: "POST /api/game/new",
            guess: "POST /api/game/:gameId/guess",
            state: "GET /api/game/:gameId",
            stats: "GET /api/game/stats",
          },
          profile: {
            games: "GET/POST /api/profile/games",
            stats: "GET /api/profile/stats",
            posts: "GET/POST /api/profile/posts",
            albums: "GET/POST /api/profile/albums",
            search: "GET /api/profile/search/*",
            note: "All profile endpoints require authentication",
          },
        },
        features: {
          authentication: "JWT-based with mock tokens for development",
          gameRecording: "Automatic game saving for authenticated users",
          socialFeatures: "Posts and albums for sharing game achievements",
          statistics: "Comprehensive game statistics and streaks",
          wordValidation: "Dictionary-based word validation",
        },
      });
    });

    // Test authentication endpoint
    this.app.get("/api/test/auth", (req: Request, res: Response) => {
      res.json({
        success: true,
        authentication: {
          isAuthenticated: req.auth?.isAuthenticated || false,
          user: req.auth?.user || null,
          timestamp: new Date().toISOString(),
        },
        message: req.auth?.isAuthenticated
          ? `Hello ${req.auth.user?.username}! You are authenticated.`
          : "You are not authenticated. Some features may be limited.",
      });
    });

    // Test CORS endpoint
    this.app.get("/api/test", (req: Request, res: Response) => {
      res.json({
        message: "CORS is working!",
        origin: req.headers.origin,
        timestamp: new Date().toISOString(),
        authentication: req.auth?.isAuthenticated
          ? "authenticated"
          : "anonymous",
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
      console.error("API Gateway error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
        timestamp: new Date().toISOString(),
      });
    });

    this.app.use("*", (req: Request, res: Response) => {
      console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString(),
        availableRoutes: {
          health: "GET /health",
          authentication: [
            "POST /api/users/auth/register",
            "POST /api/users/auth/login",
            "GET /api/users/auth/gitlab/login",
            "POST /api/users/auth/gitlab/callback",
            "POST /api/users/auth/logout",
            "POST /api/users/auth/refresh",
            "GET /api/users/auth/me",
          ],
          game: [
            "POST /api/game/new",
            "POST /api/game/:gameId/guess",
            "GET /api/game/:gameId",
            "GET /api/game/health",
          ],
          profile: [
            "POST /api/profile/games (auth required)",
            "GET /api/profile/games (auth required)",
            "GET /api/profile/stats (auth required)",
            "POST /api/profile/posts (auth required)",
            "GET /api/profile/posts (auth required)",
            "POST /api/profile/albums (auth required)",
          ],
          testing: [
            "GET /api/test - CORS test",
            "GET /api/test/auth - Authentication test",
          ],
        },
        tip: "Authentication is required for profile features. Use /api/users/auth/login to authenticate.",
      });
    });
  }

  public start(): void {
    this.app.listen(this.port, "0.0.0.0", () => {
      console.log(`🚀 Wordle API Gateway started successfully!`);
      console.log(`📍 Port: ${this.port}`);
      console.log(`🌐 Local: http://localhost:${this.port}`);
      console.log(`🧪 Test CORS: http://localhost:${this.port}/api/test`);
      console.log(`🔐 Test Auth: http://localhost:${this.port}/api/test/auth`);
      console.log(`❤️  Health: http://localhost:${this.port}/health`);
      console.log(``);
      console.log(`📋 Microservices Architecture:`);
      console.log(
        `   ├── Game Service: ${
          process.env.GAME_SERVICE_URL || "http://localhost:3002"
        }`
      );
      console.log(
        `   ├── User Service: ${
          process.env.USER_SERVICE_URL || "http://localhost:3003"
        }`
      );
      console.log(
        `   └── Profile Service: ${
          process.env.PROFILE_SERVICE_URL || "http://localhost:3004"
        }`
      );
      console.log(``);
      console.log(`🔧 Features Enabled:`);
      console.log(`   ✅ Authentication Filter (JWT + Mock tokens)`);
      console.log(`   ✅ Automatic Game Recording (authenticated users)`);
      console.log(`   ✅ Profile Management (games, stats, posts, albums)`);
      console.log(`   ✅ Cross-service Communication`);
      console.log(`   ✅ CORS Configuration`);
      console.log(``);
      console.log(`🎮 Game Flow:`);
      console.log(`   1. User plays game via /api/game/* endpoints`);
      console.log(
        `   2. If authenticated, completed games auto-save to profile`
      );
      console.log(`   3. Users can create posts/albums from saved games`);
      console.log(`   4. Statistics and streaks calculated automatically`);
      console.log(``);
      console.log(`🚦 Test Endpoints:`);
      console.log(`   📊 Health: GET /health`);
      console.log(`   🔐 Auth: GET /api/test/auth`);
      console.log(`   🌐 CORS: GET /api/test`);
      console.log(`   📖 Docs: GET / (service documentation)`);
    });
  }
}

const gateway = new ApiGateway();
gateway.start();

export default gateway;

/*// api-gateway/src/index.ts - Fixed with proper startup
import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { UserRoutes } from "./routes/userRoutes";
import { GameRoutes } from "./routes/gameRoutes";

// Load environment variables first
dotenv.config();

class ApiGateway {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || "8002");
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.setupErrorHandling();
  }

  private initializeMiddlewares(): void {
    const corsOptions = {
      origin: [
        "http://localhost:3000",
        "http://127.0.10.11:8080",
        "https://devstud.imn.htwk-leipzig.de",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
      ],
      credentials: true,
      optionsSuccessStatus: 200,
    };

    this.app.use(cors(corsOptions));
    this.app.options("*", cors(corsOptions));
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next) => {
      console.log(
        `${new Date().toISOString()} - ${req.method} ${req.url} from ${
          req.headers.origin || "unknown"
        }`
      );
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get("/health", (req: Request, res: Response) => {
      res.status(200).json({
        service: "API Gateway",
        status: "healthy",
        timestamp: new Date().toISOString(),
        port: this.port,
        environment: process.env.NODE_ENV || "development",
      });
    });

    // User service routes (authentication)
    const userRoutes = new UserRoutes();
    this.app.use("/api/users", userRoutes.getRouter());

    const gameRoutes = new GameRoutes();
    this.app.use("/api/game", gameRoutes.getRouter());

    // Root route
    this.app.get("/", (req: Request, res: Response) => {
      res.json({
        service: "Wordle API Gateway",
        version: "1.0.0",
        port: this.port,
        status: "running",
        microservices: {
          game_service: process.env.GAME_SERVICE_URL || "http://localhost:3002",
          user_service: process.env.USER_SERVICE_URL || "http://localhost:3003",
          profile_service:
            process.env.PROFILE_SERVICE_URL || "http://localhost:3004",
        },
        endpoints: {
          health: "/health",
          game: "/api/game/*",
          users: "/api/users/*",
        },
      });
    });

    // Test CORS endpoint
    this.app.get("/api/test", (req: Request, res: Response) => {
      res.json({
        message: "CORS is working!",
        origin: req.headers.origin,
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
      console.error("API Gateway error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    });

    this.app.use("*", (req: Request, res: Response) => {
      console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        availableRoutes: [
          "GET /health",
          "POST /api/game/new",
          "POST /api/game/:gameId/guess",
          "POST /api/users/auth/register",
          "POST /api/users/auth/login",
          "GET /api/users/auth/gitlab/login",
          "POST /api/users/auth/gitlab/callback",
          "POST /api/users/auth/logout",
          "POST /api/users/auth/refresh",
          "GET /api/users/auth/me",
        ],
      });
    });
  }

  public start(): void {
    this.app.listen(this.port, "0.0.0.0", () => {
      console.log(`🚀 API Gateway started successfully!`);
      console.log(`📍 Port: ${this.port}`);
      console.log(`🌐 Local: http://localhost:${this.port}`);
      console.log(`🧪 Test CORS: http://localhost:${this.port}/api/test`);
      console.log(`❤️  Health: http://localhost:${this.port}/health`);
      console.log(`📋 Microservices:`);
      console.log(
        `   Game Service: ${
          process.env.GAME_SERVICE_URL || "http://localhost:3002"
        }`
      );
      console.log(
        `   User Service: ${
          process.env.USER_SERVICE_URL || "http://localhost:3003"
        }`
      );
      console.log(
        `   Profile Service: ${
          process.env.PROFILE_SERVICE_URL || "http://localhost:3004"
        }`
      );
    });
  }
}

const gateway = new ApiGateway();
gateway.start();

export default gateway;

/*interface GitLabTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope: string;
}

interface GitLabUser {
  id: number;
  username: string;
  name: string;
  email: string;
  avatar_url?: string;
  web_url?: string;
}
// api-gateway/index.ts - Enhanced with real authentication
import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

class ApiGateway {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || "8002"); // Fixed to 8002
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.setupErrorHandling();
  }

  private initializeMiddlewares(): void {
    const corsOptions = {
      origin: function (origin: any, callback: any) {
        const allowedOrigins = [
          "http://localhost:3000",
          "http://127.0.10.11:8080",
          "https://devstud.imn.htwk-leipzig.de",
        ];

        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        console.log("CORS blocked origin:", origin);
        return callback(null, true); // Allow all for development
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
      ],
      credentials: true,
      optionsSuccessStatus: 200,
    };

    this.app.use(cors(corsOptions));
    this.app.options("*", cors(corsOptions));
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    this.app.use((req: Request, res: Response, next) => {
      console.log(
        `${new Date().toISOString()} - ${req.method} ${req.url} from ${
          req.headers.origin || "unknown"
        }`
      );
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get("/health", (req: Request, res: Response) => {
      res.status(200).json({
        service: "API Gateway",
        status: "healthy",
        timestamp: new Date().toISOString(),
        port: this.port,
      });
    });

    // Mock game routes for testing
    this.app.post("/api/game/new", (req: Request, res: Response) => {
      console.log("Creating new game...");

      const gameId = `game_${Date.now()}`;
      const gameState = {
        gameId: gameId,
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
      };

      res.status(200).json(gameState);
    });

    this.app.post("/api/game/:gameId/guess", (req: Request, res: Response) => {
      const { gameId } = req.params;
      const { guess } = req.body;

      console.log(`Processing guess for game ${gameId}: ${guess}`);

      if (!guess || guess.length !== 5) {
        return res.status(400).json({
          valid: false,
          error: "Guess must be exactly 5 letters",
        });
      }

      // Mock word validation - make "HELLO" the winning word for testing
      const targetWord = "HELLO";
      const result = guess.split("").map((letter: string, index: number) => {
        if (letter === targetWord[index]) return "correct";
        if (targetWord.includes(letter)) return "present";
        return "absent";
      });

      const won = guess === targetWord;

      res.json({
        valid: true,
        result: result,
        gameOver: won || false, // Could add logic for max attempts
        won: won,
        solution: won ? targetWord : undefined,
      });
    });

    // ========== AUTHENTICATION ROUTES ==========

    // Traditional Username/Password Login
    this.app.post("/api/users/auth/login", (req: Request, res: Response) => {
      const { username, password } = req.body;

      console.log(`Login attempt - Username: ${username}`);

      // Mock user database - in real implementation, validate against database
      const mockUsers = [
        {
          id: 1,
          username: "testuser",
          password: "password123",
          email: "test@example.com",
        },
        {
          id: 2,
          username: "demo",
          password: "demo123",
          email: "demo@example.com",
        },
        {
          id: 3,
          username: "player1",
          password: "pass123",
          email: "player1@example.com",
        },
      ];

      const user = mockUsers.find(
        (u) => u.username === username && u.password === password
      );

      if (user) {
        res.json({
          success: true,
          message: "Login successful",
          data: {
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              created_at: new Date().toISOString(),
            },
            accessToken: `mock_access_token_${user.id}_${Date.now()}`,
            refreshToken: `mock_refresh_token_${user.id}_${Date.now()}`,
          },
        });
      } else {
        res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });
      }
    });

    // Traditional Registration
    this.app.post("/api/users/auth/register", (req: Request, res: Response) => {
      const { username, email, password } = req.body;

      console.log(
        `Registration attempt - Username: ${username}, Email: ${email}`
      );

      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Username, email, and password are required",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }

      // Mock registration success
      const newUser = {
        id: Date.now(),
        username: username,
        email: email,
        created_at: new Date().toISOString(),
      };

      res.json({
        success: true,
        message: "Registration successful",
        data: {
          user: newUser,
          accessToken: `mock_access_token_${newUser.id}_${Date.now()}`,
          refreshToken: `mock_refresh_token_${newUser.id}_${Date.now()}`,
        },
      });
    });

    // GitLab OAuth Login Initiation
    this.app.get(
      "/api/users/auth/gitlab/login",
      (req: Request, res: Response) => {
        const clientId =
          "2d04d82c5877b01f9d1224e1502b935a2d0adce06c373b6a49521ac1377b078d";
        const redirectUri =
          "http://localhost:8002/api/users/auth/gitlab/callback"; // Point to API Gateway
        const gitlabBaseUrl = "https://git.imn.htwk-leipzig.de";

        const authUrl = `${gitlabBaseUrl}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=read_user`;

        console.log("GitLab OAuth Login URL:", authUrl);

        res.json({
          success: true,
          authUrl: authUrl,
          message: "Redirect to this URL to authenticate with GitLab",
        });
      }
    );

    // GitLab OAuth Callback Handler
    // Replace your OAuth callback handlers with these public client versions:

    // GitLab OAuth Callback Handler (Public Client - No Secret)
    this.app.get(
      "/api/users/auth/gitlab/callback",
      async (req: Request, res: Response) => {
        const { code, error } = req.query;

        if (error) {
          console.log("OAuth error:", error);
          return res.redirect(
            `http://localhost:3000/login?error=${encodeURIComponent(
              error.toString()
            )}`
          );
        }

        if (!code) {
          console.log("No authorization code received");
          return res.redirect("http://localhost:3000/login?error=no_code");
        }

        console.log("Received OAuth code:", code);

        try {
          // Exchange authorization code for access token (PUBLIC CLIENT - NO SECRET)
          const tokenResponse = await fetch(
            "https://git.imn.htwk-leipzig.de/oauth/token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                client_id:
                  "2d04d82c5877b01f9d1224e1502b935a2d0adce06c373b6a49521ac1377b078d",
                // NO client_secret for public clients
                code: code,
                grant_type: "authorization_code",
                redirect_uri:
                  "http://localhost:8002/api/users/auth/gitlab/callback",
              }),
            }
          );

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error(
              "Token exchange failed:",
              tokenResponse.status,
              errorText
            );
            return res.redirect(
              `http://localhost:3000/login?error=token_exchange_failed`
            );
          }

          const tokenData = (await tokenResponse.json()) as GitLabTokenResponse;
          console.log("Token exchange successful");

          // Get user info from GitLab
          const userResponse = await fetch(
            "https://git.imn.htwk-leipzig.de/api/v4/user",
            {
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                Accept: "application/json",
              },
            }
          );

          if (!userResponse.ok) {
            console.error("Failed to get user info from GitLab");
            return res.redirect(
              `http://localhost:3000/login?error=user_info_failed`
            );
          }

          const gitlabUser = (await userResponse.json()) as GitLabUser;
          console.log("GitLab user authenticated:", gitlabUser.username);

          // Create our user object for any GitLab user
          const user = {
            id: gitlabUser.id,
            username: gitlabUser.username,
            email: gitlabUser.email,
            gitlab_id: gitlabUser.id,
            created_at: new Date().toISOString(),
          };

          // Create success URL with user data
          const successData = {
            success: true,
            data: {
              user: user,
              accessToken: `gitlab_token_${tokenData.access_token.substring(
                0,
                16
              )}`,
              refreshToken: `gitlab_refresh_${Date.now()}`,
            },
          };

          const successUrl = `http://localhost:3000/oauth/success?data=${encodeURIComponent(
            JSON.stringify(successData)
          )}`;
          res.redirect(successUrl);
        } catch (error) {
          console.error("OAuth callback error:", error);
          res.redirect(`http://localhost:3000/login?error=oauth_failed`);
        }
      }
    );

    // GitLab OAuth POST Callback (for API calls - Public Client)
    this.app.post(
      "/api/users/auth/gitlab/callback",
      async (req: Request, res: Response) => {
        const { code, redirect_uri } = req.body;

        console.log("GitLab OAuth POST callback:", {
          code: code?.substring(0, 10) + "...",
          redirect_uri,
        });

        if (!code) {
          return res.status(400).json({
            success: false,
            message: "Authorization code is required",
          });
        }

        try {
          // Exchange authorization code for access token (PUBLIC CLIENT - NO SECRET)
          const tokenResponse = await fetch(
            "https://git.imn.htwk-leipzig.de/oauth/token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                client_id:
                  "2d04d82c5877b01f9d1224e1502b935a2d0adce06c373b6a49521ac1377b078d",
                // NO client_secret for public clients
                code: code,
                grant_type: "authorization_code",
                redirect_uri:
                  redirect_uri ||
                  "http://localhost:8002/api/users/auth/gitlab/callback",
              }),
            }
          );

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error(
              "Token exchange failed:",
              tokenResponse.status,
              errorText
            );
            return res.status(400).json({
              success: false,
              message: "Token exchange failed",
              error: errorText,
            });
          }

          const tokenData = (await tokenResponse.json()) as GitLabTokenResponse;

          // Get user info from GitLab
          const userResponse = await fetch(
            "https://git.imn.htwk-leipzig.de/api/v4/user",
            {
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                Accept: "application/json",
              },
            }
          );

          if (!userResponse.ok) {
            return res.status(400).json({
              success: false,
              message: "Failed to get user info from GitLab",
            });
          }

          const gitlabUser = (await userResponse.json()) as GitLabUser;

          // Allow any GitLab user to authenticate
          res.json({
            success: true,
            message: "GitLab OAuth successful - Welcome!",
            data: {
              user: {
                id: gitlabUser.id,
                username: gitlabUser.username,
                email: gitlabUser.email,
                gitlab_id: gitlabUser.id,
                created_at: new Date().toISOString(),
              },
              accessToken: `gitlab_token_${tokenData.access_token.substring(
                0,
                16
              )}`,
              refreshToken: tokenData.refresh_token
                ? `gitlab_refresh_${tokenData.refresh_token.substring(0, 16)}`
                : `gitlab_refresh_${Date.now()}`,
            },
          });
        } catch (error) {
          console.error("OAuth POST callback error:", error);
          res.status(500).json({
            success: false,
            message: "OAuth processing failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    );
    // Logout
    this.app.post("/api/users/auth/logout", (req: Request, res: Response) => {
      console.log("User logout request");
      res.json({
        success: true,
        message: "Logged out successfully",
      });
    });

    // Test endpoints for database simulation
    this.app.get("/api/users/list", (req: Request, res: Response) => {
      const mockUsers = [
        {
          id: 1,
          username: "testuser",
          email: "test@example.com",
          created_at: "2025-01-01T00:00:00Z",
        },
        {
          id: 2,
          username: "demo",
          email: "demo@example.com",
          created_at: "2025-01-02T00:00:00Z",
        },
        {
          id: 3,
          username: "player1",
          email: "player1@example.com",
          created_at: "2025-01-03T00:00:00Z",
        },
        {
          id: 9999,
          username: "gitlab_user",
          email: "gitlab@example.com",
          gitlab_id: 123456,
          created_at: "2025-01-04T00:00:00Z",
        },
      ];

      res.json({
        success: true,
        users: mockUsers,
        total: mockUsers.length,
      });
    });

    // Root and test routes
    this.app.get("/", (req: Request, res: Response) => {
      res.json({
        service: "Wordle API Gateway",
        version: "1.0.0",
        port: this.port,
        status: "running",
        authentication: {
          traditional: "POST /api/users/auth/login",
          oauth_gitlab: "GET /api/users/auth/gitlab/login",
          register: "POST /api/users/auth/register",
          logout: "POST /api/users/auth/logout",
        },
        endpoints: {
          health: "/health",
          game: "/api/game/*",
          users: "/api/users/*",
          test_users: "/api/users/list",
        },
      });
    });

    this.app.get("/api/test", (req: Request, res: Response) => {
      res.json({
        message: "CORS is working!",
        origin: req.headers.origin,
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
      console.error("API Gateway error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    });

    this.app.use("*", (req: Request, res: Response) => {
      console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        availableRoutes: [
          "GET /health",
          "POST /api/game/new",
          "POST /api/game/:gameId/guess",
          "POST /api/users/auth/login",
          "POST /api/users/auth/register",
          "GET /api/users/auth/gitlab/login",
          "GET /api/users/list",
        ],
      });
    });
  }

  public start(): void {
    this.app.listen(this.port, "0.0.0.0", () => {
      console.log(`
🚀 API Gateway started successfully!
📍 Port: ${this.port}
🌐 Local: http://localhost:${this.port}
🧪 Test CORS: http://localhost:${this.port}/api/test
❤️  Health: http://localhost:${this.port}/health

📋 Authentication Testing:
   Traditional Login Test Users:
   - Username: testuser, Password: password123
   - Username: demo, Password: demo123
   - Username: player1, Password: pass123

🔗 OAuth GitLab:
   GET ${this.port}/api/users/auth/gitlab/login

📊 Test Database:
   GET ${this.port}/api/users/list
      `);
    });
  }
}

const gateway = new ApiGateway();
gateway.start();

// api-gateway/index.ts - Fixed CORS and error handling
import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

class ApiGateway {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || "8002"); // Use 8082 for development
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.setupErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Enhanced CORS configuration
    const corsOptions = {
      origin: function (origin: any, callback: any) {
        // Allow requests from these origins
        const allowedOrigins = [
          "http://localhost:3000",
          "http://127.0.10.11:8080",
          "https://devstud.imn.htwk-leipzig.de",
        ];

        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        console.log("CORS blocked origin:", origin);
        return callback(null, true); // Allow all for development
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
      ],
      credentials: true,
      optionsSuccessStatus: 200, // Some legacy browsers choke on 204
    };

    this.app.use(cors(corsOptions));

    // Handle preflight requests explicitly
    this.app.options("*", cors(corsOptions));

    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next) => {
      console.log(
        `${new Date().toISOString()} - ${req.method} ${req.url} from ${
          req.headers.origin || "unknown"
        }`
      );
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get("/health", (req: Request, res: Response) => {
      res.status(200).json({
        service: "API Gateway",
        status: "healthy",
        timestamp: new Date().toISOString(),
        port: this.port,
      });
    });

    // Mock game routes for testing (replace with actual routes later)
    this.app.post("/api/game/new", (req: Request, res: Response) => {
      console.log("Creating new game...");

      // Mock game creation response
      const gameId = `game_${Date.now()}`;
      const gameState = {
        gameId: gameId,
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
      };

      res.status(200).json(gameState);
    });

    this.app.post("/api/game/:gameId/guess", (req: Request, res: Response) => {
      const { gameId } = req.params;
      const { guess } = req.body;

      console.log(`Processing guess for game ${gameId}: ${guess}`);

      // Mock guess validation
      if (!guess || guess.length !== 5) {
        return res.status(400).json({
          valid: false,
          error: "Guess must be exactly 5 letters",
        });
      }

      // Mock response - all letters as "present" for testing
      res.json({
        valid: true,
        result: ["present", "present", "present", "present", "present"],
        gameOver: false,
        won: false,
      });
    });

    // Mock user auth routes for testing
    this.app.post("/api/users/auth/login", (req: Request, res: Response) => {
      const { username, password } = req.body;

      // Mock login response
      // Mock user database - in real implementation, validate against database
      const mockUsers = [
        {
          id: 1,
          username: "testuser",
          password: "password123",
          email: "test@example.com",
        },
        {
          id: 2,
          username: "demo",
          password: "demo123",
          email: "demo@example.com",
        },
        {
          id: 3,
          username: "player1",
          password: "pass123",
          email: "player1@example.com",
        },
      ];

      const user = mockUsers.find(
        (u) => u.username === username && u.password === password
      );

      if (user) {
        res.json({
          success: true,
          message: "Login successful",
          data: {
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              created_at: new Date().toISOString(),
            },
            accessToken: `mock_access_token_${user.id}_${Date.now()}`,
            refreshToken: `mock_refresh_token_${user.id}_${Date.now()}`,
          },
        });
      } else {
        res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });
      }
    });

    this.app.post("/api/users/auth/register", (req: Request, res: Response) => {
      const { username, email, password } = req.body;

      // Mock registration response
      if (username && email && password) {
        res.json({
          success: true,
          message: "Registration successful",
          data: {
            user: {
              id: Date.now(),
              username: username,
              email: email,
              created_at: new Date().toISOString(),
            },
            accessToken: "mock_access_token",
            refreshToken: "mock_refresh_token",
          },
        });
      } else {
        res.status(400).json({
          success: false,
          message: "All fields required",
        });
      }
    });

    // GitLab OAuth mock endpoint
    this.app.post(
      "/api/users/auth/gitlab/callback",
      (req: Request, res: Response) => {
        const { code, redirect_uri } = req.body;

        console.log("GitLab OAuth callback:", { code, redirect_uri });

        // For now, return an error to indicate OAuth isn't set up
        res.status(400).json({
          success: false,
          message:
            "OAuth not configured yet. Please use manual login for testing.",
        });
      }
    );

    // Default route
    this.app.get("/", (req: Request, res: Response) => {
      res.json({
        service: "Wordle API Gateway",
        version: "1.0.0",
        port: this.port,
        status: "running",
        endpoints: {
          health: "/health",
          game: "/api/game/*",
          users: "/api/users/*",
        },
      });
    });

    // Test CORS endpoint
    this.app.get("/api/test", (req: Request, res: Response) => {
      res.json({
        message: "CORS is working!",
        origin: req.headers.origin,
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
      console.error("API Gateway error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    });

    // 404 handler
    this.app.use("*", (req: Request, res: Response) => {
      console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        availableRoutes: [
          "GET /health",
          "POST /api/game/new",
          "POST /api/game/:gameId/guess",
          "POST /api/users/auth/login",
          "POST /api/users/auth/register",
        ],
      });
    });
  }

  public start(): void {
    this.app.listen(this.port, "0.0.0.0", () => {
      console.log(`\n🚀 API Gateway started successfully!`);
      console.log(`📍 Port: ${this.port}`);
      console.log(`🌐 Local: http://localhost:${this.port}`);
      console.log(`🧪 Test CORS: http://localhost:${this.port}/api/test`);
      console.log(`❤️  Health: http://localhost:${this.port}/health`);
      console.log(`\n📋 Available endpoints:`);
      console.log(`   POST /api/game/new - Create new game`);
      console.log(`   POST /api/game/:id/guess - Submit guess`);
      console.log(`   POST /api/users/auth/login - Login`);
      console.log(`   POST /api/users/auth/register - Register`);
    });
  }
}

const gateway = new ApiGateway();
gateway.start();

// index.ts - Fixed API Gateway main server

import express from "express";
import cors from "cors";
import helmet from "helmet";
import gameRoutes from "./routes/gameRoutes";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";

// Type definitions for health check responses
interface HealthCheckResponse {
  success: boolean;
  status: string;
  timestamp: string;
  service?: string;
  database?: string;
  [key: string]: any;
}

const app = express();
const PORT = process.env.PORT || 8082;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:3000",
  "http://localhost:8080",
  "https://devstud.imn.htwk-leipzig.de",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl requests, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.path} ${res.statusCode} - ${duration}ms - ${req.ip}`
    );
  });

  next();
});

// Service URLs
const GAME_SERVICE_URL =
  process.env.GAME_SERVICE_URL || "http://localhost:3002";
const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://localhost:3003";
const PROFILE_SERVICE_URL =
  process.env.PROFILE_SERVICE_URL || "http://localhost:3004";

// Route mounting
app.use("/api/game", gameRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// Root endpoint with service information
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "wordle-api-gateway",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      game: "/api/game",
      health: "/api/health",
    },
    oauth_flow: {
      login: "GET /api/auth/login",
      callback: "GET /api/auth/callback",
      refresh: "POST /api/auth/refresh",
      logout: "POST /api/auth/logout",
    },
  });
});

// Health check with enhanced service monitoring
app.get("/api/health", async (req, res) => {
  try {
    const healthChecks: any[] = [];
    const currentTime = new Date().getTime();

    // Check Game Service
    try {
      const gameHealthResponse = await fetch(`${GAME_SERVICE_URL}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      const gameHealth =
        (await gameHealthResponse.json()) as HealthCheckResponse;

      healthChecks.push({
        service: "game-service",
        status: gameHealthResponse.ok ? "healthy" : "unhealthy",
        url: GAME_SERVICE_URL,
        response_time: gameHealth.timestamp
          ? currentTime - new Date(gameHealth.timestamp).getTime()
          : null,
        details: gameHealth,
      });
    } catch (error: any) {
      healthChecks.push({
        service: "game-service",
        status: "unhealthy",
        url: GAME_SERVICE_URL,
        error: error.message || "Connection failed",
      });
    }

    // Check User Service
    try {
      const userHealthResponse = await fetch(`${USER_SERVICE_URL}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      const userHealth =
        (await userHealthResponse.json()) as HealthCheckResponse;

      healthChecks.push({
        service: "user-service",
        status: userHealthResponse.ok ? "healthy" : "unhealthy",
        url: USER_SERVICE_URL,
        response_time: userHealth.timestamp
          ? currentTime - new Date(userHealth.timestamp).getTime()
          : null,
        details: userHealth,
      });
    } catch (error: any) {
      healthChecks.push({
        service: "user-service",
        status: "unhealthy",
        url: USER_SERVICE_URL,
        error: error.message || "Connection failed",
      });
    }

    // Check Profile Service (when available)
    try {
      const profileHealthResponse = await fetch(
        `${PROFILE_SERVICE_URL}/health`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000),
        }
      );

      const profileHealth =
        (await profileHealthResponse.json()) as HealthCheckResponse;

      healthChecks.push({
        service: "profile-service",
        status: profileHealthResponse.ok ? "healthy" : "unhealthy",
        url: PROFILE_SERVICE_URL,
        response_time: profileHealth.timestamp
          ? currentTime - new Date(profileHealth.timestamp).getTime()
          : null,
        details: profileHealth,
      });
    } catch (error: any) {
      healthChecks.push({
        service: "profile-service",
        status: "unhealthy",
        url: PROFILE_SERVICE_URL,
        error: error.message || "Connection failed",
      });
    }

    const healthyServices = healthChecks.filter(
      (check) => check.status === "healthy"
    );
    const allHealthy = healthyServices.length === healthChecks.length;

    const overallStatus = allHealthy
      ? "healthy"
      : healthyServices.length > 0
      ? "degraded"
      : "unhealthy";

    res.status(allHealthy ? 200 : 503).json({
      success: true,
      status: overallStatus,
      service: "api-gateway",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      port: PORT,
      dependencies: healthChecks,
      summary: {
        total_services: healthChecks.length,
        healthy_services: healthyServices.length,
        unhealthy_services: healthChecks.length - healthyServices.length,
      },
    });
  } catch (error: any) {
    console.error("Health check error:", error);

    res.status(500).json({
      success: false,
      status: "unhealthy",
      service: "api-gateway",
      timestamp: new Date().toISOString(),
      error: "Health check failed",
      message: error.message,
    });
  }
});

// API documentation endpoint
app.get("/api/docs", (req, res) => {
  res.json({
    success: true,
    documentation: {
      authentication: {
        description: "OAuth2 authentication with IMN-GitLab",
        endpoints: {
          "GET /api/auth/login": "Initiate OAuth2 login flow",
          "GET /api/auth/callback": "Handle OAuth2 callback (redirect)",
          "POST /api/auth/callback": "Handle OAuth2 callback (API)",
          "POST /api/auth/refresh": "Refresh access token",
          "POST /api/auth/logout": "Logout current session",
          "POST /api/auth/logout-all": "Logout all sessions",
          "GET /api/auth/me": "Get current user info",
        },
      },
      users: {
        description: "User profile management",
        endpoints: {
          "GET /api/users/me": "Get current user profile",
          "PUT /api/users/me": "Update current user profile",
          "DELETE /api/users/me": "Deactivate current user account",
          "GET /api/users/profile/:id": "Get public user profile",
          "GET /api/users/search": "Search users",
          "GET /api/users/stats": "Get user statistics",
        },
      },
      game: {
        description: "Wordle game logic",
        endpoints: {
          "POST /api/game/guess": "Submit word guess",
          "GET /api/game/word": "Get current word (admin)",
          "GET /api/game/stats": "Get game statistics",
        },
      },
    },
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.path,
    method: req.method,
    available_endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      game: "/api/game",
      health: "/api/health",
      docs: "/api/docs",
    },
    suggestion: "Check /api/docs for available endpoints",
  });
});

// Global error handler
app.use((error: any, req: any, res: any, next: any) => {
  console.error("API Gateway error:", error);

  if (error.message && error.message.includes("CORS")) {
    return res.status(403).json({
      success: false,
      error: "CORS policy violation",
      message: "Origin not allowed",
    });
  }

  const statusCode = error.statusCode || error.status || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : error.message;

  res.status(statusCode).json({
    success: false,
    error: "API Gateway error",
    message: message,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
🌐 API Gateway started successfully!
📍 Port: ${PORT}
🔗 Environment: ${process.env.NODE_ENV || "development"}
🏥 Health Check: http://localhost:${PORT}/api/health
📚 Documentation: http://localhost:${PORT}/api/docs

🔌 Service Endpoints:
   - Auth: http://localhost:${PORT}/api/auth
   - Users: http://localhost:${PORT}/api/users  
   - Game: http://localhost:${PORT}/api/game

🔗 Backend Services:
   - Game Service: ${GAME_SERVICE_URL}
   - User Service: ${USER_SERVICE_URL}
   - Profile Service: ${PROFILE_SERVICE_URL}
  `);
});

export default app;

/*import express from "express";
import cors from "cors";
import gameRoutes from "./routes/gameRoutes";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";

const app = express();
const PORT = process.env.PORT || 8082;

app.use(cors());
app.use(express.json());

// Route to game service
app.use("/api/game", gameRoutes);

// Route to user service (authentication)
app.use("/api/auth", authRoutes);

// Route to profile service (user operations)
app.use("/api/users", userRoutes);

// Health check
app.get("/api/health", async (req, res) => {
  try {
    const healthChecks = [];

    try {
      const gameHealth = await fetch(
        `${process.env.GAME_SERVICE_URL || "http://localhost:3002"}/health`
      );
      healthChecks.push({
        service: "game-service",
        status: gameHealth.ok ? "healthy" : "unhealthy",
        url: process.env.GAME_SERVICE_URL || "http://localhost:3002",
      });
    } catch (error) {
      healthChecks.push({
        service: "game-service",
        status: "unhealthy",
        error: "Connection failed",
      });
    }

    try {
      const userHealth = await fetch(
        `${process.env.USER_SERVICE_URL || "http://localhost:3003"}/health`
      );
      healthChecks.push({
        service: "user-service",
        status: userHealth.ok ? "healthy" : "unhealthy",
        url: process.env.USER_SERVICE_URL || "http://localhost:3003",
      });
    } catch (error) {
      healthChecks.push({
        service: "user-service",
        status: "unhealthy",
        error: "Connection failed",
      });
    }

    const allHealthy = healthChecks.every(
      (check) => check.status === "healthy"
    );

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? "healthy" : "degraded",
      service: "api-gateway",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      dependencies: healthChecks,
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      service: "api-gateway",
      error: "Health check failed",
    });
  }
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
    method: req.method,
  });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

export default app;
*/
