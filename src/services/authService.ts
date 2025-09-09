// user-service/src/services/authService.ts
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { UserDataAccessService } from "./userDataAccessService";
import { CreateUserData, User } from "../types/user";

export interface JWTPayload {
  userId: number;
  username: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface GitLabUser {
  id: number;
  username: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export class AuthService {
  private userDataService: UserDataAccessService;
  private jwtSecret: string;

  constructor() {
    this.userDataService = UserDataAccessService.getInstance();
    this.jwtSecret =
      process.env.JWT_SECRET || "fallback-secret-change-in-production";

    if (this.jwtSecret === "fallback-secret-change-in-production") {
      console.warn(
        "⚠️ WARNING: Using fallback JWT secret. Set JWT_SECRET environment variable in production!"
      );
    }
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  generateTokenPair(user: User): TokenPair {
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: "1h",
      issuer: "wordle-user-service",
      audience: "wordle-app",
    });

    const refreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      this.jwtSecret,
      {
        expiresIn: "7d",
        issuer: "wordle-user-service",
        audience: "wordle-app",
      }
    );

    return { accessToken, refreshToken };
  }

  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as JWTPayload;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  async registerUser(
    username: string,
    email: string,
    password: string
  ): Promise<{ user: User; tokens: TokenPair }> {
    // Validate input
    if (!username || username.length < 3) {
      throw new Error("Username must be at least 3 characters long");
    }

    if (!email || !email.includes("@")) {
      throw new Error("Valid email is required");
    }

    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Check for existing users
    const existingUserByUsername =
      await this.userDataService.findUserByUsername(username);
    if (existingUserByUsername) {
      throw new Error("Username already exists");
    }

    const existingUserByEmail = await this.userDataService.findUserByEmail(
      email
    );
    if (existingUserByEmail) {
      throw new Error("Email already exists");
    }

    // Create user
    const passwordHash = await this.hashPassword(password);
    const userData: CreateUserData = {
      username,
      email,
      password_hash: passwordHash,
    };

    const user = await this.userDataService.createUser(userData);
    const tokens = this.generateTokenPair(user);

    // Store refresh token
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
    await this.userDataService.createUserSession(
      user.id,
      tokens.refreshToken,
      refreshExpiresAt
    );

    return { user, tokens };
  }

  async loginUser(
    username: string,
    password: string
  ): Promise<{ user: User; tokens: TokenPair }> {
    // Validate input
    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    const user = await this.userDataService.findUserByUsername(username);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    if (!user.is_active) {
      throw new Error("Account is deactivated");
    }

    if (!user.password_hash) {
      throw new Error("This account uses OAuth login only");
    }

    const isPasswordValid = await this.verifyPassword(
      password,
      user.password_hash
    );
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    const tokens = this.generateTokenPair(user);

    // Store refresh token
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
    await this.userDataService.createUserSession(
      user.id,
      tokens.refreshToken,
      refreshExpiresAt
    );

    return { user, tokens };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = jwt.verify(refreshToken, this.jwtSecret) as any;
      if (payload.type !== "refresh") {
        throw new Error("Invalid refresh token");
      }

      const session = await this.userDataService.findSessionByRefreshToken(
        refreshToken
      );
      if (!session) {
        throw new Error("Session not found or expired");
      }

      const user = await this.userDataService.findUserById(session.user_id);
      if (!user || !user.is_active) {
        throw new Error("User not found or inactive");
      }

      // Delete old session and create new tokens
      await this.userDataService.deleteUserSession(refreshToken);
      const newTokens = this.generateTokenPair(user);

      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
      await this.userDataService.createUserSession(
        user.id,
        newTokens.refreshToken,
        refreshExpiresAt
      );

      return newTokens;
    } catch (error) {
      throw new Error("Invalid or expired refresh token");
    }
  }

  async logoutUser(refreshToken: string): Promise<void> {
    await this.userDataService.deleteUserSession(refreshToken);
  }

  // GitLab OAuth methods
  async exchangeCodeForToken(
    code: string,
    redirectUri: string
  ): Promise<string> {
    const tokenUrl = `${
      process.env.GITLAB_BASE_URL || "https://git.imn.htwk-leipzig.de"
    }/oauth/token`;

    console.log("Exchanging code for token with GitLab...");

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITLAB_CLIENT_ID,
        client_secret: process.env.GITLAB_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token exchange failed:", response.status, errorText);
      throw new Error(`Failed to exchange code for token: ${response.status}`);
    }

    const data = (await response.json()) as any;
    if (!data.access_token) {
      throw new Error("No access token received");
    }

    console.log("Token exchange successful");
    return data.access_token;
  }

  async getGitLabUserInfo(accessToken: string): Promise<GitLabUser> {
    const userUrl = `${
      process.env.GITLAB_BASE_URL || "https://git.imn.htwk-leipzig.de"
    }/api/v4/user`;

    console.log("Fetching user info from GitLab...");

    const response = await fetch(userUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error("Failed to get user info from GitLab:", response.status);
      throw new Error("Failed to get user info from GitLab");
    }

    const userData = (await response.json()) as GitLabUser;
    if (!userData.id) {
      throw new Error("Invalid user data from GitLab");
    }

    console.log("GitLab user info retrieved:", userData.username);
    return userData;
  }

  async loginOrCreateUserFromGitLab(
    gitlabUser: GitLabUser
  ): Promise<{ user: User; tokens: TokenPair }> {
    let user = await this.userDataService.findUserByGitlabId(gitlabUser.id);

    if (!user) {
      // Check if user exists by email
      user = await this.userDataService.findUserByEmail(gitlabUser.email);

      if (user) {
        // Update existing user with GitLab ID
        user = await this.userDataService.updateUser(user.id, {
          gitlab_id: gitlabUser.id,
        });
      } else {
        // Create new user
        const userData: CreateUserData = {
          username: gitlabUser.username,
          email: gitlabUser.email,
          password_hash: null, // OAuth users don't have passwords
          gitlab_id: gitlabUser.id,
          display_name: gitlabUser.name || gitlabUser.username,
          avatar_url: gitlabUser.avatar_url,
        };

        try {
          user = await this.userDataService.createUser(userData);
        } catch (error) {
          // Handle username conflict by appending GitLab ID
          if (
            error instanceof Error &&
            error.message.includes("Username already exists")
          ) {
            userData.username = `${gitlabUser.username}_${gitlabUser.id}`;
            user = await this.userDataService.createUser(userData);
          } else {
            throw error;
          }
        }
      }
    }

    if (!user) {
      throw new Error("Failed to create or retrieve user");
    }

    if (!user.is_active) {
      throw new Error("Account is deactivated");
    }

    const tokens = this.generateTokenPair(user);

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
    await this.userDataService.createUserSession(
      user.id,
      tokens.refreshToken,
      refreshExpiresAt
    );

    return { user, tokens };
  }

  generateOAuthUrl(): string {
    const clientId = process.env.GITLAB_CLIENT_ID;
    const redirectUri =
      process.env.GITLAB_REDIRECT_URI ||
      "http://localhost:3003/api/v1/auth/callback";
    const gitlabBaseUrl =
      process.env.GITLAB_BASE_URL || "https://git.imn.htwk-leipzig.de";

    if (!clientId) {
      throw new Error("GitLab client ID not configured");
    }

    return `${gitlabBaseUrl}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=read_user`;
  }

  async cleanupExpiredTokens(): Promise<void> {
    try {
      await this.userDataService.cleanupExpiredSessions();
      console.log("Expired tokens cleanup completed");
    } catch (error) {
      console.error("Failed to cleanup expired tokens:", error);
    }
  }
}

/*import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { UserDataAccessService } from "./userDataAccessService";
import { CreateUserData, User } from "../types/user";

export interface JWTPayload {
  userId: number;
  username: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface GitLabUser {
  id: number;
  username: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export class AuthService {
  private userDataService: UserDataAccessService;
  private jwtSecret: string;

  constructor() {
    this.userDataService = new UserDataAccessService();
    this.jwtSecret =
      process.env.JWT_SECRET || "fallback-secret-change-in-production";

    if (this.jwtSecret === "fallback-secret-change-in-production") {
      console.warn(
        "⚠️  WARNING: Using fallback JWT secret. Set JWT_SECRET environment variable in production!"
      );
    }
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  generateTokenPair(user: User): TokenPair {
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: "1h",
      issuer: "wordle-user-service",
      audience: "wordle-app",
    });

    const refreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      this.jwtSecret,
      {
        expiresIn: "7d",
        issuer: "wordle-user-service",
        audience: "wordle-app",
      }
    );

    return { accessToken, refreshToken };
  }

  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as JWTPayload;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  async registerUser(
    username: string,
    email: string,
    password: string
  ): Promise<{ user: User; tokens: TokenPair }> {
    // Validate input
    if (!username || username.length < 3) {
      throw new Error("Username must be at least 3 characters long");
    }

    if (!email || !email.includes("@")) {
      throw new Error("Valid email is required");
    }

    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Check for existing users
    const existingUserByUsername =
      await this.userDataService.findUserByUsername(username);
    if (existingUserByUsername) {
      throw new Error("Username already exists");
    }

    const existingUserByEmail = await this.userDataService.findUserByEmail(
      email
    );
    if (existingUserByEmail) {
      throw new Error("Email already exists");
    }

    // Create user
    const passwordHash = await this.hashPassword(password);
    const userData: CreateUserData = {
      username,
      email,
      password_hash: passwordHash,
    };

    const user = await this.userDataService.createUser(userData);
    const tokens = this.generateTokenPair(user);

    // Store refresh token
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
    await this.userDataService.createUserSession(
      user.id,
      tokens.refreshToken,
      refreshExpiresAt
    );

    return { user, tokens };
  }

  async loginUser(
    username: string,
    password: string
  ): Promise<{ user: User; tokens: TokenPair }> {
    // Validate input
    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    const user = await this.userDataService.findUserByUsername(username);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    if (!user.is_active) {
      throw new Error("Account is deactivated");
    }

    if (!user.password_hash) {
      throw new Error("This account uses OAuth login only");
    }

    const isPasswordValid = await this.verifyPassword(
      password,
      user.password_hash
    );
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    const tokens = this.generateTokenPair(user);

    // Store refresh token
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
    await this.userDataService.createUserSession(
      user.id,
      tokens.refreshToken,
      refreshExpiresAt
    );

    return { user, tokens };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = jwt.verify(refreshToken, this.jwtSecret) as any;
      if (payload.type !== "refresh") {
        throw new Error("Invalid refresh token");
      }

      const session = await this.userDataService.findSessionByRefreshToken(
        refreshToken
      );
      if (!session) {
        throw new Error("Session not found or expired");
      }

      const user = await this.userDataService.findUserById(session.user_id);
      if (!user || !user.is_active) {
        throw new Error("User not found or inactive");
      }

      // Delete old session and create new tokens
      await this.userDataService.deleteUserSession(refreshToken);
      const newTokens = this.generateTokenPair(user);

      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
      await this.userDataService.createUserSession(
        user.id,
        newTokens.refreshToken,
        refreshExpiresAt
      );

      return newTokens;
    } catch (error) {
      throw new Error("Invalid or expired refresh token");
    }
  }

  async logoutUser(refreshToken: string): Promise<void> {
    await this.userDataService.deleteUserSession(refreshToken);
  }

  // GitLab OAuth methods
  async exchangeCodeForToken(
    code: string,
    redirectUri: string
  ): Promise<string> {
    const tokenUrl = `${
      process.env.GITLAB_BASE_URL || "https://git.imn.htwk-leipzig.de"
    }/oauth/token`;

    console.log("Exchanging code for token with GitLab...");

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITLAB_CLIENT_ID,
        client_secret: process.env.GITLAB_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token exchange failed:", response.status, errorText);
      throw new Error(`Failed to exchange code for token: ${response.status}`);
    }

    const data = (await response.json()) as any;
    if (!data.access_token) {
      throw new Error("No access token received");
    }

    console.log("Token exchange successful");
    return data.access_token;
  }

  async getGitLabUserInfo(accessToken: string): Promise<GitLabUser> {
    const userUrl = `${
      process.env.GITLAB_BASE_URL || "https://git.imn.htwk-leipzig.de"
    }/api/v4/user`;

    console.log("Fetching user info from GitLab...");

    const response = await fetch(userUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error("Failed to get user info from GitLab:", response.status);
      throw new Error("Failed to get user info from GitLab");
    }

    const userData = (await response.json()) as GitLabUser;
    if (!userData.id) {
      throw new Error("Invalid user data from GitLab");
    }

    console.log("GitLab user info retrieved:", userData.username);
    return userData;
  }

  async loginOrCreateUserFromGitLab(
    gitlabUser: GitLabUser
  ): Promise<{ user: User; tokens: TokenPair }> {
    let user = await this.userDataService.findUserByGitlabId(gitlabUser.id);

    if (!user) {
      // Check if user exists by email
      user = await this.userDataService.findUserByEmail(gitlabUser.email);

      if (user) {
        // Update existing user with GitLab ID
        user = await this.userDataService.updateUser(user.id, {
          gitlab_id: gitlabUser.id,
        });
      } else {
        // Create new user
        const userData: CreateUserData = {
          username: gitlabUser.username,
          email: gitlabUser.email,
          password_hash: null, // OAuth users don't have passwords
          gitlab_id: gitlabUser.id,
        };

        try {
          user = await this.userDataService.createUser(userData);
        } catch (error) {
          // Handle username conflict by appending GitLab ID
          userData.username = `${gitlabUser.username}_${gitlabUser.id}`;
          user = await this.userDataService.createUser(userData);
        }
      }
    }

    if (!user) {
      throw new Error("Failed to create or retrieve user");
    }

    if (!user.is_active) {
      throw new Error("Account is deactivated");
    }

    const tokens = this.generateTokenPair(user);

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
    await this.userDataService.createUserSession(
      user.id,
      tokens.refreshToken,
      refreshExpiresAt
    );

    return { user, tokens };
  }

  generateOAuthUrl(): string {
    const clientId = process.env.GITLAB_CLIENT_ID;
    const redirectUri =
      process.env.GITLAB_REDIRECT_URI ||
      "http://localhost:3003/api/v1/auth/callback";
    const gitlabBaseUrl =
      process.env.GITLAB_BASE_URL || "https://git.imn.htwk-leipzig.de";

    if (!clientId) {
      throw new Error("GitLab client ID not configured");
    }

    return `${gitlabBaseUrl}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=read_user`;
  }

  async cleanupExpiredTokens(): Promise<void> {
    // Implementation for cleaning up expired tokens
    // This would typically be called by a cleanup job
    console.log("Cleaning up expired tokens...");
  }
}
// src/services/authService.ts
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fetch from "node-fetch";
import { UserDataAccessService } from "./userDataAccessService";
import { CreateUserData, User } from "../types/user";

export interface JWTPayload {
  userId: number;
  username: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface GitLabUser {
  id: number;
  username: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface OAuthState {
  state: string;
  redirectUrl?: string;
  timestamp: number;
}

export class AuthService {
  private userDataService: UserDataAccessService;
  private jwtSecret: string;
  private oauthStates: Map<string, OAuthState> = new Map();

  constructor() {
    this.userDataService = new UserDataAccessService();
    this.jwtSecret = process.env.JWT_SECRET || "fallback-secret";

    // Cleanup expired OAuth states every 10 minutes
    setInterval(() => this.cleanupExpiredStates(), 10 * 60 * 1000);
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  generateTokenPair(user: User): TokenPair {
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: "1h",
    });

    const refreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      this.jwtSecret,
      { expiresIn: "7d" }
    );

    return { accessToken, refreshToken };
  }

  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as JWTPayload;
    } catch (error) {
      throw new Error("Invalid token");
    }
  }

  // OAuth2 Authorization Code Flow for Public Clients
  generateOAuthUrl(redirectUrl?: string): { url: string; state: string } {
    const state = crypto.randomBytes(32).toString("hex");
    const clientId = process.env.OAUTH_CLIENT_ID!;
    const baseRedirectUri = process.env.OAUTH_REDIRECT_URI!;

    // Store state for validation
    this.oauthStates.set(state, {
      state,
      redirectUrl,
      timestamp: Date.now(),
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: baseRedirectUri,
      response_type: "code",
      scope: "read_user",
      state: state,
    });

    const authUrl = `${
      process.env.OAUTH_AUTHORIZATION_URL
    }?${params.toString()}`;

    return { url: authUrl, state };
  }

  // Exchange authorization code for access token (Public Client - NO SECRET)
  async exchangeCodeForToken(code: string, state: string): Promise<string> {
    // Validate state token
    const storedState = this.oauthStates.get(state);
    if (!storedState) {
      throw new Error("Invalid or expired state token");
    }

    // Remove used state
    this.oauthStates.delete(state);

    // Check if state is not too old (10 minutes max)
    if (Date.now() - storedState.timestamp > 10 * 60 * 1000) {
      throw new Error("State token expired");
    }

    const tokenUrl = process.env.OAUTH_TOKEN_URL!;

    // For public clients, we use PKCE or just don't send client_secret
    const tokenData = {
      client_id: process.env.OAUTH_CLIENT_ID!,
      // NO client_secret for public clients
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.OAUTH_REDIRECT_URI!,
    };

    console.log("Token exchange request:", {
      url: tokenUrl,
      client_id: tokenData.client_id,
      redirect_uri: tokenData.redirect_uri,
      grant_type: tokenData.grant_type,
      code: code.substring(0, 10) + "...",
    });

    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(tokenData),
      });

      const responseText = await response.text();
      console.log("Token exchange response status:", response.status);
      console.log(
        "Token exchange response headers:",
        Object.fromEntries(response.headers.entries())
      );

      if (!response.ok) {
        console.error("Token exchange failed:", response.status, responseText);
        throw new Error(
          `Token exchange failed: ${response.status} ${responseText}`
        );
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse token response:", responseText);
        throw new Error("Invalid JSON response from token endpoint");
      }

      if (!data.access_token) {
        console.error("No access token in response:", data);
        throw new Error("No access token received from OAuth provider");
      }

      return data.access_token;
    } catch (error: any) {
      console.error("Token exchange error:", error);
      throw new Error(
        `Failed to exchange authorization code: ${error.message}`
      );
    }
  }

  async getGitLabUserInfo(accessToken: string): Promise<GitLabUser> {
    const userUrl = process.env.OAUTH_USER_INFO_URL!;

    try {
      const response = await fetch(userUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("User info fetch failed:", response.status, errorText);
        throw new Error(`Failed to fetch user info: ${response.status}`);
      }

      const userData = (await response.json()) as GitLabUser;

      if (!userData.id) {
        console.error("Invalid user data received:", userData);
        throw new Error("Invalid user data from GitLab");
      }

      return userData;
    } catch (error: any) {
      console.error("GitLab user info error:", error);
      throw new Error(`Failed to get user info from GitLab: ${error.message}`);
    }
  }

  async processOAuthCallback(
    code: string,
    state: string
  ): Promise<{ user: User; tokens: TokenPair }> {
    try {
      // Exchange code for access token
      const accessToken = await this.exchangeCodeForToken(code, state);

      // Get user info from GitLab
      const gitlabUser = await this.getGitLabUserInfo(accessToken);

      // Find or create user
      let user = await this.userDataService.findUserByGitlabId(gitlabUser.id);

      if (!user) {
        // Check if user exists by email
        user = await this.userDataService.findUserByEmail(gitlabUser.email);

        if (user) {
          // Update existing user with GitLab ID
          user = await this.userDataService.updateUser(user.id, {
            gitlab_id: gitlabUser.id,
          });
        } else {
          // Create new user
          const userData: CreateUserData = {
            username: gitlabUser.username,
            email: gitlabUser.email,
            password_hash: await this.hashPassword(
              crypto.randomBytes(32).toString("hex")
            ),
            gitlab_id: gitlabUser.id,
          };

          try {
            user = await this.userDataService.createUser(userData);
          } catch (error: any) {
            // Handle username conflicts
            if (error.message.includes("already exists")) {
              userData.username = `${gitlabUser.username}_${gitlabUser.id}`;
              user = await this.userDataService.createUser(userData);
            } else {
              throw error;
            }
          }
        }
      }

      // Generate JWT tokens
      const tokens = this.generateTokenPair(user!);

      // Create refresh token session
      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
      await this.userDataService.createUserSession(
        user!.id,
        tokens.refreshToken,
        refreshExpiresAt
      );

      return { user: user!, tokens };
    } catch (error: any) {
      console.error("OAuth callback processing error:", error);
      throw new Error(`OAuth authentication failed: ${error.message}`);
    }
  }

  // Traditional username/password methods (keeping for backward compatibility)
  async registerUser(
    username: string,
    email: string,
    password: string
  ): Promise<{ user: User; tokens: TokenPair }> {
    const existingUserByUsername =
      await this.userDataService.findUserByUsername(username);
    if (existingUserByUsername) {
      throw new Error("Username already exists");
    }

    const existingUserByEmail = await this.userDataService.findUserByEmail(
      email
    );
    if (existingUserByEmail) {
      throw new Error("Email already exists");
    }

    const passwordHash = await this.hashPassword(password);
    const userData: CreateUserData = {
      username,
      email,
      password_hash: passwordHash,
    };

    const user = await this.userDataService.createUser(userData);
    const tokens = this.generateTokenPair(user);

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
    await this.userDataService.createUserSession(
      user.id,
      tokens.refreshToken,
      refreshExpiresAt
    );

    return { user, tokens };
  }

  async loginUser(
    username: string,
    password: string
  ): Promise<{ user: User; tokens: TokenPair }> {
    const user = await this.userDataService.findUserByUsername(username);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isPasswordValid = await this.verifyPassword(
      password,
      user.password_hash
    );
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    const tokens = this.generateTokenPair(user);

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
    await this.userDataService.createUserSession(
      user.id,
      tokens.refreshToken,
      refreshExpiresAt
    );

    return { user, tokens };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = jwt.verify(refreshToken, this.jwtSecret) as any;
      if (payload.type !== "refresh") {
        throw new Error("Invalid refresh token");
      }

      const session = await this.userDataService.findSessionByRefreshToken(
        refreshToken
      );
      if (!session) {
        throw new Error("Session not found or expired");
      }

      const user = await this.userDataService.findUserById(session.user_id);
      if (!user) {
        throw new Error("User not found");
      }

      await this.userDataService.deleteUserSession(refreshToken);
      const newTokens = this.generateTokenPair(user);

      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
      await this.userDataService.createUserSession(
        user.id,
        newTokens.refreshToken,
        refreshExpiresAt
      );

      return newTokens;
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  }

  async logoutUser(refreshToken: string): Promise<void> {
    return this.userDataService.deleteUserSession(refreshToken);
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    const expiredStates: string[] = [];

    for (const [state, data] of this.oauthStates.entries()) {
      if (now - data.timestamp > 10 * 60 * 1000) {
        // 10 minutes
        expiredStates.push(state);
      }
    }

    expiredStates.forEach((state) => this.oauthStates.delete(state));

    if (expiredStates.length > 0) {
      console.log(`Cleaned up ${expiredStates.length} expired OAuth states`);
    }
  }
}
*/
