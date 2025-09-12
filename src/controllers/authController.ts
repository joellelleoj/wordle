import { Request, Response } from "express";
import { AuthService } from "../services/authService";
import {
  validateRegistration,
  validateLogin,
  validateTokenRefresh,
} from "../utils/validation";

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and OAuth management
 */
export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * @swagger
   * /api/v1/auth/register:
   *   post:
   *     summary: Register a new user with traditional email/password
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - email
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *                 minLength: 3
   *                 maxLength: 30
   *                 pattern: '^[a-zA-Z0-9]+$'
   *                 example: "player123"
   *               email:
   *                 type: string
   *                 format: email
   *                 example: "player@example.com"
   *               password:
   *                 type: string
   *                 minLength: 6
   *                 maxLength: 128
   *                 example: "securePassword123"
   *     responses:
   *       201:
   *         description: User registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: Username or email already exists
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error } = validateRegistration(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.details.map((d: any) => d.message),
        });
        return;
      }

      const { username, email, password } = req.body;
      const result = await this.authService.registerUser(
        username,
        email,
        password
      );

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: result.user.id.toString(),
            username: result.user.username,
            email: result.user.email,
            created_at: result.user.created_at,
          },
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Registration failed";

      if (errorMessage.includes("already exists")) {
        res.status(409).json({
          success: false,
          message: errorMessage,
        });
      } else if (errorMessage.includes("must be at least")) {
        res.status(400).json({
          success: false,
          message: errorMessage,
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Registration failed",
          ...(process.env.NODE_ENV === "development" && {
            error: errorMessage,
          }),
        });
      }
    }
  };

  /**
   * @swagger
   * /api/v1/auth/login:
   *   post:
   *     summary: Login with username and password
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *                 example: "player123"
   *               password:
   *                 type: string
   *                 example: "securePassword123"
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       401:
   *         description: Invalid credentials
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error } = validateLogin(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.details.map((d: any) => d.message),
        });
        return;
      }

      const { username, password } = req.body;
      const result = await this.authService.loginUser(username, password);

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: result.user.id.toString(),
            username: result.user.username,
            email: result.user.email,
            gitlab_id: result.user.gitlab_id,
            display_name: result.user.display_name,
          },
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Login failed";
      res.status(401).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  /**
   * @swagger
   * /api/v1/auth/gitlab/login:
   *   get:
   *     summary: Initiate GitLab OAuth login
   *     tags: [Authentication]
   *     description: Returns GitLab OAuth authorization URL for universal GitLab user authentication
   *     responses:
   *       200:
   *         description: OAuth URL generated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 authUrl:
   *                   type: string
   *                   format: uri
   *                   example: "https://git.imn.htwk-leipzig.de/oauth/authorize?..."
   *                 message:
   *                   type: string
   *                   example: "Redirect to this URL to authenticate with GitLab"
   *       500:
   *         description: OAuth URL generation failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  gitlabLogin = async (req: Request, res: Response): Promise<void> => {
    try {
      const authUrl = this.authService.generateOAuthUrl();

      res.status(200).json({
        success: true,
        authUrl: authUrl,
        message: "Redirect to this URL to authenticate with GitLab",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "OAuth URL generation failed";

      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  /**
   * @swagger
   * /api/v1/auth/callback:
   *   get:
   *     summary: GitLab OAuth callback (browser redirect)
   *     tags: [Authentication]
   *     description: Handles GitLab OAuth callback for browser redirects
   *     parameters:
   *       - in: query
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: Authorization code from GitLab
   *       - in: query
   *         name: state
   *         schema:
   *           type: string
   *         description: CSRF protection state parameter
   *       - in: query
   *         name: error
   *         schema:
   *           type: string
   *         description: OAuth error if any
   *     responses:
   *       302:
   *         description: Redirect to frontend with success or error
   *       400:
   *         description: Missing or invalid authorization code
   *   post:
   *     summary: GitLab OAuth callback (API call)
   *     tags: [Authentication]
   *     description: Handles GitLab OAuth callback for API calls
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - code
   *             properties:
   *               code:
   *                 type: string
   *                 description: Authorization code from GitLab
   *               state:
   *                 type: string
   *                 description: CSRF protection state parameter
   *     responses:
   *       200:
   *         description: OAuth authentication successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       400:
   *         description: Invalid authorization code or OAuth error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       422:
   *         description: Invalid GitLab user data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  gitlabCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      // Handle both GET (browser redirect) and POST (API call)
      const code = req.query.code || req.body.code;
      const error = req.query.error || req.body.error;
      const state = req.query.state || req.body.state;

      if (error) {
        console.error("OAuth error:", error);

        if (req.method === "GET") {
          const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
          res.redirect(
            `${clientUrl}?error=${encodeURIComponent(error.toString())}`
          );
          return;
        } else {
          res.status(400).json({
            success: false,
            message: `OAuth error: ${error}`,
          });
          return;
        }
      }

      if (!code) {
        console.error("No authorization code received");

        if (req.method === "GET") {
          const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
          res.redirect(`${clientUrl}?error=no_code`);
          return;
        } else {
          res.status(400).json({
            success: false,
            message: "Authorization code is required",
          });
          return;
        }
      }

      console.log("Processing GitLab OAuth callback for universal user");

      const redirectUri = this.getGitLabRedirectUri();

      // Exchange code for access token
      const gitlabAccessToken = await this.authService.exchangeCodeForToken(
        code as string,
        redirectUri
      );

      // Get user info from GitLab
      const gitlabUser = await this.authService.getGitLabUserInfo(
        gitlabAccessToken
      );

      // Create or login user - ACCEPTS ANY GitLab user
      const result = await this.authService.loginOrCreateUserFromGitLab(
        gitlabUser
      );

      if (req.method === "GET") {
        // Browser redirect - redirect to frontend with success data
        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        const successData = {
          success: true,
          data: {
            user: {
              id: result.user.id.toString(),
              username: result.user.username,
              email: result.user.email,
              gitlab_id: result.user.gitlab_id,
              display_name: result.user.display_name,
            },
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
          },
        };

        const successUrl = `${clientUrl}/oauth/success?data=${encodeURIComponent(
          JSON.stringify(successData)
        )}`;
        res.redirect(successUrl);
      } else {
        // API call - return JSON response
        res.status(200).json({
          success: true,
          message: `Welcome ${
            gitlabUser.name || gitlabUser.username
          }! GitLab OAuth successful`,
          data: {
            user: {
              id: result.user.id.toString(),
              username: result.user.username,
              email: result.user.email,
              gitlab_id: result.user.gitlab_id,
              display_name: result.user.display_name,
            },
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
          },
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "OAuth authentication failed";
      console.error("GitLab OAuth callback error:", error);

      if (req.method === "GET") {
        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        res.redirect(`${clientUrl}?error=${encodeURIComponent(errorMessage)}`);
      } else {
        let statusCode = 500;
        if (errorMessage.includes("Token exchange failed")) {
          statusCode = 400;
        } else if (errorMessage.includes("Invalid GitLab user data")) {
          statusCode = 422;
        }

        res.status(statusCode).json({
          success: false,
          message: errorMessage,
        });
      }
    }
  };

  /**
   * @swagger
   * /api/v1/auth/refresh:
   *   post:
   *     summary: Refresh JWT access token
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refreshToken
   *             properties:
   *               refreshToken:
   *                 type: string
   *                 description: Valid JWT refresh token
   *     responses:
   *       200:
   *         description: Tokens refreshed successfully
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
   *                   example: "Tokens refreshed successfully"
   *                 data:
   *                   type: object
   *                   properties:
   *                     accessToken:
   *                       type: string
   *                     refreshToken:
   *                       type: string
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       401:
   *         description: Invalid or expired refresh token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error } = validateTokenRefresh(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.details.map((d: any) => d.message),
        });
        return;
      }

      const { refreshToken } = req.body;
      const newTokens = await this.authService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        message: "Tokens refreshed successfully",
        data: newTokens,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Token refresh failed";

      res.status(401).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  /**
   * @swagger
   * /api/v1/auth/logout:
   *   post:
   *     summary: Logout user and invalidate refresh token
   *     tags: [Authentication]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               refreshToken:
   *                 type: string
   *                 description: Refresh token to invalidate
   *     responses:
   *       200:
   *         description: Logout successful
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
   *                   example: "Logout successful"
   *       500:
   *         description: Logout completed with errors
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: "Logout completed with errors"
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await this.authService.logoutUser(refreshToken);
      }

      res.status(200).json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Logout completed with errors",
      });
    }
  };

  /**
   * @swagger
   * /api/v1/auth/me:
   *   get:
   *     summary: Get current authenticated user information
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User information retrieved successfully
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
   *                     user:
   *                       $ref: '#/components/schemas/User'
   *       401:
   *         description: Authentication required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Failed to get user info
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  getMe = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.userId || user.id,
            username: user.username,
            email: user.email,
            gitlab_id: user.gitlab_id,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to get user info",
      });
    }
  };

  // HELPER: Get GitLab redirect URI consistently
  private getGitLabRedirectUri(): string {
    return (
      process.env.GITLAB_REDIRECT_URI ||
      "http://localhost:3003/api/v1/auth/callback"
    );
  }

  /**
   * @swagger
   * /api/v1/auth/health:
   *   get:
   *     summary: Authentication service health check
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthResponse'
   *       503:
   *         description: Service is unhealthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 service:
   *                   type: string
   *                   example: "auth-controller"
   *                 status:
   *                   type: string
   *                   example: "unhealthy"
   *                 error:
   *                   type: string
   *                   example: "Health check failed"
   */
  healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json({
        success: true,
        service: "auth-controller",
        status: "healthy",
        timestamp: new Date().toISOString(),
        oauth: {
          provider: "GitLab",
          base_url: "https://git.imn.htwk-leipzig.de",
          scope: "read_user",
          universal_access: true, // Accepts any GitLab user
          redirect_uri: this.getGitLabRedirectUri(),
        },
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        service: "auth-controller",
        status: "unhealthy",
        error: "Health check failed",
      });
    }
  };
}
