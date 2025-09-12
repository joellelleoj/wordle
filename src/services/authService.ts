import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { dbConnection } from "../database/connection";
import { UserDataAccessService } from "./userDataAccessService";
import { User, CreateUserData, TokenPair, JWTPayload } from "../types/user";

// GitLab API response types
interface GitLabUser {
  id: number;
  username: string;
  name: string;
  email: string;
  avatar_url?: string;
  web_url?: string;
}

interface GitLabTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope: string;
}

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly GITLAB_CLIENT_ID: string;
  private readonly GITLAB_CLIENT_SECRET: string;
  private readonly GITLAB_REDIRECT_URI: string;
  private readonly GITLAB_BASE_URL = "https://git.imn.htwk-leipzig.de";
  private userDataService: UserDataAccessService;

  constructor() {
    this.JWT_SECRET =
      process.env.JWT_SECRET || "fallback-secret-change-in-production";
    this.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret";
    this.GITLAB_CLIENT_ID = process.env.GITLAB_CLIENT_ID!;
    this.GITLAB_CLIENT_SECRET = process.env.GITLAB_CLIENT_SECRET!;
    this.GITLAB_REDIRECT_URI = process.env.GITLAB_REDIRECT_URI!;

    this.userDataService = UserDataAccessService.getInstance();

    if (!this.GITLAB_CLIENT_ID || !this.GITLAB_CLIENT_SECRET) {
      throw new Error("GitLab OAuth credentials not configured");
    }

    if (this.JWT_SECRET === "fallback-secret-change-in-production") {
      console.warn(
        "⚠️ WARNING: Using fallback JWT secret. Set JWT_SECRET environment variable in production!"
      );
    }
  }

  // Traditional user registration
  async registerUser(
    username: string,
    email: string,
    password: string
  ): Promise<{ user: User; tokens: TokenPair }> {
    // Input validation
    if (!username || username.length < 3) {
      throw new Error("Username must be at least 3 characters long");
    }
    if (!email || !this.isValidEmail(email)) {
      throw new Error("Valid email is required");
    }
    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Check for existing users using data access service
    const existingByUsername = await this.userDataService.findUserByUsername(
      username
    );
    if (existingByUsername) {
      throw new Error("Username already exists");
    }

    const existingByEmail = await this.userDataService.findUserByEmail(email);
    if (existingByEmail) {
      throw new Error("Email already exists");
    }

    // Create user
    const passwordHash = await this.hashPassword(password);
    const userData: CreateUserData = {
      username,
      email,
      password_hash: passwordHash,
      gitlab_id: null, // FIXED: Explicit null for non-OAuth users
    };

    const user = await this.userDataService.createUser(userData);
    const tokens = await this.generateTokens(
      user.id,
      user.username,
      user.email
    );

    return { user, tokens };
  }

  // Traditional user login
  async loginUser(
    username: string,
    password: string
  ): Promise<{ user: User; tokens: TokenPair }> {
    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    const user = await this.userDataService.findUserByUsername(username);
    if (!user || !user.is_active) {
      throw new Error("Invalid credentials or account deactivated");
    }

    if (!user.password_hash) {
      throw new Error("This account uses OAuth login only");
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    const tokens = await this.generateTokens(
      user.id,
      user.username,
      user.email
    );
    return { user, tokens };
  }

  // UNIVERSAL GitLab OAuth - works for ANY GitLab user
  generateOAuthUrl(): string {
    const state = this.generateSecureState();

    // Store state for CSRF protection
    this.storeOAuthState(state);

    const params = new URLSearchParams({
      client_id: this.GITLAB_CLIENT_ID,
      redirect_uri: this.GITLAB_REDIRECT_URI,
      response_type: "code",
      scope: "read_user",
      state: state,
    });

    return `${this.GITLAB_BASE_URL}/oauth/authorize?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(
    code: string,
    redirectUri: string
  ): Promise<string> {
    try {
      console.log("🔄 Exchanging code for token with GitLab");
      console.log("Using redirect URI:", redirectUri);

      const tokenData = {
        client_id: this.GITLAB_CLIENT_ID,
        client_secret: this.GITLAB_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri, // CRITICAL: Must match exactly
      };

      const response = await fetch(`${this.GITLAB_BASE_URL}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(tokenData),
      });

      const responseText = await response.text();
      console.log("Token exchange response status:", response.status);

      if (!response.ok) {
        console.error("Token exchange failed:", response.status, responseText);
        throw new Error(
          `Token exchange failed: ${response.status} ${responseText}`
        );
      }

      let result: GitLabTokenResponse;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse token response:", responseText);
        throw new Error("Invalid JSON response from GitLab token endpoint");
      }

      if (!result.access_token) {
        console.error("No access token in response:", result);
        throw new Error("No access token received from GitLab");
      }

      console.log("✅ Token exchange successful");
      return result.access_token;
    } catch (error) {
      console.error("Token exchange error:", error);
      throw new Error("Failed to exchange authorization code for token");
    }
  }

  // Get user info from GitLab - UNIVERSAL for any GitLab user
  async getGitLabUserInfo(accessToken: string): Promise<GitLabUser> {
    try {
      const response = await fetch(`${this.GITLAB_BASE_URL}/api/v4/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.status}`);
      }

      const userData = (await response.json()) as GitLabUser;

      // Validate required fields
      if (!userData.id || !userData.username || !userData.email) {
        throw new Error("Invalid GitLab user data received");
      }

      return userData;
    } catch (error) {
      console.error("GitLab user info error:", error);
      throw new Error("Failed to retrieve GitLab user information");
    }
  }

  // Create or login user from GitLab - ACCEPTS ANY GitLab user
  async loginOrCreateUserFromGitLab(
    gitlabUser: GitLabUser
  ): Promise<{ user: User; tokens: TokenPair }> {
    try {
      // Check if user exists by GitLab ID
      let existingUser = await this.userDataService.findUserByGitlabId(
        gitlabUser.id
      );

      if (!existingUser) {
        // Check by email to handle account linking
        existingUser = await this.userDataService.findUserByEmail(
          gitlabUser.email
        );

        if (existingUser) {
          // Link GitLab account to existing user
          await this.linkGitLabAccount(existingUser.id, gitlabUser);
          // Refresh user data
          existingUser = await this.userDataService.findUserById(
            existingUser.id
          );
        } else {
          // Create new user - ACCEPT ANY GITLAB USER
          existingUser = await this.createUserFromGitLab(gitlabUser);
        }
      } else {
        // Update existing GitLab user info
        await this.updateGitLabUserInfo(existingUser.id, gitlabUser);
        existingUser = await this.userDataService.findUserById(existingUser.id);
      }

      if (!existingUser) {
        throw new Error("Failed to create or retrieve user");
      }

      // Generate JWT tokens
      const tokens = await this.generateTokens(
        existingUser.id,
        existingUser.username,
        existingUser.email
      );

      return { user: existingUser, tokens };
    } catch (error) {
      console.error("GitLab user login/creation failed:", error);
      throw new Error("Failed to process GitLab authentication");
    }
  }

  // FIXED: JWT token generation with proper typing
  // FIXED: JWT token generation without type casting issues
  private async generateTokens(
    userId: number,
    username: string,
    email: string
  ): Promise<TokenPair> {
    const accessTokenPayload = {
      userId: userId.toString(),
      username,
      email,
      type: "access" as const,
    };

    const refreshTokenPayload = {
      userId: userId.toString(),
      username,
      email,
      type: "refresh" as const,
    };

    const jwtSecret = this.JWT_SECRET;
    const jwtRefreshSecret = this.JWT_REFRESH_SECRET;

    if (!jwtSecret || !jwtRefreshSecret) {
      throw new Error("JWT secrets are not properly configured");
    }

    const accessToken = jwt.sign(accessTokenPayload, jwtSecret, {
      expiresIn: 60 * 60, // 1 hour in seconds
      issuer: "wordle-user-service",
      audience: "wordle-app",
    });

    const refreshToken = jwt.sign(refreshTokenPayload, jwtRefreshSecret, {
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      issuer: "wordle-user-service",
      audience: "wordle-app",
    });

    // Store refresh token in database using data access service
    await this.storeRefreshToken(userId, refreshToken);

    return { accessToken, refreshToken };
  }

  // Token refresh with proper validation
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        this.JWT_REFRESH_SECRET as jwt.Secret
      ) as JWTPayload;

      if (decoded.type !== "refresh") {
        throw new Error("Invalid refresh token type");
      }

      // Verify refresh token exists in database
      const session = await this.userDataService.findSessionByRefreshToken(
        refreshToken
      );
      if (!session) {
        throw new Error("Session not found or expired");
      }

      const user = await this.userDataService.findUserById(
        parseInt(decoded.userId)
      );
      if (!user || !user.is_active) {
        throw new Error("User not found or inactive");
      }

      // Delete old session and create new tokens
      await this.userDataService.deleteUserSession(refreshToken);
      return await this.generateTokens(user.id, user.username, user.email);
    } catch (error) {
      throw new Error("Token refresh failed");
    }
  }

  // Logout with session cleanup
  async logoutUser(refreshToken: string): Promise<void> {
    if (refreshToken) {
      await this.userDataService.deleteUserSession(refreshToken);
    }
  }

  // Cleanup expired tokens and states
  async cleanupExpiredTokens(): Promise<void> {
    try {
      // Use data access service for cleanup
      await this.userDataService.cleanupExpiredSessions();

      // Cleanup expired OAuth states
      await dbConnection.query(
        "DELETE FROM user_schema.oauth_states WHERE expires_at < NOW()"
      );

      console.log("Expired tokens cleanup completed");
    } catch (error) {
      console.error("Failed to cleanup expired tokens:", error);
    }
  }

  // Helper method with correct return type
  private async createUserFromGitLab(gitlabUser: GitLabUser): Promise<User> {
    // Handle potential username conflicts for any GitLab user
    let username = gitlabUser.username;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        const userData: CreateUserData = {
          username,
          email: gitlabUser.email,
          password_hash: null, // OAuth users don't have passwords
          gitlab_id: gitlabUser.id,
          display_name: gitlabUser.name,
          avatar_url: gitlabUser.avatar_url || null,
        };

        return await this.userDataService.createUser(userData);
      } catch (error: any) {
        if (error.message.includes("Username already exists")) {
          // Username conflict, try with suffix
          attempts++;
          username = `${gitlabUser.username}_${attempts}`;
        } else {
          throw error;
        }
      }
    }

    throw new Error("Unable to create unique username for GitLab user");
  }

  private async linkGitLabAccount(
    userId: number,
    gitlabUser: GitLabUser
  ): Promise<void> {
    await this.userDataService.updateUser(userId, {
      gitlab_id: gitlabUser.id,
      display_name: gitlabUser.name,
      avatar_url: gitlabUser.avatar_url || null,
    });
  }

  private async updateGitLabUserInfo(
    userId: number,
    gitlabUser: GitLabUser
  ): Promise<void> {
    await this.userDataService.updateUser(userId, {
      display_name: gitlabUser.name,
      avatar_url: gitlabUser.avatar_url || null,
    });
  }

  private async storeRefreshToken(
    userId: number,
    refreshToken: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.userDataService.createUserSession(
      userId,
      refreshToken,
      expiresAt
    );
  }

  private generateSecureState(): string {
    return require("crypto").randomBytes(32).toString("hex");
  }

  private async storeOAuthState(state: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await dbConnection.query(
      `INSERT INTO user_schema.oauth_states (state_token, expires_at)
       VALUES ($1, $2)`,
      [state, expiresAt]
    );
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
