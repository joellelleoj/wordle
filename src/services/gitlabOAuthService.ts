import fetch from "node-fetch";
import { AuthService } from "./authService";

interface GitLabTokenResponse {
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

export class GitLabOAuthService {
  private authService: AuthService;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private gitlabBaseUrl: string;

  constructor() {
    this.authService = new AuthService();

    // Environment variables - MUST be set correctly
    this.clientId = process.env.GITLAB_CLIENT_ID || "";
    this.clientSecret = process.env.GITLAB_CLIENT_SECRET || "";
    this.redirectUri =
      process.env.GITLAB_REDIRECT_URI ||
      "http://localhost:3003/api/auth/gitlab/callback";
    this.gitlabBaseUrl =
      process.env.GITLAB_BASE_URL || "https://git.imn.htwk-leipzig.de";

    if (!this.clientId) {
      console.error("❌ GITLAB_CLIENT_ID not set in environment variables");
    }
    if (!this.clientSecret) {
      console.error("❌ GITLAB_CLIENT_SECRET not set in environment variables");
    }
  }

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "read_user",
      state: this.generateState(), // CSRF protection
    });

    return `${this.gitlabBaseUrl}/oauth/authorize?${params.toString()}`;
  }

  async handleCallback(
    code: string
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      // Step 1: Exchange code for access token
      const tokenResponse = await this.exchangeCodeForToken(code);

      // Step 2: Get user info from GitLab
      const gitlabUser = await this.getGitLabUserInfo(
        tokenResponse.access_token
      );

      // Step 3: Create or login user in our system
      const result = await this.authService.loginOrCreateUserFromGitLab(
        gitlabUser
      );

      return {
        success: true,
        data: {
          user: result.user,
          tokens: result.tokens,
        },
      };
    } catch (error) {
      console.error("GitLab OAuth callback error:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "OAuth callback failed",
      };
    }
  }

  private async exchangeCodeForToken(
    code: string
  ): Promise<GitLabTokenResponse> {
    const tokenUrl = `${this.gitlabBaseUrl}/oauth/token`;

    const response = await fetch(tokenUrl, {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token exchange failed:", response.status, errorText);
      throw new Error(`Failed to exchange code for token: ${response.status}`);
    }

    const data = (await response.json()) as GitLabTokenResponse;

    if (!data.access_token) {
      throw new Error("No access token received from GitLab");
    }

    return data;
  }

  private async getGitLabUserInfo(accessToken: string): Promise<GitLabUser> {
    const userUrl = `${this.gitlabBaseUrl}/api/v4/user`;

    const response = await fetch(userUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get user info from GitLab: ${response.status}`
      );
    }

    const userData = (await response.json()) as GitLabUser;

    if (!userData.id) {
      throw new Error("Invalid user data received from GitLab");
    }

    return userData;
  }

  private generateState(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
