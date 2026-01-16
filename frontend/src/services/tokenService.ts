// services/tokenService.ts - Handles all token storage and retrieval
import { User } from "../types";
import { logger } from "../utils/logger";

/**
 * Token Management Service
 * Handles secure storage and retrieval of authentication tokens
 * Separates token management from auth business logic
 */
class TokenService {
  private readonly ACCESS_TOKEN_KEY = "wordle_access_token";
  private readonly REFRESH_TOKEN_KEY = "wordle_refresh_token";
  private readonly USER_KEY = "wordle_user";
  private readonly SESSION_TIMESTAMP_KEY = "wordle_session_timestamp";

  /**
   * Store authentication tokens and user data
   */
  storeAuthData(accessToken: string, refreshToken: string, user: User): void {
    try {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      localStorage.setItem(this.SESSION_TIMESTAMP_KEY, Date.now().toString());

      logger.info("Auth data stored successfully", { username: user.username });
    } catch (error) {
      logger.error("Failed to store auth data", { error });
      throw new Error("Failed to store authentication data");
    }
  }

  /**
   * Get stored access token
   */
  getAccessToken(): string | null {
    try {
      return localStorage.getItem(this.ACCESS_TOKEN_KEY);
    } catch (error) {
      logger.error("Failed to get access token", { error });
      return null;
    }
  }

  /**
   * Get stored refresh token
   */
  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    } catch (error) {
      logger.error("Failed to get refresh token", { error });
      return null;
    }
  }

  /**
   * Get stored user data
   */
  getUser(): User | null {
    try {
      const userStr = localStorage.getItem(this.USER_KEY);
      if (!userStr) return null;

      const user = JSON.parse(userStr);

      // Validate user data structure
      if (!user || !user.id || !user.username) {
        logger.warn("Invalid user data in storage");
        this.clearAuthData();
        return null;
      }

      return user;
    } catch (error) {
      logger.error("Failed to parse stored user", { error });
      this.clearAuthData();
      return null;
    }
  }

  /**
   * Check if user is authenticated (has valid tokens and user data)
   */
  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    const user = this.getUser();

    if (!token || !user) {
      return false;
    }

    // Check session age (optional - for security)
    const timestamp = localStorage.getItem(this.SESSION_TIMESTAMP_KEY);
    if (timestamp) {
      const sessionAge = Date.now() - parseInt(timestamp);
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (sessionAge > maxAge) {
        logger.info("Session expired due to age");
        this.clearAuthData();
        return false;
      }
    }

    return true;
  }

  /**
   * Update stored tokens (for refresh flow)
   */
  updateTokens(accessToken: string, refreshToken: string): void {
    try {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(this.SESSION_TIMESTAMP_KEY, Date.now().toString());

      logger.info("Tokens updated successfully");
    } catch (error) {
      logger.error("Failed to update tokens", { error });
      throw new Error("Failed to update tokens");
    }
  }

  /**
   * Clear all stored authentication data
   */
  clearAuthData(): void {
    try {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
      localStorage.removeItem(this.SESSION_TIMESTAMP_KEY);

      logger.info("Auth data cleared");
    } catch (error) {
      logger.error("Failed to clear auth data", { error });
    }
  }

  /**
   * Get authorization headers for API requests
   */
  getAuthHeaders(): Record<string, string> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }
}

export const tokenService = new TokenService();
