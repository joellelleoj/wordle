import { User, LoginCredentials, RegisterData, AuthResponse } from "../types";
import { logger } from "../utils/logger";

class AuthService {
  private readonly ACCESS_TOKEN_KEY = "wordle_access_token";
  private readonly REFRESH_TOKEN_KEY = "wordle_refresh_token";
  private readonly USER_KEY = "wordle_user";
  private readonly baseURL: string;
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    this.baseURL = this.getApiBaseUrl();
    this.setupTokenRefresh();
    this.initializeFromStorage();
  }

  private getApiBaseUrl(): string {
    if (
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost"
    ) {
      return "/dev11/api";
    }
    return "http://localhost:8002/api";
  }

  private initializeFromStorage(): void {
    try {
      const token = this.getAccessToken();
      const user = this.getCurrentUser();

      if (token && user) {
        logger.info("Auth state restored from storage", {
          username: user.username,
        });
      }
    } catch (error) {
      logger.error("Failed to initialize auth from storage", { error });
      this.clearStorage();
    }
  }

  // FIXED: More precise OAuth callback detection
  isOAuthCallback(): boolean {
    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;

    // Only consider it an OAuth callback if we have specific OAuth markers
    const isExactOAuthPath = currentPath === "/oauth/success";
    const hasValidOAuthData =
      currentSearch.includes("data=") &&
      this.isValidOAuthDataFormat(currentSearch);
    const hasOAuthError =
      currentSearch.includes("error=") &&
      (currentSearch.includes("oauth") ||
        currentSearch.includes("access_denied"));

    const result = isExactOAuthPath || hasValidOAuthData || hasOAuthError;

    if (result) {
      logger.info("Valid OAuth callback detected", {
        path: currentPath,
        hasData: hasValidOAuthData,
        hasError: hasOAuthError,
      });
    }

    return result;
  }

  // Helper to validate OAuth data format
  private isValidOAuthDataFormat(search: string): boolean {
    try {
      const urlParams = new URLSearchParams(search);
      const oauthData = urlParams.get("data");

      if (!oauthData) return false;

      // Try to parse the OAuth data to verify it's valid
      const decodedData = decodeURIComponent(oauthData);
      const parsedData = JSON.parse(decodedData);

      // Check if it has the expected OAuth structure
      return !!(
        parsedData &&
        (parsedData.success !== undefined || parsedData.data)
      );
    } catch {
      return false;
    }
  }

  // FIXED: Improved OAuth success processing with better state management
  async processOAuthSuccess(): Promise<AuthResponse | null> {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const oauthData = urlParams.get("data");
      const oauthError = urlParams.get("error");

      if (oauthError) {
        logger.error("OAuth error received", { error: oauthError });
        this.cleanupOAuthURL();
        return {
          success: false,
          message: `OAuth login failed: ${oauthError}`,
        };
      }

      if (oauthData) {
        logger.info("Processing OAuth success data");

        try {
          const authData = JSON.parse(decodeURIComponent(oauthData));

          if (authData.success && authData.data) {
            const userData = {
              ...authData.data.user,
              id: authData.data.user.id.toString(),
            };

            // FIXED: Store auth data immediately and trigger storage events
            this.storeAuthDataWithEvents(
              authData.data.accessToken,
              authData.data.refreshToken,
              userData
            );

            logger.info("OAuth authentication successful", {
              username: userData.username,
              gitlab_id: userData.gitlab_id,
            });

            // Clean up URL after successful processing
            this.cleanupOAuthURL();

            return {
              success: true,
              data: {
                user: userData,
                accessToken: authData.data.accessToken,
                refreshToken: authData.data.refreshToken,
              },
              message: "OAuth login successful",
            };
          } else {
            logger.error("Invalid OAuth response structure", { authData });
            this.cleanupOAuthURL();
            return {
              success: false,
              message: "Invalid OAuth response. Please try again.",
            };
          }
        } catch (parseError) {
          logger.error("Failed to parse OAuth data", { error: parseError });
          this.cleanupOAuthURL();
          return {
            success: false,
            message: "Failed to process OAuth response. Please try again.",
          };
        }
      }

      return null;
    } catch (error) {
      logger.error("OAuth processing error", { error });
      this.cleanupOAuthURL();
      return {
        success: false,
        message: "OAuth processing failed. Please try again.",
      };
    }
  }

  // FIXED: Store auth data and trigger storage events for proper state sync
  private storeAuthDataWithEvents(
    accessToken: string,
    refreshToken: string,
    user: User
  ): void {
    try {
      const userWithStringId = {
        ...user,
        id: user.id.toString(),
      };

      // Store the data
      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(this.USER_KEY, JSON.stringify(userWithStringId));

      // FIXED: Trigger storage events manually for same-window updates
      // (storage events don't fire in the same window that made the change)
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: this.ACCESS_TOKEN_KEY,
          newValue: accessToken,
          url: window.location.href,
        })
      );

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: this.USER_KEY,
          newValue: JSON.stringify(userWithStringId),
          url: window.location.href,
        })
      );

      logger.debug("Auth data stored with events triggered", {
        username: userWithStringId.username,
        id: userWithStringId.id,
      });
    } catch (error) {
      logger.error("Failed to store auth data", { error });
      throw new Error("Failed to store authentication data");
    }
  }

  private cleanupOAuthURL(): void {
    try {
      // Use replaceState to clean up the URL without affecting browser history
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      logger.debug("OAuth URL cleaned up");
    } catch (error) {
      logger.error("Failed to clean up OAuth URL", { error });
    }
  }

  // GitLab OAuth initiation
  async initiateGitLabAuth(): Promise<string> {
    try {
      logger.info("Initiating GitLab OAuth");
      const response = await this.makeRequest<{ authUrl: string }>(
        "/users/auth/gitlab/login"
      );

      if (response && response.authUrl) {
        logger.info("GitLab auth URL received");
        return response.authUrl;
      }
      throw new Error("Failed to get GitLab authorization URL");
    } catch (error) {
      logger.error("GitLab auth initiation failed", { error });
      throw new Error("Failed to initiate GitLab login");
    }
  }

  // Traditional login
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      logger.info("Login attempt", { username: credentials.username });
      const response = await this.makeRequest<AuthResponse>(
        "/users/auth/login",
        {
          method: "POST",
          body: JSON.stringify(credentials),
        }
      );

      if (response.success && response.data) {
        const userData = {
          ...response.data.user,
          id: response.data.user.id.toString(),
        };

        this.storeAuthData(
          response.data.accessToken,
          response.data.refreshToken,
          userData
        );
        logger.info("Login successful", { username: userData.username });
      }

      return response;
    } catch (error) {
      logger.error("Login failed", { username: credentials.username, error });
      return {
        success: false,
        message: error instanceof Error ? error.message : "Login failed",
      };
    }
  }

  // Registration
  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      logger.info("Registration attempt", { username: userData.username });
      const response = await this.makeRequest<AuthResponse>(
        "/users/auth/register",
        {
          method: "POST",
          body: JSON.stringify(userData),
        }
      );

      if (response.success && response.data) {
        const userDataWithStringId = {
          ...response.data.user,
          id: response.data.user.id.toString(),
        };

        this.storeAuthData(
          response.data.accessToken,
          response.data.refreshToken,
          userDataWithStringId
        );
        logger.info("Registration successful", {
          username: userDataWithStringId.username,
        });
      }

      return response;
    } catch (error) {
      logger.error("Registration failed", {
        username: userData.username,
        error,
      });
      return {
        success: false,
        message: error instanceof Error ? error.message : "Registration failed",
      };
    }
  }

  // Helper methods
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const token = this.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    logger.debug("API request", { method: config.method || "GET", url });

    let response = await fetch(url, config);

    // Handle token expiration with automatic refresh
    if (
      response.status === 401 &&
      this.getRefreshToken() &&
      !endpoint.includes("refresh")
    ) {
      logger.info("Access token expired, attempting refresh");
      const refreshed = await this.refreshAccessToken();

      if (refreshed) {
        config.headers = {
          ...this.getHeaders(),
          ...options.headers,
        };
        response = await fetch(url, config);
      } else {
        this.clearStorage();
        throw new Error("Session expired. Please log in again.");
      }
    }

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `HTTP ${response.status}` };
      }

      const errorMessage =
        errorData?.message || `Request failed: ${response.status}`;
      logger.error("API request failed", {
        url,
        status: response.status,
        message: errorMessage,
      });
      throw new Error(errorMessage);
    }

    return await response.json();
  }

  // Token management
  private async refreshAccessToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();
    const result = await this.refreshPromise;
    this.refreshPromise = null;
    return result;
  }

  private async performTokenRefresh(): Promise<boolean> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${this.baseURL}/users/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      if (result.success && result.data?.accessToken) {
        localStorage.setItem(this.ACCESS_TOKEN_KEY, result.data.accessToken);
        if (result.data.refreshToken) {
          localStorage.setItem(
            this.REFRESH_TOKEN_KEY,
            result.data.refreshToken
          );
        }
        logger.info("Access token refreshed successfully");
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Token refresh failed", { error });
      return false;
    }
  }

  private setupTokenRefresh(): void {
    setInterval(() => {
      const token = this.getAccessToken();
      if (token && this.isTokenExpiringSoon(token)) {
        this.refreshAccessToken();
      }
    }, 5 * 60 * 1000);
  }

  private isTokenExpiringSoon(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expirationTime = payload.exp * 1000;
      const currentTime = Date.now();
      const timeUntilExpiry = expirationTime - currentTime;
      return timeUntilExpiry < 10 * 60 * 1000;
    } catch {
      return false;
    }
  }

  // Authentication state
  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  }

  getCurrentUser(): User | null {
    try {
      const userStr = localStorage.getItem(this.USER_KEY);
      if (!userStr) return null;

      const user = JSON.parse(userStr);
      if (!user || !user.id || !user.username) {
        logger.warn("Invalid user data in storage");
        this.clearStorage();
        return null;
      }

      return {
        ...user,
        id: user.id.toString(),
      };
    } catch (error) {
      logger.error("Failed to parse stored user", { error });
      this.clearStorage();
      return null;
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  private storeAuthData(
    accessToken: string,
    refreshToken: string,
    user: User
  ): void {
    try {
      const userWithStringId = {
        ...user,
        id: user.id.toString(),
      };

      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(this.USER_KEY, JSON.stringify(userWithStringId));

      logger.debug("Auth data stored successfully", {
        username: userWithStringId.username,
        id: userWithStringId.id,
      });
    } catch (error) {
      logger.error("Failed to store auth data", { error });
      throw new Error("Failed to store authentication data");
    }
  }

  private clearStorage(): void {
    try {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
      logger.debug("Auth storage cleared");
    } catch (error) {
      logger.error("Failed to clear auth storage", { error });
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.isAuthenticated()) {
        const refreshToken = this.getRefreshToken();
        if (refreshToken) {
          await this.makeRequest("/users/auth/logout", {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
          });
        }
        logger.info("Logout request completed");
      }
    } catch (error) {
      logger.error("Logout request failed", { error });
    } finally {
      this.clearStorage();
      logger.info("User logged out and storage cleared");
    }
  }
}

export const authService = new AuthService();
