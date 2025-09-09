import { Request, Response } from "express";
import { AuthService } from "../services/authService";
import {
  validateRegistration,
  validateLogin,
  validateTokenRefresh,
} from "../utils/validation";

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

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
            id: result.user.id,
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
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
    }
  };

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
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
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

  // GitLab OAuth login initiation
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

  // GitLab OAuth callback handler (GET - for redirects)
  gitlabCallbackGet = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, error, state } = req.query;

      if (error) {
        console.log("OAuth error:", error);
        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        return res.redirect(
          `${clientUrl}/login?error=${encodeURIComponent(error.toString())}`
        );
      }

      if (!code) {
        console.log("No authorization code received");
        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        return res.redirect(`${clientUrl}/login?error=no_code`);
      }

      console.log(
        "Received OAuth code:",
        (code as string).substring(0, 10) + "..."
      );

      // Exchange code for access token
      const gitlabAccessToken = await this.authService.exchangeCodeForToken(
        code as string,
        process.env.GITLAB_REDIRECT_URI ||
          "http://localhost:3003/api/v1/auth/callback"
      );

      // Get user info from GitLab
      const gitlabUser = await this.authService.getGitLabUserInfo(
        gitlabAccessToken
      );

      // Create or login user
      const result = await this.authService.loginOrCreateUserFromGitLab(
        gitlabUser
      );

      // Redirect to frontend with success data
      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      const successData = {
        success: true,
        data: {
          user: {
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            gitlab_id: result.user.gitlab_id,
          },
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        },
      };

      const successUrl = `${clientUrl}/oauth/success?data=${encodeURIComponent(
        JSON.stringify(successData)
      )}`;
      res.redirect(successUrl);
    } catch (error) {
      console.error("GitLab OAuth callback error:", error);
      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      res.redirect(`${clientUrl}/login?error=oauth_failed`);
    }
  };

  // GitLab OAuth callback handler (POST - for API calls)
  gitlabCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, redirect_uri } = req.body;

      if (!code) {
        res.status(400).json({
          success: false,
          message: "Authorization code is required",
        });
        return;
      }

      console.log("GitLab OAuth POST callback received");

      // Exchange code for access token
      const gitlabAccessToken = await this.authService.exchangeCodeForToken(
        code,
        redirect_uri ||
          process.env.GITLAB_REDIRECT_URI ||
          "http://localhost:3003/api/v1/auth/callback"
      );

      // Get user info from GitLab
      const gitlabUser = await this.authService.getGitLabUserInfo(
        gitlabAccessToken
      );

      // Create or login user
      const result = await this.authService.loginOrCreateUserFromGitLab(
        gitlabUser
      );

      res.status(200).json({
        success: true,
        message: "GitLab OAuth login successful",
        data: {
          user: {
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            gitlab_id: result.user.gitlab_id,
          },
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "OAuth authentication failed";
      console.error("GitLab OAuth error:", error);
      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  };

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
      res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }
  };

  getMe = async (req: Request, res: Response): Promise<void> => {
    try {
      // User info should be attached by auth middleware
      const user = (req as any).user;

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.userId,
            username: user.username,
            email: user.email,
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
} /*import { Request, Response } from "express";
import fetch from "node-fetch";

export class AuthController {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private gitlabBaseUrl: string;

  constructor() {
    this.clientId = process.env.GITLAB_CLIENT_ID!;
    this.clientSecret = process.env.GITLAB_CLIENT_SECRET!;
    this.redirectUri = process.env.GITLAB_REDIRECT_URI!;
    this.gitlabBaseUrl =
      process.env.GITLAB_BASE_URL || "https://git.imn.htwk-leipzig.de";

    // Validate required environment variables
    if (!this.clientId || !this.clientSecret) {
      throw new Error("GitLab OAuth credentials not configured");
    }
  }

  // Get GitLab OAuth URL
  gitlabLogin = async (req: Request, res: Response): Promise<void> => {
    try {
      const state = this.generateState();
      const authUrl =
        `${this.gitlabBaseUrl}/oauth/authorize?` +
        `client_id=${this.clientId}&` +
        `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
        `response_type=code&` +
        `scope=read_user&` +
        `state=${state}`;

      res.json({
        success: true,
        authUrl: authUrl,
        message: "Redirect to this URL to authenticate with GitLab",
      });
    } catch (error) {
      console.error("GitLab login error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate GitLab OAuth URL",
      });
    }
  };

  // Handle GitLab callback
  gitlabCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code } = req.body;

      if (!code) {
        res.status(400).json({
          success: false,
          message: "Authorization code is required",
        });
        return;
      }

      // Step 1: Exchange code for access token
      const tokenResponse = await fetch(`${this.gitlabBaseUrl}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: code,
          grant_type: "authorization_code",
          redirect_uri: this.redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(
          "Token exchange failed:",
          tokenResponse.status,
          errorText
        );
        res.status(400).json({
          success: false,
          message: "Failed to exchange authorization code",
          error: errorText,
        });
        return;
      }

      const tokenData = (await tokenResponse.json()) as any;

      // Step 2: Get user info from GitLab
      const userResponse = await fetch(`${this.gitlabBaseUrl}/api/v4/user`, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/json",
        },
      });

      if (!userResponse.ok) {
        res.status(400).json({
          success: false,
          message: "Failed to get user info from GitLab",
        });
        return;
      }

      const gitlabUser = (await userResponse.json()) as any;

      // Step 3: Create/login user in our system
      const user = {
        id: gitlabUser.id,
        username: gitlabUser.username,
        email: gitlabUser.email,
        gitlab_id: gitlabUser.id,
        created_at: new Date().toISOString(),
      };

      // Generate our own JWT tokens
      const accessToken = this.generateJWT(user);
      const refreshToken = this.generateRefreshToken(user);

      res.json({
        success: true,
        message: "GitLab OAuth successful",
        data: {
          user: user,
          accessToken: accessToken,
          refreshToken: refreshToken,
        },
      });
    } catch (error) {
      console.error("GitLab callback error:", error);
      res.status(500).json({
        success: false,
        message: "OAuth processing failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  private generateState(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  private generateJWT(user: any): string {
    // Simple JWT generation - in production use proper JWT library
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" })
    ).toString("base64");
    const payload = Buffer.from(
      JSON.stringify({
        userId: user.id,
        username: user.username,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      })
    ).toString("base64");

    return `${header}.${payload}.signature`;
  }

  private generateRefreshToken(user: any): string {
    return `refresh_${user.id}_${Date.now()}_${Math.random().toString(36)}`;
  }
}

/*import { Request, Response } from "express";
import { AuthService } from "../services/authService";
import { GitLabOAuthService } from "../services/gitlabOAuthService";
import {
  validateRegistration,
  validateLogin,
  validateTokenRefresh,
} from "../utils/validation";

export class AuthController {
  private authService: AuthService;
  private gitlabService: GitLabOAuthService;

  constructor() {
    this.authService = new AuthService();
    this.gitlabService = new GitLabOAuthService();
  }

  // Traditional registration
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error } = validateRegistration(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.details.map((d) => d.message),
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
            id: result.user.id,
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
      res.status(400).json({ success: false, message: errorMessage });
    }
  };

  // Traditional login
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error } = validateLogin(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.details.map((d) => d.message),
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
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
          },
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Login failed";
      res.status(401).json({ success: false, message: errorMessage });
    }
  };

  // GitLab OAuth initiation
  gitlabLogin = async (req: Request, res: Response): Promise<void> => {
    try {
      const authUrl = this.gitlabService.getAuthUrl();

      res.status(200).json({
        success: true,
        authUrl: authUrl,
        message: "Redirect to this URL to authenticate with GitLab",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "GitLab login failed";
      res.status(500).json({ success: false, message: errorMessage });
    }
  };

  // GitLab OAuth callback (GET - for redirects)
  gitlabCallbackGet = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, error } = req.query;

      if (error) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        res.redirect(
          `${frontendUrl}/login?error=${encodeURIComponent(error.toString())}`
        );
        return;
      }

      if (!code || typeof code !== "string") {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        res.redirect(`${frontendUrl}/login?error=missing_code`);
        return;
      }

      const result = await this.gitlabService.handleCallback(code);

      if (result.success && result.data) {
        // Successful OAuth - redirect to frontend with success data
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const successData = encodeURIComponent(
          JSON.stringify({
            success: true,
            data: {
              user: result.data.user,
              accessToken: result.data.tokens.accessToken,
              refreshToken: result.data.tokens.refreshToken,
            },
          })
        );

        res.redirect(`${frontendUrl}/oauth/success?data=${successData}`);
      } else {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        res.redirect(`${frontendUrl}/login?error=oauth_failed`);
      }
    } catch (error) {
      console.error("GitLab OAuth callback error:", error);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/login?error=oauth_error`);
    }
  };

  // GitLab OAuth callback (POST - for API calls)
  gitlabCallbackPost = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code } = req.body;

      if (!code) {
        res.status(400).json({
          success: false,
          message: "Authorization code is required",
        });
        return;
      }

      const result = await this.gitlabService.handleCallback(code);

      res.status(200).json({
        success: true,
        message: "GitLab OAuth login successful",
        data: {
          user: result.data!.user,
          accessToken: result.data!.tokens.accessToken,
          refreshToken: result.data!.tokens.refreshToken,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "OAuth authentication failed";
      console.error("GitLab OAuth POST error:", error);
      res.status(500).json({ success: false, message: errorMessage });
    }
  };

  // Token refresh
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error } = validateTokenRefresh(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.details.map((d) => d.message),
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
      res.status(401).json({ success: false, message: errorMessage });
    }
  };

  // Logout
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
      res.status(500).json({ success: false, message: "Logout failed" });
    }
  };

  // Get current user (protected route)
  getMe = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.userId,
            username: user.username,
            email: user.email,
          },
        },
      });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to get user info" });
    }
  };
}

// src/controllers/authController.ts
import { Request, Response } from "express";
import { AuthService } from "../services/authService";
import {
  validateRegistration,
  validateLogin,
  validateTokenRefresh,
} from "../utils/validation";

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // GET /auth/gitlab/login - Initiate GitLab OAuth flow
  initializeOAuth = async (req: Request, res: Response): Promise<void> => {
    try {
      const { redirectUrl } = req.query;

      console.log("Initializing GitLab OAuth flow");

      const { url, state } = this.authService.generateOAuthUrl(
        redirectUrl as string
      );

      res.status(200).json({
        success: true,
        data: {
          authUrl: url,
          state: state,
        },
        message: "OAuth URL generated successfully",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "OAuth initialization failed";
      console.error("OAuth initialization error:", error);

      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  // GET /auth/gitlab/callback - Handle GitLab OAuth callback (redirect flow)
  handleOAuthCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, state, error } = req.query;

      console.log("OAuth callback received:", {
        code: code ? (code as string).substring(0, 10) + "..." : "missing",
        state: state ? (state as string).substring(0, 10) + "..." : "missing",
        error,
      });

      // Handle OAuth error from provider
      if (error) {
        console.error("OAuth provider error:", error);
        const errorUrl = `${
          process.env.CLIENT_URL
        }/login?error=oauth_error&details=${encodeURIComponent(
          error as string
        )}`;
        res.redirect(errorUrl);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        console.error("Missing required OAuth parameters");
        const errorUrl = `${process.env.CLIENT_URL}/login?error=missing_parameters`;
        res.redirect(errorUrl);
        return;
      }

      // Process OAuth callback
      const result = await this.authService.processOAuthCallback(
        code as string,
        state as string
      );

      // Create success URL with tokens (in production, consider using httpOnly cookies instead)
      const successUrl = new URL(`${process.env.CLIENT_URL}/oauth/success`);
      successUrl.searchParams.set("access_token", result.tokens.accessToken);
      successUrl.searchParams.set("refresh_token", result.tokens.refreshToken);
      successUrl.searchParams.set(
        "user",
        JSON.stringify({
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          gitlab_id: result.user.gitlab_id,
        })
      );

      console.log("OAuth callback successful, redirecting to frontend");
      res.redirect(successUrl.toString());
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "OAuth callback failed";
      console.error("OAuth callback error:", errorMessage);

      const errorUrl = `${
        process.env.CLIENT_URL
      }/login?error=auth_failed&message=${encodeURIComponent(errorMessage)}`;
      res.redirect(errorUrl);
    }
  };

  // POST /auth/gitlab/callback - Handle GitLab OAuth callback (API flow)
  handleOAuthCallbackPost = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { code, state } = req.body;

      console.log("OAuth callback POST received:", {
        code: code ? code.substring(0, 10) + "..." : "missing",
        state: state ? state.substring(0, 10) + "..." : "missing",
      });

      if (!code || !state) {
        res.status(400).json({
          success: false,
          message: "Missing authorization code or state parameter",
        });
        return;
      }

      // Process OAuth callback
      const result = await this.authService.processOAuthCallback(code, state);

      res.status(200).json({
        success: true,
        message: "GitLab OAuth login successful",
        data: {
          user: {
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            gitlab_id: result.user.gitlab_id,
            created_at: result.user.created_at,
          },
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "OAuth authentication failed";
      console.error("OAuth callback POST error:", error);

      res.status(401).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  // Traditional registration (keeping for backward compatibility)
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error } = validateRegistration(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.details.map((d) => d.message),
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
            id: result.user.id,
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
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  // Traditional login (keeping for backward compatibility)
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error } = validateLogin(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.details.map((d) => d.message),
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
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
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

  // Refresh token
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error } = validateTokenRefresh(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.details.map((d) => d.message),
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

  // Logout
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
      res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }
  };

  // Get current user info (protected route)
  getMe = async (req: Request, res: Response): Promise<void> => {
    try {
      // User info should be attached by auth middleware
      const user = (req as any).user;

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.userId,
            username: user.username,
            email: user.email,
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

  // Health check
  healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json({
        success: true,
        status: "healthy",
        service: "auth-service",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        status: "unhealthy",
        service: "auth-service",
        error: "Health check failed",
      });
    }
  };
}
*/
