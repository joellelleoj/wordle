// services/auth.ts - FIXED: Improved OAuth callback handling
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

/*// services/auth.ts - FIXED: Proper OAuth detection and initialization
import { User, LoginCredentials, RegisterData, AuthResponse } from "../types";
import { logger } from "../utils/logger";

class AuthService {
  private readonly ACCESS_TOKEN_KEY = "wordle_access_token";
  private readonly REFRESH_TOKEN_KEY = "wordle_refresh_token";
  private readonly USER_KEY = "wordle_user";

  private readonly baseURL: string;
  private authCache: {
    user: User | null;
    isAuthenticated: boolean;
    lastCheck: number;
    token: string | null;
  } = {
    user: null,
    isAuthenticated: false,
    lastCheck: 0,
    token: null,
  };

  private readonly CACHE_DURATION = 30000;

  constructor() {
    this.baseURL = this.getApiBaseUrl();
    // Initialize auth state ONCE
    this.initializeAuthState();
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

  private initializeAuthState(): void {
    try {
      const token = localStorage.getItem(this.ACCESS_TOKEN_KEY);
      const userStr = localStorage.getItem(this.USER_KEY);

      if (token && userStr) {
        const user = JSON.parse(userStr);
        if (user && user.id && user.username) {
          this.authCache = {
            user,
            isAuthenticated: true,
            lastCheck: Date.now(),
            token,
          };
          logger.debug("Auth state initialized from storage", {
            username: user.username,
          });
        }
      }
    } catch (error) {
      logger.error("Failed to initialize auth state", { error });
      this.clearStorage();
    }
  }

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

    const response = await fetch(url, config);

    if (!response.ok) {
      if (response.status === 401) {
        logger.warn("Authentication failed or token expired");
        this.clearStorage();
        throw new Error("Authentication required. Please log in again.");
      }

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

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      return (await response.text()) as T;
    }
  }

  // FIXED: More precise OAuth callback detection
  isOAuthCallback(): boolean {
    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;

    // Only true if we're explicitly on OAuth success page
    const isOAuthPath = currentPath === "/oauth/success";

    // OR if we have OAuth-specific parameters (but not just any parameters)
    const hasOAuthData =
      currentSearch.includes("data=") && currentSearch.includes("success");
    const hasOAuthError =
      currentSearch.includes("error=") &&
      (currentSearch.includes("oauth") || currentSearch.includes("auth"));

    const result = isOAuthPath || hasOAuthData || hasOAuthError;

    if (result) {
      logger.info("OAuth callback detected", {
        path: currentPath,
        search: currentSearch.substring(0, 50),
        isOAuthPath,
        hasOAuthData,
        hasOAuthError,
      });
    }

    return result;
  }

  // Process OAuth success callback
  async processOAuthSuccess(): Promise<AuthResponse | null> {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const oauthData = urlParams.get("data");
      const oauthError = urlParams.get("error");
      const oauthCode = urlParams.get("code");

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
            this.storeAuthData(
              authData.data.accessToken,
              authData.data.refreshToken,
              authData.data.user
            );

            logger.info("OAuth authentication successful", {
              username: authData.data.user.username,
            });

            this.cleanupOAuthURL();

            return {
              success: true,
              data: authData.data,
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

      if (oauthCode) {
        // Handle OAuth code flow here if needed
        logger.info("OAuth code received", {
          code: oauthCode.substring(0, 10) + "...",
        });
        this.cleanupOAuthURL();
        return {
          success: false,
          message: "OAuth code flow not implemented yet",
        };
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

  private cleanupOAuthURL(): void {
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
      logger.debug("OAuth URL cleaned up");
    } catch (error) {
      logger.error("Failed to clean up OAuth URL", { error });
    }
  }

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
        this.storeAuthData(
          response.data.accessToken,
          response.data.refreshToken,
          response.data.user
        );
        logger.info("Registration successful", {
          username: response.data.user.username,
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
        this.storeAuthData(
          response.data.accessToken,
          response.data.refreshToken,
          response.data.user
        );
        logger.info("Login successful", {
          username: response.data.user.username,
        });
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

  async logout(): Promise<void> {
    try {
      if (this.isAuthenticated()) {
        await this.makeRequest("/users/auth/logout", { method: "POST" });
        logger.info("Logout request completed");
      }
    } catch (error) {
      logger.error("Logout request failed", { error });
    } finally {
      this.clearStorage();
      logger.info("User logged out and storage cleared");
    }
  }

  // Simplified authentication check
  isAuthenticated(): boolean {
    const now = Date.now();

    // Use cache if recent
    if (now - this.authCache.lastCheck < this.CACHE_DURATION) {
      return this.authCache.isAuthenticated;
    }

    const token = this.getAccessToken();
    const user = this.getCurrentUser();
    const isAuth = !!(token && user);

    // Update cache
    this.authCache = {
      user,
      isAuthenticated: isAuth,
      lastCheck: now,
      token,
    };

    return isAuth;
  }

  getCurrentUser(): User | null {
    // Use cache if recent
    const now = Date.now();
    if (
      now - this.authCache.lastCheck < this.CACHE_DURATION &&
      this.authCache.user
    ) {
      return this.authCache.user;
    }

    try {
      const userStr = localStorage.getItem(this.USER_KEY);
      if (!userStr) return null;

      const user = JSON.parse(userStr);

      if (!user || !user.id || !user.username) {
        logger.warn("Invalid user data in storage");
        this.clearStorage();
        return null;
      }

      // Update cache
      this.authCache.user = user;
      this.authCache.lastCheck = now;

      return user;
    } catch (error) {
      logger.error("Failed to parse stored user", { error });
      this.clearStorage();
      return null;
    }
  }

  getAccessToken(): string | null {
    const now = Date.now();
    if (
      now - this.authCache.lastCheck < this.CACHE_DURATION &&
      this.authCache.token
    ) {
      return this.authCache.token;
    }

    const token = localStorage.getItem(this.ACCESS_TOKEN_KEY);
    this.authCache.token = token;
    return token;
  }

  private storeAuthData(
    accessToken: string,
    refreshToken: string,
    user: User
  ): void {
    try {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));

      // Update cache immediately
      this.authCache = {
        user,
        isAuthenticated: true,
        lastCheck: Date.now(),
        token: accessToken,
      };

      logger.debug("Auth data stored successfully", {
        username: user.username,
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

      // Clear cache
      this.authCache = {
        user: null,
        isAuthenticated: false,
        lastCheck: Date.now(),
        token: null,
      };

      logger.debug("Auth storage cleared");
    } catch (error) {
      logger.error("Failed to clear auth storage", { error });
    }
  }
}

export const authService = new AuthService();
/*import { User, LoginCredentials, RegisterData, AuthResponse } from "../types";
import { logger } from "../utils/logger";

class AuthService {
  private readonly ACCESS_TOKEN_KEY = "wordle_access_token";
  private readonly REFRESH_TOKEN_KEY = "wordle_refresh_token";
  private readonly USER_KEY = "wordle_user";

  private readonly baseURL: string;

  constructor() {
    this.baseURL = this.getApiBaseUrl();
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

    const response = await fetch(url, config);

    if (!response.ok) {
      if (response.status === 401) {
        logger.warn("Authentication failed or token expired");
        this.clearStorage();
        throw new Error("Authentication required. Please log in again.");
      }

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

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      return (await response.text()) as T;
    }
  }

  // =============================================================================
  // FIXED OAuth Callback Handling
  // =============================================================================

  
   * FIXED: Process OAuth success data from URL parameters
   * This handles the OAuth redirect from the backend
   
  async processOAuthSuccess(): Promise<AuthResponse | null> {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const oauthData = urlParams.get("data");
      const oauthError = urlParams.get("error");

      // Handle OAuth error
      if (oauthError) {
        logger.error("OAuth error received", { error: oauthError });
        this.clearStorage();

        // Clean up URL immediately
        this.cleanupOAuthURL();

        return {
          success: false,
          message: `OAuth login failed: ${oauthError}`,
        };
      }

      // Handle OAuth success
      if (oauthData && window.location.pathname === "/oauth/success") {
        logger.info("Processing OAuth success data");

        try {
          const authData = JSON.parse(decodeURIComponent(oauthData));

          if (authData.success && authData.data) {
            // Store authentication data
            this.storeAuthData(
              authData.data.accessToken,
              authData.data.refreshToken,
              authData.data.user
            );

            logger.info("OAuth authentication successful", {
              username: authData.data.user.username,
            });

            // Clean up URL
            this.cleanupOAuthURL();

            return {
              success: true,
              data: authData.data,
              message: "OAuth login successful",
            };
          } else {
            logger.error("Invalid OAuth response structure", { authData });
            this.clearStorage();
            this.cleanupOAuthURL();

            return {
              success: false,
              message: "Invalid OAuth response. Please try again.",
            };
          }
        } catch (parseError) {
          logger.error("Failed to parse OAuth data", { error: parseError });
          this.clearStorage();
          this.cleanupOAuthURL();

          return {
            success: false,
            message: "Failed to process OAuth response. Please try again.",
          };
        }
      }

      return null; // No OAuth data to process
    } catch (error) {
      logger.error("OAuth processing error", { error });
      this.clearStorage();
      this.cleanupOAuthURL();

      return {
        success: false,
        message: "OAuth processing failed. Please try again.",
      };
    }
  }


  private cleanupOAuthURL(): void {
    try {
      // Replace current URL without OAuth parameters
      const cleanURL = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanURL);
      logger.debug("OAuth URL cleaned up");
    } catch (error) {
      logger.error("Failed to clean up OAuth URL", { error });
    }
  }

 
  isOAuthCallback(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthData = urlParams.has("data") || urlParams.has("error");
    const isOAuthPath = window.location.pathname === "/oauth/success";

    return hasOAuthData && isOAuthPath;
  }

  // =============================================================================
  // Standard Authentication Methods
  // =============================================================================

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
        this.storeAuthData(
          response.data.accessToken,
          response.data.refreshToken,
          response.data.user
        );
        logger.info("Registration successful", {
          username: response.data.user.username,
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
        this.storeAuthData(
          response.data.accessToken,
          response.data.refreshToken,
          response.data.user
        );
        logger.info("Login successful", {
          username: response.data.user.username,
        });
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

  async logout(): Promise<void> {
    try {
      if (this.isAuthenticated()) {
        await this.makeRequest("/users/auth/logout", { method: "POST" });
        logger.info("Logout request completed");
      }
    } catch (error) {
      logger.error("Logout request failed", { error });
    } finally {
      this.clearStorage();
      logger.info("User logged out and storage cleared");
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        this.clearStorage();
        return false;
      }

      const response = await this.makeRequest<{
        success: boolean;
        data?: {
          accessToken: string;
          refreshToken: string;
        };
      }>("/users/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });

      if (
        response.success &&
        response.data?.accessToken &&
        response.data?.refreshToken
      ) {
        this.updateTokens(
          response.data.accessToken,
          response.data.refreshToken
        );
        logger.info("Token refresh successful");
        return true;
      }

      this.clearStorage();
      return false;
    } catch (error) {
      logger.error("Token refresh failed", { error });
      this.clearStorage();
      return false;
    }
  }

  // =============================================================================
  // State Management
  // =============================================================================

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

      return user;
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
      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));

      logger.debug("Auth data stored successfully", {
        username: user.username,
      });
    } catch (error) {
      logger.error("Failed to store auth data", { error });
      throw new Error("Failed to store authentication data");
    }
  }

  private updateTokens(accessToken: string, refreshToken: string): void {
    try {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);

      logger.debug("Tokens updated successfully");
    } catch (error) {
      logger.error("Failed to update tokens", { error });
      throw new Error("Failed to update tokens");
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
}

export const authService = new AuthService();

// Export types for use in other files
/*export type {
  User,
  LoginCredentials,
  RegisterData,
  AuthResponse,
} from "../types/index";

/*import {
  User,
  LoginCredentials,
  RegisterData,
  AuthResponse,
  GameRecord,
  UserStats,
  GameAlbum,
} from "../types/auth";

const getApiUrl = (): string => {
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost"
  ) {
    return ""; // Use relative paths in production
  }
  return "http://localhost:8002"; // Development - API Gateway port
};

const API_URL = getApiUrl();

class AuthService {
  private readonly ACCESS_TOKEN_KEY = "wordle_access_token";
  private readonly REFRESH_TOKEN_KEY = "wordle_refresh_token";
  private readonly USER_KEY = "wordle_user";
  private readonly SESSION_VALID_KEY = "wordle_session_valid";
  private readonly SESSION_TIMESTAMP_KEY = "wordle_session_timestamp";

  // Session validation cache with better persistence
  private authCache: {
    isAuthenticated: boolean;
    user: User | null;
    lastCheck: number;
    isValid: boolean;
  } = {
    isAuthenticated: false,
    user: null,
    lastCheck: 0,
    isValid: false,
  };

  private readonly CACHE_DURATION = 30000; // 30 seconds cache
  private readonly SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Initialize auth state on creation
    this.initializeAuthState();
  }

  // Initialize authentication state from localStorage
  private initializeAuthState(): void {
    try {
      const token = localStorage.getItem(this.ACCESS_TOKEN_KEY);
      const user = localStorage.getItem(this.USER_KEY);
      const sessionValid = localStorage.getItem(this.SESSION_VALID_KEY);
      const sessionTimestamp = localStorage.getItem(this.SESSION_TIMESTAMP_KEY);

      if (token && user && sessionValid === "true") {
        // Check if session hasn't expired
        const timestamp = sessionTimestamp ? parseInt(sessionTimestamp) : 0;
        const now = Date.now();

        if (now - timestamp < this.SESSION_EXPIRY) {
          const userData = JSON.parse(user);
          this.authCache = {
            isAuthenticated: true,
            user: userData,
            lastCheck: now,
            isValid: true,
          };
          console.log(
            "🔄 Auth state initialized from storage:",
            userData.username
          );
        } else {
          console.log("🔄 Session expired, clearing storage");
          this.clearStorage();
        }
      }
    } catch (error) {
      console.error("Failed to initialize auth state:", error);
      this.clearStorage();
    }
  }

  // Store tokens and user data with enhanced validation and timestamps
  storeTokens(accessToken: string, refreshToken: string): void {
    try {
      if (!accessToken || !refreshToken) {
        throw new Error("Invalid tokens provided");
      }

      const timestamp = Date.now().toString();

      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(this.SESSION_VALID_KEY, "true");
      localStorage.setItem(this.SESSION_TIMESTAMP_KEY, timestamp);

      this.invalidateCache();
      console.log("🔑 Tokens stored successfully with timestamp");
    } catch (error) {
      console.error("Failed to store tokens:", error);
      this.clearStorage();
    }
  }

  storeUser(user: User): void {
    try {
      if (!user || !user.id || !user.username) {
        throw new Error("Invalid user data provided");
      }

      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      this.authCache.user = user;
      this.authCache.isAuthenticated = true;
      this.authCache.isValid = true;
      this.authCache.lastCheck = Date.now();

      console.log("👤 User stored successfully:", user.username);
    } catch (error) {
      console.error("Failed to store user:", error);
      this.clearStorage();
    }
  }

  // Invalidate authentication cache
  private invalidateCache(): void {
    this.authCache.lastCheck = 0;
    this.authCache.isValid = false;
  }

  // Get stored data with validation and expiry checks
  getAccessToken(): string | null {
    try {
      if (!this.isSessionValid()) {
        return null;
      }
      return localStorage.getItem(this.ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error("Failed to get access token:", error);
      return null;
    }
  }

  getRefreshToken(): string | null {
    try {
      if (!this.isSessionValid()) {
        return null;
      }
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error("Failed to get refresh token:", error);
      return null;
    }
  }

  getCurrentUser(): User | null {
    const now = Date.now();

    // Use cache if recent and valid
    if (
      now - this.authCache.lastCheck < this.CACHE_DURATION &&
      this.authCache.isValid
    ) {
      return this.authCache.user;
    }

    try {
      if (!this.isSessionValid()) {
        this.authCache.user = null;
        this.authCache.isAuthenticated = false;
        this.authCache.isValid = true;
        this.authCache.lastCheck = now;
        return null;
      }

      const userStr = localStorage.getItem(this.USER_KEY);
      if (!userStr) {
        this.authCache.user = null;
        this.authCache.isAuthenticated = false;
        this.authCache.isValid = true;
        this.authCache.lastCheck = now;
        return null;
      }

      const user = JSON.parse(userStr);

      // Validate user data structure
      if (!user || !user.id || !user.username) {
        console.error("Invalid user data in storage");
        this.clearStorage();
        return null;
      }

      this.authCache.user = user;
      this.authCache.lastCheck = now;
      this.authCache.isValid = true;
      return user;
    } catch (error) {
      console.error("Failed to parse stored user:", error);
      this.clearStorage();
      return null;
    }
  }

  // Check if session is valid (not expired)
  private isSessionValid(): boolean {
    try {
      const sessionValid = localStorage.getItem(this.SESSION_VALID_KEY);
      const sessionTimestamp = localStorage.getItem(this.SESSION_TIMESTAMP_KEY);

      if (sessionValid !== "true" || !sessionTimestamp) {
        return false;
      }

      const timestamp = parseInt(sessionTimestamp);
      const now = Date.now();

      if (now - timestamp > this.SESSION_EXPIRY) {
        console.log("Session expired, clearing storage");
        this.clearStorage();
        return false;
      }

      return true;
    } catch (error) {
      console.error("Session validation error:", error);
      this.clearStorage();
      return false;
    }
  }

  // Comprehensive authentication check with better persistence
  isAuthenticated(): boolean {
    const now = Date.now();

    // Use cache if recent and explicitly validated
    if (
      now - this.authCache.lastCheck < this.CACHE_DURATION &&
      this.authCache.isValid
    ) {
      return this.authCache.isAuthenticated;
    }

    try {
      const token = this.getAccessToken();
      const user = this.getCurrentUser();
      const sessionValid = this.isSessionValid();

      const isAuth = !!(token && user && sessionValid);

      this.authCache.isAuthenticated = isAuth;
      this.authCache.lastCheck = now;
      this.authCache.isValid = true;

      return isAuth;
    } catch (error) {
      console.error("Authentication check failed:", error);
      this.clearStorage();
      return false;
    }
  }

  // Create authorization headers with validation
  private getAuthHeaders(): HeadersInit {
    const token = this.getAccessToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token && this.isAuthenticated()) {
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      console.warn("No valid authentication token available");
    }

    return headers;
  }

  // Login with comprehensive error handling
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      console.log("🔐 Login request initiated for:", credentials.username);

      // Clear any existing invalid session
      this.clearStorage();

      const response = await fetch(`${API_URL}/api/users/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Validate response data structure
        if (
          !result.data.user ||
          !result.data.accessToken ||
          !result.data.refreshToken
        ) {
          throw new Error("Invalid login response structure");
        }

        this.storeTokens(result.data.accessToken, result.data.refreshToken);
        this.storeUser(result.data.user);

        console.log("✅ Login successful for user:", result.data.user.username);
        return result;
      } else {
        console.log("❌ Login failed:", result.message);
        return result;
      }
    } catch (error) {
      console.error("Login request failed:", error);
      this.clearStorage();
      return {
        success: false,
        message: "Network error during login. Please try again.",
      };
    }
  }

  // Register with comprehensive error handling
  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      console.log("📝 Registration request initiated for:", userData.username);

      // Clear any existing session
      this.clearStorage();

      const response = await fetch(`${API_URL}/api/users/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Validate response data structure
        if (
          !result.data.user ||
          !result.data.accessToken ||
          !result.data.refreshToken
        ) {
          throw new Error("Invalid registration response structure");
        }

        this.storeTokens(result.data.accessToken, result.data.refreshToken);
        this.storeUser(result.data.user);

        console.log(
          "✅ Registration successful for user:",
          result.data.user.username
        );
        return result;
      } else {
        console.log("❌ Registration failed:", result.message);
        return result;
      }
    } catch (error) {
      console.error("Registration request failed:", error);
      this.clearStorage();
      return {
        success: false,
        message: "Network error during registration. Please try again.",
      };
    }
  }

  // GitLab OAuth initiation
  async initiateGitLabAuth(): Promise<string> {
    try {
      console.log("🔄 Initiating GitLab OAuth...");

      const response = await fetch(`${API_URL}/api/users/auth/gitlab/login`);
      const result = await response.json();

      if (result.success && result.authUrl) {
        console.log("✅ GitLab auth URL received");
        return result.authUrl;
      } else {
        throw new Error(result.message || "Failed to get OAuth URL");
      }
    } catch (error) {
      console.error("GitLab auth initiation failed:", error);
      throw error;
    }
  }

  // Record completed game
  async recordGame(gameData: GameRecord): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("Authentication required to record game");
    }

    try {
      console.log("🎮 Recording game:", gameData.gameId);

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/games`,
        {
          method: "POST",
          body: JSON.stringify({
            gameId: gameData.gameId,
            word: gameData.word,
            guesses: gameData.guesses,
            won: gameData.won,
            attempts: gameData.attempts,
            date: gameData.date,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to record game: ${response.status} ${errorText}`
        );
      }

      console.log("✅ Game recorded successfully");
    } catch (error) {
      console.error("Failed to record game:", error);
      throw error;
    }
  }

  // Get user's game history
  async getGameHistory(
    limit: number = 20,
    offset: number = 0
  ): Promise<GameRecord[]> {
    if (!this.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    try {
      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/games?limit=${limit}&offset=${offset}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch game history: ${response.status}`);
      }

      const result = await response.json();
      const games = result.success ? result.data : result;

      return Array.isArray(games)
        ? games.map((game: any) => ({
            gameId: game.gameId || game.game_id || game.id,
            word: game.targetWord || game.target_word || game.word || "UNKNOWN",
            targetWord: game.targetWord,
            guesses: game.guesses || [],
            won: game.won || false,
            attempts: game.attempts || 0,
            date:
              game.completedAt ||
              game.completed_at ||
              game.date ||
              game.createdAt ||
              game.created_at,
          }))
        : [];
    } catch (error) {
      console.error("Failed to get game history:", error);
      return [];
    }
  }

  // Get user statistics
  async getUserStats(): Promise<UserStats> {
    if (!this.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    try {
      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/stats`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch user stats: ${response.status}`);
      }

      const result = await response.json();
      const statsData = result.success ? result.data : result;

      // Ensure guessDistribution has proper number values
      const rawDistribution = statsData.guessDistribution || {};
      const guessDistribution: { [attempts: string]: number } = {};

      for (let i = 1; i <= 6; i++) {
        const key = i.toString();
        const value = rawDistribution[key] || rawDistribution[i] || 0;
        guessDistribution[key] =
          typeof value === "number"
            ? value
            : parseInt(value?.toString() || "0");
      }

      return {
        totalGames: parseInt(statsData.totalGames?.toString() || "0"),
        wins: parseInt(statsData.wins?.toString() || "0"),
        winRate: parseFloat(statsData.winRate?.toString() || "0"),
        currentStreak: parseInt(statsData.currentStreak?.toString() || "0"),
        maxStreak: parseInt(statsData.maxStreak?.toString() || "0"),
        averageAttempts: parseFloat(
          statsData.averageAttempts?.toString() || "0"
        ),
        guessDistribution,
      };
    } catch (error) {
      console.error("Failed to get user stats:", error);
      return {
        totalGames: 0,
        wins: 0,
        winRate: 0,
        currentStreak: 0,
        maxStreak: 0,
        averageAttempts: 0,
        guessDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 },
      };
    }
  }

  // Album management methods
  async createAlbum(albumData: {
    title: string;
    description: string;
  }): Promise<GameAlbum> {
    if (!this.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    const response = await this.makeAuthenticatedRequest(
      `${API_URL}/api/profile/albums`,
      {
        method: "POST",
        body: JSON.stringify(albumData),
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Failed to create album");
    }

    return result.data;
  }

  async getUserAlbums(): Promise<GameAlbum[]> {
    if (!this.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    const response = await this.makeAuthenticatedRequest(
      `${API_URL}/api/profile/albums`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch albums: ${response.status}`);
    }

    const result = await response.json();
    const albums = result.success ? result.data : result;
    return Array.isArray(albums) ? albums : [];
  }

  async getAlbumWithGames(
    albumId: string
  ): Promise<GameAlbum & { games?: GameRecord[] }> {
    if (!this.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    const response = await this.makeAuthenticatedRequest(
      `${API_URL}/api/profile/albums/${albumId}`
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to fetch album");
    }

    return result.success ? result.data : result;
  }

  async updateAlbum(
    albumId: string,
    updates: {
      title?: string;
      description?: string;
      isPublic?: boolean;
    }
  ): Promise<GameAlbum> {
    if (!this.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    const response = await this.makeAuthenticatedRequest(
      `${API_URL}/api/profile/albums/${albumId}`,
      {
        method: "PUT",
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update album");
    }

    const result = await response.json();
    return result.success ? result.data : result;
  }

  async deleteAlbum(albumId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    const response = await this.makeAuthenticatedRequest(
      `${API_URL}/api/profile/albums/${albumId}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete album");
    }
  }

  async addGameToAlbum(albumId: string, gameId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    const response = await this.makeAuthenticatedRequest(
      `${API_URL}/api/profile/albums/${albumId}/games/${gameId}`,
      { method: "POST" }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add game to album");
    }
  }

  async removeGameFromAlbum(albumId: string, gameId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    const response = await this.makeAuthenticatedRequest(
      `${API_URL}/api/profile/albums/${albumId}/games/${gameId}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to remove game from album");
    }
  }

  // Helper method for authenticated requests with proper error handling
  private async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    if (!this.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });

    if (response.status === 401) {
      console.log("🔄 Authentication expired, clearing session");
      this.clearStorage();
      throw new Error("Authentication expired. Please log in again.");
    }

    return response;
  }

  // Refresh access token
  async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearStorage();
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/api/users/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        this.clearStorage();
        return false;
      }

      const result = await response.json();
      if (result.success && result.data) {
        this.storeTokens(result.data.accessToken, result.data.refreshToken);
        return true;
      }

      this.clearStorage();
      return false;
    } catch (error) {
      console.error("Token refresh failed:", error);
      this.clearStorage();
      return false;
    }
  }

  // Comprehensive logout
  async logout(): Promise<void> {
    try {
      if (this.isAuthenticated()) {
        await this.makeAuthenticatedRequest(
          `${API_URL}/api/users/auth/logout`,
          {
            method: "POST",
          }
        );
      }
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      this.clearStorage();
      console.log("🚪 Logout completed - all data cleared");
    }
  }

  // Clear all stored data with better cleanup
  private clearStorage(): void {
    try {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
      localStorage.removeItem(this.SESSION_VALID_KEY);
      localStorage.removeItem(this.SESSION_TIMESTAMP_KEY);

      // Clear cache
      this.authCache = {
        isAuthenticated: false,
        user: null,
        lastCheck: 0,
        isValid: false,
      };

      console.log("🧹 All authentication data cleared");
    } catch (error) {
      console.error("Error clearing storage:", error);
    }
  }
}

export const authService = new AuthService();
// services/auth.ts - Fixed auth service with album update method
const getApiUrl = (): string => {
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost"
  ) {
    return ""; // Use relative paths in production
  }
  return "http://localhost:8002"; // Development - API Gateway port
};

const API_URL = getApiUrl();

export interface User {
  id: string | number;
  username: string;
  email: string;
  gitlab_id?: number;
  created_at: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

export interface GameRecord {
  gameId: string;
  word: string;
  guesses: string[];
  won: boolean;
  date: string;
  attempts: number;
}

export interface UserStats {
  totalGames: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  averageAttempts: number;
  guessDistribution: { [attempts: string]: number };
  lastPlayedAt: Date | null;
}

export interface GameAlbum {
  id: string;
  userId: string;
  title: string;
  description: string;
  isPublic: boolean;
  gameIds: string[];
  createdAt: string;
  updatedAt: string;
}

class AuthService {
  private readonly ACCESS_TOKEN_KEY = "accessToken";
  private readonly REFRESH_TOKEN_KEY = "refreshToken";
  private readonly USER_KEY = "user";

  // Store tokens and user data
  storeTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    console.log("Tokens stored successfully");
  }

  storeUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    console.log("User stored successfully:", user.username);
  }

  // Get stored data
  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error("Failed to parse stored user:", error);
      this.clearStorage();
      return null;
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    const user = this.getCurrentUser();

    if (!token || !user) {
      return false;
    }

    console.log(
      "Authentication check - User:",
      user.username,
      "Token exists:",
      !!token
    );
    return true;
  }

  // Create authorization headers
  private getAuthHeaders(): HeadersInit {
    const token = this.getAccessToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      console.log(
        "Adding auth header with token:",
        token.substring(0, 20) + "..."
      );
    }

    return headers;
  }

  // Login with username/password
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      console.log("Login request to:", `${API_URL}/api/users/auth/login`);

      const response = await fetch(`${API_URL}/api/users/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();
      console.log("Login response:", result.success ? "success" : "failed");

      if (result.success && result.data) {
        this.storeTokens(result.data.accessToken, result.data.refreshToken);
        this.storeUser(result.data.user);
        console.log("Login successful for user:", result.data.user.username);
      }

      return result;
    } catch (error) {
      console.error("Login request failed:", error);
      return {
        success: false,
        message: "Network error during login",
      };
    }
  }

  // Register new user
  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      console.log("Register request to:", `${API_URL}/api/users/auth/register`);

      const response = await fetch(`${API_URL}/api/users/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();
      console.log("Register response:", result.success ? "success" : "failed");

      if (result.success && result.data) {
        this.storeTokens(result.data.accessToken, result.data.refreshToken);
        this.storeUser(result.data.user);
        console.log(
          "Registration successful for user:",
          result.data.user.username
        );
      }

      return result;
    } catch (error) {
      console.error("Registration request failed:", error);
      return {
        success: false,
        message: "Network error during registration",
      };
    }
  }

  // Initiate GitLab OAuth login
  async initiateGitLabAuth(): Promise<string> {
    try {
      console.log(
        "GitLab auth request to:",
        `${API_URL}/api/users/auth/gitlab/login`
      );

      const response = await fetch(`${API_URL}/api/users/auth/gitlab/login`);
      const result = await response.json();

      if (result.success && result.authUrl) {
        console.log("GitLab auth URL received");
        return result.authUrl;
      } else {
        throw new Error(result.message || "Failed to get OAuth URL");
      }
    } catch (error) {
      console.error("GitLab auth initiation failed:", error);
      throw error;
    }
  }

  // Record completed game to profile service
  async recordGame(gameData: GameRecord): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Recording game to:", `${API_URL}/api/profile/games`);
      console.log("Game data:", gameData);

      const response = await fetch(`${API_URL}/api/profile/games`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          gameId: gameData.gameId,
          word: gameData.word,
          guesses: gameData.guesses,
          won: gameData.won,
          attempts: gameData.attempts,
          date: gameData.date,
        }),
      });

      console.log("Game record response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Game record error:", errorText);
        throw new Error(
          `Failed to record game: ${response.status} ${errorText}`
        );
      }

      const result = await response.json();
      console.log("Game recorded successfully:", result);
    } catch (error) {
      console.error("Failed to record game:", error);
      throw error;
    }
  }

  // Get user's game history
  async getGameHistory(
    limit: number = 20,
    offset: number = 0
  ): Promise<GameRecord[]> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log(
        "Fetching game history from:",
        `${API_URL}/api/profile/games`
      );

      const response = await fetch(
        `${API_URL}/api/profile/games?limit=${limit}&offset=${offset}`,
        {
          method: "GET",
          headers: this.getAuthHeaders(),
        }
      );

      console.log("Game history response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch game history:", errorText);
        throw new Error(`Failed to fetch game history: ${response.status}`);
      }

      const result = await response.json();
      console.log("Raw game history received:", result);

      // Handle the nested data structure from profile service
      const games = result.success ? result.data : result;

      // Map profile service fields to frontend expected fields
      const mappedGames = Array.isArray(games)
        ? games.map((game: any) => ({
            gameId: game.gameId || game.game_id || game.id,
            word: game.targetWord || game.target_word || game.word || "UNKNOWN",
            guesses: game.guesses || [],
            won: game.won || false,
            attempts: game.attempts || 0,
            date:
              game.completedAt ||
              game.completed_at ||
              game.date ||
              game.createdAt ||
              game.created_at,

            id: game.id,
            targetWord: game.targetWord || game.target_word,
            completedAt: game.completedAt || game.completed_at,
            createdAt: game.createdAt || game.created_at,
          }))
        : [];

      console.log("Mapped game history:", mappedGames);
      return mappedGames;
    } catch (error) {
      console.error("Failed to get game history:", error);
      return [];
    }
  }

  // Get user statistics
  async getUserStats(): Promise<UserStats> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Fetching user stats from:", `${API_URL}/api/profile/stats`);

      const response = await fetch(`${API_URL}/api/profile/stats`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      console.log("Stats response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch stats:", errorText);
        throw new Error(`Failed to fetch user stats: ${response.status}`);
      }

      const result = await response.json();
      console.log("Raw user stats received:", result);

      const statsData = result.success ? result.data : result;

      // Fix: Ensure guessDistribution has proper number values
      const rawDistribution = statsData.guessDistribution || {};
      const guessDistribution: { [attempts: string]: number } = {};

      for (let i = 1; i <= 6; i++) {
        const key = i.toString();
        const value = rawDistribution[key] || rawDistribution[i] || 0;
        guessDistribution[key] =
          typeof value === "number"
            ? value
            : parseInt(value?.toString() || "0");
      }

      console.log("Fixed guess distribution:", guessDistribution);

      return {
        totalGames: parseInt(statsData.totalGames?.toString() || "0"),
        wins: parseInt(statsData.wins?.toString() || "0"),
        winRate: parseFloat(statsData.winRate?.toString() || "0"),
        currentStreak: parseInt(statsData.currentStreak?.toString() || "0"),
        maxStreak: parseInt(statsData.maxStreak?.toString() || "0"),
        averageAttempts: parseFloat(
          statsData.averageAttempts?.toString() || "0"
        ),
        guessDistribution,
        lastPlayedAt: statsData.lastPlayedAt
          ? new Date(statsData.lastPlayedAt)
          : null,
      };
    } catch (error) {
      console.error("Failed to get user stats:", error);

      return {
        totalGames: 0,
        wins: 0,
        winRate: 0,
        currentStreak: 0,
        maxStreak: 0,
        averageAttempts: 0,
        guessDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 },
        lastPlayedAt: null,
      };
    }
  }

  // === ALBUM MANAGEMENT METHODS ===
  async createAlbum(albumData: {
    title: string;
    description: string;
    isPublic: boolean;
  }): Promise<GameAlbum> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Creating album:", albumData);

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/albums`,
        {
          method: "POST",
          body: JSON.stringify(albumData),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to create album");
      }

      console.log("Album created successfully:", result.data);
      return result.data;
    } catch (error) {
      console.error("Failed to create album:", error);
      throw error;
    }
  }

  async getUserAlbums(): Promise<GameAlbum[]> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Fetching user albums");

      const response = await fetch(`${API_URL}/api/profile/albums`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch albums:", errorText);
        throw new Error(`Failed to fetch albums: ${response.status}`);
      }

      const result = await response.json();
      const albums = result.success ? result.data : result;

      console.log("Albums fetched successfully:", albums.length);
      return Array.isArray(albums) ? albums : [];
    } catch (error) {
      console.error("Failed to get user albums:", error);
      return [];
    }
  }

  async getAlbumWithGames(
    albumId: string
  ): Promise<GameAlbum & { games?: GameRecord[] }> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Fetching album with games:", albumId);

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/albums/${albumId}`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to fetch album");
      }

      console.log("Album with games fetched successfully");
      return result.success ? result.data : result;
    } catch (error) {
      console.error("Failed to get album with games:", error);
      throw error;
    }
  }

  // FIXED: Add the missing updateAlbum method
  async updateAlbum(
    albumId: string,
    updates: {
      title?: string;
      description?: string;
      isPublic?: boolean;
    }
  ): Promise<GameAlbum> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Updating album:", albumId, updates);

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/albums/${albumId}`,
        {
          method: "PUT",
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update album");
      }

      const result = await response.json();
      console.log("Album updated successfully");
      return result.success ? result.data : result;
    } catch (error) {
      console.error("Failed to update album:", error);
      throw error;
    }
  }

  async deleteAlbum(albumId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Deleting album:", albumId);

      const response = await fetch(`${API_URL}/api/profile/albums/${albumId}`, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete album");
      }

      console.log("Album deleted successfully");
    } catch (error) {
      console.error("Failed to delete album:", error);
      throw error;
    }
  }

  async addGameToAlbum(albumId: string, gameId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Adding game to album:", { albumId, gameId });

      const response = await fetch(
        `${API_URL}/api/profile/albums/${albumId}/games/${gameId}`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add game to album");
      }

      console.log("Game added to album successfully");
    } catch (error) {
      console.error("Failed to add game to album:", error);
      throw error;
    }
  }

  async removeGameFromAlbum(albumId: string, gameId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Removing game from album:", { albumId, gameId });

      const response = await fetch(
        `${API_URL}/api/profile/albums/${albumId}/games/${gameId}`,
        {
          method: "DELETE",
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to remove game from album");
      }

      console.log("Game removed from album successfully");
    } catch (error) {
      console.error("Failed to remove game from album:", error);
      throw error;
    }
  }

  // === GAME VISUALIZATION ===
  async getGameVisualization(gameId: string): Promise<any> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Fetching game visualization:", gameId);

      const response = await fetch(
        `${API_URL}/api/profile/games/${gameId}/visualization`,
        {
          method: "GET",
          headers: this.getAuthHeaders(),
        }
      );

      console.log("Visualization response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Failed to fetch game visualization:",
          response.status,
          errorText
        );
        return null;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text();
        console.error(
          "Non-JSON response from visualization endpoint:",
          textResponse
        );
        return null;
      }

      const result = await response.json();
      console.log("Game visualization fetched successfully");
      return result.success ? result.data : result;
    } catch (error) {
      console.error("Failed to get game visualization:", error);
      return null;
    }
  }

  // Helper method for authenticated requests
  private async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    return fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });
  }

  // Refresh access token
  async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearStorage();
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/api/users/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        this.clearStorage();
        return false;
      }

      const result = await response.json();
      if (result.success && result.data) {
        this.storeTokens(result.data.accessToken, result.data.refreshToken);
        return true;
      }

      this.clearStorage();
      return false;
    } catch (error) {
      console.error("Token refresh failed:", error);
      this.clearStorage();
      return false;
    }
  }

  createTestUser(): void {
    if (!this.isAuthenticated()) {
      const testUser: User = {
        id: "5",
        username: "jenkelma",
        email: "jenkelma@example.com",
        created_at: new Date().toISOString(),
      };

      const testToken = "mock_access_token_5_" + Date.now();
      const testRefreshToken = "mock_refresh_token_5_" + Date.now();

      this.storeTokens(testToken, testRefreshToken);
      this.storeUser(testUser);

      console.log("Test user created:", testUser.username);
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      if (this.isAuthenticated()) {
        await fetch(`${API_URL}/api/users/auth/logout`, {
          method: "POST",
          headers: this.getAuthHeaders(),
        });
      }
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      this.clearStorage();
      console.log("Logout completed - storage cleared");
    }
  }

  // Clear all stored data
  private clearStorage(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }
}

export const authService =
  new AuthService(); 
  
  // services/auth.ts - Fixed auth service with better error handling
const getApiUrl = (): string => {
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost"
  ) {
    return ""; // Use relative paths in production
  }
  return "http://localhost:8002"; // Development - API Gateway port
};

const API_URL = getApiUrl();

export interface User {
  id: string | number;
  username: string;
  email: string;
  gitlab_id?: number;
  created_at: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

export interface GameRecord {
  gameId: string;
  word: string;
  guesses: string[];
  won: boolean;
  date: string;
  attempts: number;
}

export interface UserStats {
  totalGames: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  averageAttempts: number;
  guessDistribution: { [attempts: string]: number };
  lastPlayedAt: Date | null;
}

export interface GameAlbum {
  id: string;
  userId: string;
  title: string;
  description: string;
  isPublic: boolean;
  gameIds: string[];
  createdAt: string;
  updatedAt: string;
}

class AuthService {
  private readonly ACCESS_TOKEN_KEY = "accessToken";
  private readonly REFRESH_TOKEN_KEY = "refreshToken";
  private readonly USER_KEY = "user";

  // Store tokens and user data
  storeTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    console.log("Tokens stored successfully");
  }

  storeUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    console.log("User stored successfully:", user.username);
  }

  // Get stored data
  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error("Failed to parse stored user:", error);
      this.clearStorage();
      return null;
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    const user = this.getCurrentUser();

    if (!token || !user) {
      return false;
    }

    console.log(
      "Authentication check - User:",
      user.username,
      "Token exists:",
      !!token
    );
    return true;
  }

  // Create authorization headers
  private getAuthHeaders(): HeadersInit {
    const token = this.getAccessToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      console.log(
        "Adding auth header with token:",
        token.substring(0, 20) + "..."
      );
    }

    return headers;
  }

  // Login with username/password
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      console.log("Login request to:", `${API_URL}/api/users/auth/login`);

      const response = await fetch(`${API_URL}/api/users/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();
      console.log("Login response:", result.success ? "success" : "failed");

      if (result.success && result.data) {
        this.storeTokens(result.data.accessToken, result.data.refreshToken);
        this.storeUser(result.data.user);
        console.log("Login successful for user:", result.data.user.username);
      }

      return result;
    } catch (error) {
      console.error("Login request failed:", error);
      return {
        success: false,
        message: "Network error during login",
      };
    }
  }

  // Register new user
  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      console.log("Register request to:", `${API_URL}/api/users/auth/register`);

      const response = await fetch(`${API_URL}/api/users/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();
      console.log("Register response:", result.success ? "success" : "failed");

      if (result.success && result.data) {
        this.storeTokens(result.data.accessToken, result.data.refreshToken);
        this.storeUser(result.data.user);
        console.log(
          "Registration successful for user:",
          result.data.user.username
        );
      }

      return result;
    } catch (error) {
      console.error("Registration request failed:", error);
      return {
        success: false,
        message: "Network error during registration",
      };
    }
  }

  // Initiate GitLab OAuth login
  async initiateGitLabAuth(): Promise<string> {
    try {
      console.log(
        "GitLab auth request to:",
        `${API_URL}/api/users/auth/gitlab/login`
      );

      const response = await fetch(`${API_URL}/api/users/auth/gitlab/login`);
      const result = await response.json();

      if (result.success && result.authUrl) {
        console.log("GitLab auth URL received");
        return result.authUrl;
      } else {
        throw new Error(result.message || "Failed to get OAuth URL");
      }
    } catch (error) {
      console.error("GitLab auth initiation failed:", error);
      throw error;
    }
  }

  // Record completed game to profile service
  async recordGame(gameData: GameRecord): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Recording game to:", `${API_URL}/api/profile/games`);
      console.log("Game data:", gameData);

      const response = await fetch(`${API_URL}/api/profile/games`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          gameId: gameData.gameId,
          word: gameData.word,
          guesses: gameData.guesses,
          won: gameData.won,
          attempts: gameData.attempts,
          date: gameData.date,
        }),
      });

      console.log("Game record response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Game record error:", errorText);
        throw new Error(
          `Failed to record game: ${response.status} ${errorText}`
        );
      }

      const result = await response.json();
      console.log("Game recorded successfully:", result);
    } catch (error) {
      console.error("Failed to record game:", error);
      throw error;
    }
  }

  // Get user's game history
  async getGameHistory(
    limit: number = 20,
    offset: number = 0
  ): Promise<GameRecord[]> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log(
        "Fetching game history from:",
        `${API_URL}/api/profile/games`
      );

      const response = await fetch(
        `${API_URL}/api/profile/games?limit=${limit}&offset=${offset}`,
        {
          method: "GET",
          headers: this.getAuthHeaders(),
        }
      );

      console.log("Game history response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch game history:", errorText);
        throw new Error(`Failed to fetch game history: ${response.status}`);
      }

      const result = await response.json();
      console.log("Raw game history received:", result);

      // Handle the nested data structure from profile service
      const games = result.success ? result.data : result;

      // Map profile service fields to frontend expected fields
      const mappedGames = Array.isArray(games)
        ? games.map((game: any) => ({
            gameId: game.gameId || game.game_id || game.id,
            word: game.targetWord || game.target_word || game.word || "UNKNOWN",
            guesses: game.guesses || [],
            won: game.won || false,
            attempts: game.attempts || 0,
            date:
              game.completedAt ||
              game.completed_at ||
              game.date ||
              game.createdAt ||
              game.created_at,

            id: game.id,
            targetWord: game.targetWord || game.target_word,
            completedAt: game.completedAt || game.completed_at,
            createdAt: game.createdAt || game.created_at,
          }))
        : [];

      console.log("Mapped game history:", mappedGames);
      return mappedGames;
    } catch (error) {
      console.error("Failed to get game history:", error);
      return [];
    }
  }

  // Get user statistics
  async getUserStats(): Promise<UserStats> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Fetching user stats from:", `${API_URL}/api/profile/stats`);

      const response = await fetch(`${API_URL}/api/profile/stats`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      console.log("Stats response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch stats:", errorText);
        throw new Error(`Failed to fetch user stats: ${response.status}`);
      }

      const result = await response.json();
      console.log("Raw user stats received:", result);

      const statsData = result.success ? result.data : result;

      // Fix: Ensure guessDistribution has proper number values
      const rawDistribution = statsData.guessDistribution || {};
      const guessDistribution: { [attempts: string]: number } = {};

      for (let i = 1; i <= 6; i++) {
        const key = i.toString();
        const value = rawDistribution[key] || rawDistribution[i] || 0;
        guessDistribution[key] =
          typeof value === "number"
            ? value
            : parseInt(value?.toString() || "0");
      }

      console.log("Fixed guess distribution:", guessDistribution);

      return {
        totalGames: parseInt(statsData.totalGames?.toString() || "0"),
        wins: parseInt(statsData.wins?.toString() || "0"),
        winRate: parseFloat(statsData.winRate?.toString() || "0"),
        currentStreak: parseInt(statsData.currentStreak?.toString() || "0"),
        maxStreak: parseInt(statsData.maxStreak?.toString() || "0"),
        averageAttempts: parseFloat(
          statsData.averageAttempts?.toString() || "0"
        ),
        guessDistribution,
        lastPlayedAt: statsData.lastPlayedAt
          ? new Date(statsData.lastPlayedAt)
          : null,
      };
    } catch (error) {
      console.error("Failed to get user stats:", error);

      return {
        totalGames: 0,
        wins: 0,
        winRate: 0,
        currentStreak: 0,
        maxStreak: 0,
        averageAttempts: 0,
        guessDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 },
        lastPlayedAt: null,
      };
    }
  }

  // === ALBUM MANAGEMENT METHODS ===
  async createAlbum(albumData: {
    title: string;
    description: string;
    isPublic: boolean;
  }): Promise<GameAlbum> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Creating album:", albumData);

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/albums`,
        {
          method: "POST",
          body: JSON.stringify(albumData),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to create album");
      }

      console.log("Album created successfully:", result.data);
      return result.data;
    } catch (error) {
      console.error("Failed to create album:", error);
      throw error;
    }
  }

  async getUserAlbums(): Promise<GameAlbum[]> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Fetching user albums");

      const response = await fetch(`${API_URL}/api/profile/albums`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch albums:", errorText);
        throw new Error(`Failed to fetch albums: ${response.status}`);
      }

      const result = await response.json();
      const albums = result.success ? result.data : result;

      console.log("Albums fetched successfully:", albums.length);
      return Array.isArray(albums) ? albums : [];
    } catch (error) {
      console.error("Failed to get user albums:", error);
      return [];
    }
  }

  async getAlbumWithGames(
    albumId: string
  ): Promise<GameAlbum & { games?: GameRecord[] }> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Fetching album with games:", albumId);

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/albums/${albumId}`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to fetch album");
      }

      console.log("Album with games fetched successfully");
      return result.success ? result.data : result;
    } catch (error) {
      console.error("Failed to get album with games:", error);
      throw error;
    }
  }

  async updateAlbum(
    albumId: string,
    updates: {
      title?: string;
      description?: string;
      isPublic?: boolean;
    }
  ): Promise<GameAlbum> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Updating album:", albumId, updates);

      const response = await fetch(`${API_URL}/api/profile/albums/${albumId}`, {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update album");
      }

      const result = await response.json();
      console.log("Album updated successfully");
      return result.success ? result.data : result;
    } catch (error) {
      console.error("Failed to update album:", error);
      throw error;
    }
  }

  async deleteAlbum(albumId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Deleting album:", albumId);

      const response = await fetch(`${API_URL}/api/profile/albums/${albumId}`, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete album");
      }

      console.log("Album deleted successfully");
    } catch (error) {
      console.error("Failed to delete album:", error);
      throw error;
    }
  }

  async addGameToAlbum(albumId: string, gameId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Adding game to album:", { albumId, gameId });

      const response = await fetch(
        `${API_URL}/api/profile/albums/${albumId}/games/${gameId}`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add game to album");
      }

      console.log("Game added to album successfully");
    } catch (error) {
      console.error("Failed to add game to album:", error);
      throw error;
    }
  }

  async removeGameFromAlbum(albumId: string, gameId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Removing game from album:", { albumId, gameId });

      const response = await fetch(
        `${API_URL}/api/profile/albums/${albumId}/games/${gameId}`,
        {
          method: "DELETE",
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to remove game from album");
      }

      console.log("Game removed from album successfully");
    } catch (error) {
      console.error("Failed to remove game from album:", error);
      throw error;
    }
  }

  // === GAME VISUALIZATION ===
  async getGameVisualization(gameId: string): Promise<any> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("Fetching game visualization:", gameId);

      const response = await fetch(
        `${API_URL}/api/profile/games/${gameId}/visualization`,
        {
          method: "GET",
          headers: this.getAuthHeaders(),
        }
      );

      console.log("Visualization response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Failed to fetch game visualization:",
          response.status,
          errorText
        );
        return null;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text();
        console.error(
          "Non-JSON response from visualization endpoint:",
          textResponse
        );
        return null;
      }

      const result = await response.json();
      console.log("Game visualization fetched successfully");
      return result.success ? result.data : result;
    } catch (error) {
      console.error("Failed to get game visualization:", error);
      return null;
    }
  }

  // Helper method for authenticated requests
  private async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    return fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });
  }

  // Refresh access token
  async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearStorage();
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/api/users/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        this.clearStorage();
        return false;
      }

      const result = await response.json();
      if (result.success && result.data) {
        this.storeTokens(result.data.accessToken, result.data.refreshToken);
        return true;
      }

      this.clearStorage();
      return false;
    } catch (error) {
      console.error("Token refresh failed:", error);
      this.clearStorage();
      return false;
    }
  }

  createTestUser(): void {
    if (!this.isAuthenticated()) {
      const testUser: User = {
        id: "5",
        username: "jenkelma",
        email: "jenkelma@example.com",
        created_at: new Date().toISOString(),
      };

      const testToken = "mock_access_token_5_" + Date.now();
      const testRefreshToken = "mock_refresh_token_5_" + Date.now();

      this.storeTokens(testToken, testRefreshToken);
      this.storeUser(testUser);

      console.log("Test user created:", testUser.username);
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      if (this.isAuthenticated()) {
        await fetch(`${API_URL}/api/users/auth/logout`, {
          method: "POST",
          headers: this.getAuthHeaders(),
        });
      }
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      this.clearStorage();
      console.log("Logout completed - storage cleared");
    }
  }

  // Clear all stored data
  private clearStorage(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }
}

export const authService = new AuthService();
// services/auth.ts - FIXED VERSION with proper token handling
const getApiUrl = (): string => {
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost"
  ) {
    return ""; // Use relative paths in production
  }
  return "http://localhost:8002"; // Development - API Gateway port
};

const API_URL = getApiUrl();

export interface User {
  id: string | number;
  username: string;
  email: string;
  gitlab_id?: number;
  created_at: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

export interface GameRecord {
  gameId: string;
  word: string;
  guesses: string[];
  won: boolean;
  date: string;
  attempts: number;
}

export interface UserStats {
  totalGames: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  averageAttempts: number;
  guessDistribution: { [attempts: string]: number };
  lastPlayedAt: Date | null;
}

export interface GameAlbum {
  id: string;
  userId: string;
  title: string;
  description: string;
  isPublic: boolean;
  gameIds: string[];
  createdAt: string;
  updatedAt: string;
}

class AuthService {
  private readonly ACCESS_TOKEN_KEY = "accessToken";
  private readonly REFRESH_TOKEN_KEY = "refreshToken";
  private readonly USER_KEY = "user";

  // Store tokens and user data
  storeTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    console.log("🔑 Tokens stored successfully");
  }

  storeUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    console.log("👤 User stored successfully:", user.username);
  }

  // Get stored data
  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error("Failed to parse stored user:", error);
      this.clearStorage();
      return null;
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    const user = this.getCurrentUser();

    if (!token || !user) {
      return false;
    }

    console.log(
      "🔐 Authentication check - User:",
      user.username,
      "Token exists:",
      !!token
    );
    return true;
  }

  // Create authorization headers - FIXED VERSION
  private getAuthHeaders(): HeadersInit {
    const token = this.getAccessToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      console.log(
        "🔑 Adding auth header with token:",
        token.substring(0, 20) + "..."
      );
    } else {
      console.log("❌ No token available for auth header");
    }

    return headers;
  }

  // FIXED: Helper method for authenticated requests
  private async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const headers = this.getAuthHeaders();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      console.log("🔄 Token expired, clearing auth state");
      this.clearStorage();
      throw new Error("Authentication expired. Please log in again.");
    }

    return response;
  }

  // Login with username/password
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      console.log("📡 Login request to:", `${API_URL}/api/users/auth/login`);

      const response = await fetch(`${API_URL}/api/users/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();
      console.log("📡 Login response:", result.success ? "success" : "failed");

      if (result.success && result.data) {
        this.storeTokens(result.data.accessToken, result.data.refreshToken);
        this.storeUser(result.data.user);
        console.log("✅ Login successful for user:", result.data.user.username);
      }

      return result;
    } catch (error) {
      console.error("❌ Login request failed:", error);
      return {
        success: false,
        message: "Network error during login",
      };
    }
  }

  // Register new user
  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      console.log(
        "📡 Register request to:",
        `${API_URL}/api/users/auth/register`
      );

      const response = await fetch(`${API_URL}/api/users/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();
      console.log(
        "📡 Register response:",
        result.success ? "success" : "failed"
      );

      if (result.success && result.data) {
        this.storeTokens(result.data.accessToken, result.data.refreshToken);
        this.storeUser(result.data.user);
        console.log(
          "✅ Registration successful for user:",
          result.data.user.username
        );
      }

      return result;
    } catch (error) {
      console.error("❌ Registration request failed:", error);
      return {
        success: false,
        message: "Network error during registration",
      };
    }
  }

  // Initiate GitLab OAuth login
  async initiateGitLabAuth(): Promise<string> {
    try {
      console.log(
        "📡 GitLab auth request to:",
        `${API_URL}/api/users/auth/gitlab/login`
      );

      const response = await fetch(`${API_URL}/api/users/auth/gitlab/login`);
      const result = await response.json();

      if (result.success && result.authUrl) {
        console.log("✅ GitLab auth URL received");
        return result.authUrl;
      } else {
        throw new Error(result.message || "Failed to get OAuth URL");
      }
    } catch (error) {
      console.error("❌ GitLab auth initiation failed:", error);
      throw error;
    }
  }

  // Record completed game to profile service
  async recordGame(gameData: GameRecord): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("📡 Recording game to:", `${API_URL}/api/profile/games`);
      console.log("🎮 Game data:", gameData);

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/games`,
        {
          method: "POST",
          body: JSON.stringify({
            gameId: gameData.gameId,
            word: gameData.word,
            guesses: gameData.guesses,
            won: gameData.won,
            attempts: gameData.attempts,
            date: gameData.date,
          }),
        }
      );

      console.log("📡 Game record response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Game record error:", errorText);
        throw new Error(
          `Failed to record game: ${response.status} ${errorText}`
        );
      }

      const result = await response.json();
      console.log("✅ Game recorded successfully:", result);
    } catch (error) {
      console.error("❌ Failed to record game:", error);
      throw error;
    }
  }

  // Get user's game history
  async getGameHistory(
    limit: number = 20,
    offset: number = 0
  ): Promise<GameRecord[]> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log(
        "🎮 Fetching game history from:",
        `${API_URL}/api/profile/games`
      );

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/games?limit=${limit}&offset=${offset}`
      );

      console.log("🎮 Game history response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Failed to fetch game history:", errorText);
        throw new Error(`Failed to fetch game history: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Raw game history received:", result);

      // Handle the nested data structure from profile service
      const games = result.success ? result.data : result;

      // Map profile service fields to frontend expected fields
      const mappedGames = Array.isArray(games)
        ? games.map((game: any) => ({
            gameId: game.gameId || game.game_id || game.id,
            word: game.targetWord || game.target_word || game.word || "UNKNOWN",
            guesses: game.guesses || [],
            won: game.won || false,
            attempts: game.attempts || 0,
            date:
              game.completedAt ||
              game.completed_at ||
              game.date ||
              game.createdAt ||
              game.created_at,

            id: game.id,
            targetWord: game.targetWord || game.target_word,
            completedAt: game.completedAt || game.completed_at,
            createdAt: game.createdAt || game.created_at,
          }))
        : [];

      console.log("🔄 Mapped game history:", mappedGames);
      return mappedGames;
    } catch (error) {
      console.error("❌ Failed to get game history:", error);
      return [];
    }
  }

  // Get user statistics
  async getUserStats(): Promise<UserStats> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log(
        "📊 Fetching user stats from:",
        `${API_URL}/api/profile/stats`
      );

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/stats`
      );

      console.log("📊 Stats response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Failed to fetch stats:", errorText);
        throw new Error(`Failed to fetch user stats: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Raw user stats received:", result);

      const statsData = result.success ? result.data : result;

      // Fix: Ensure guessDistribution has proper number values
      const rawDistribution = statsData.guessDistribution || {};
      const guessDistribution: { [attempts: string]: number } = {};

      for (let i = 1; i <= 6; i++) {
        const key = i.toString();
        const value = rawDistribution[key] || rawDistribution[i] || 0;
        guessDistribution[key] =
          typeof value === "number"
            ? value
            : parseInt(value?.toString() || "0");
      }

      console.log("🔄 Fixed guess distribution:", guessDistribution);

      return {
        totalGames: parseInt(statsData.totalGames?.toString() || "0"),
        wins: parseInt(statsData.wins?.toString() || "0"),
        winRate: parseFloat(statsData.winRate?.toString() || "0"),
        currentStreak: parseInt(statsData.currentStreak?.toString() || "0"),
        maxStreak: parseInt(statsData.maxStreak?.toString() || "0"),
        averageAttempts: parseFloat(
          statsData.averageAttempts?.toString() || "0"
        ),
        guessDistribution,
        lastPlayedAt: statsData.lastPlayedAt
          ? new Date(statsData.lastPlayedAt)
          : null,
      };
    } catch (error) {
      console.error("❌ Failed to get user stats:", error);

      return {
        totalGames: 0,
        wins: 0,
        winRate: 0,
        currentStreak: 0,
        maxStreak: 0,
        averageAttempts: 0,
        guessDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 },
        lastPlayedAt: null,
      };
    }
  }

  // === ALBUM MANAGEMENT METHODS - FIXED VERSION ===
  async createAlbum(albumData: {
    title: string;
    description: string;
    isPublic: boolean;
  }): Promise<GameAlbum> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("📁 Creating album:", albumData);

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/albums`,
        {
          method: "POST",
          body: JSON.stringify(albumData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Create album failed:", response.status, errorText);
        throw new Error(`Failed to create album: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Album created successfully:", result.data);
      return result.data;
    } catch (error) {
      console.error("❌ Failed to create album:", error);
      throw error;
    }
  }

  async getUserAlbums(): Promise<GameAlbum[]> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("📁 Fetching user albums");

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/albums`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Failed to fetch albums:", errorText);
        throw new Error(`Failed to fetch albums: ${response.status}`);
      }

      const result = await response.json();
      const albums = result.success ? result.data : result;

      console.log("✅ Albums fetched successfully:", albums.length);
      return Array.isArray(albums) ? albums : [];
    } catch (error) {
      console.error("❌ Failed to get user albums:", error);
      return [];
    }
  }

  async getAlbumWithGames(
    albumId: string
  ): Promise<GameAlbum & { games?: GameRecord[] }> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("📁 Fetching album with games:", albumId);

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/albums/${albumId}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Failed to fetch album:", errorText);
        throw new Error(`Failed to fetch album: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Album with games fetched successfully");
      return result.success ? result.data : result;
    } catch (error) {
      console.error("❌ Failed to get album with games:", error);
      throw error;
    }
  }

  async updateAlbum(
    albumId: string,
    updates: {
      title?: string;
      description?: string;
      isPublic?: boolean;
    }
  ): Promise<GameAlbum> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("📁 Updating album:", albumId, updates);

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/albums/${albumId}`,
        {
          method: "PUT",
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update album");
      }

      const result = await response.json();
      console.log("✅ Album updated successfully");
      return result.success ? result.data : result;
    } catch (error) {
      console.error("❌ Failed to update album:", error);
      throw error;
    }
  }

  async deleteAlbum(albumId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("📁 Deleting album:", albumId);

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/albums/${albumId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete album");
      }

      console.log("✅ Album deleted successfully");
    } catch (error) {
      console.error("❌ Failed to delete album:", error);
      throw error;
    }
  }

  async addGameToAlbum(albumId: string, gameId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("📁 Adding game to album:", { albumId, gameId });

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/albums/${albumId}/games/${gameId}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add game to album");
      }

      console.log("✅ Game added to album successfully");
    } catch (error) {
      console.error("❌ Failed to add game to album:", error);
      throw error;
    }
  }

  async removeGameFromAlbum(albumId: string, gameId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("📁 Removing game from album:", { albumId, gameId });

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/albums/${albumId}/games/${gameId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to remove game from album");
      }

      console.log("✅ Game removed from album successfully");
    } catch (error) {
      console.error("❌ Failed to remove game from album:", error);
      throw error;
    }
  }

  // === GAME VISUALIZATION ===
  async getGameVisualization(gameId: string): Promise<any> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("🎨 Fetching game visualization:", gameId);

      const response = await this.makeAuthenticatedRequest(
        `${API_URL}/api/profile/games/${gameId}/visualization`
      );

      console.log("🎨 Visualization response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "❌ Failed to fetch game visualization:",
          response.status,
          errorText
        );
        return null;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text();
        console.error(
          "❌ Non-JSON response from visualization endpoint:",
          textResponse
        );
        return null;
      }

      const result = await response.json();
      console.log("✅ Game visualization fetched successfully");
      return result.success ? result.data : result;
    } catch (error) {
      console.error("❌ Failed to get game visualization:", error);
      return null;
    }
  }

  // Refresh access token
  async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearStorage();
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/api/users/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        this.clearStorage();
        return false;
      }

      const result = await response.json();
      if (result.success && result.data) {
        this.storeTokens(result.data.accessToken, result.data.refreshToken);
        return true;
      }

      this.clearStorage();
      return false;
    } catch (error) {
      console.error("Token refresh failed:", error);
      this.clearStorage();
      return false;
    }
  }

  createTestUser(): void {
    if (!this.isAuthenticated()) {
      const testUser: User = {
        id: "5",
        username: "jenkelma",
        email: "jenkelma@example.com",
        created_at: new Date().toISOString(),
      };

      const testToken = "mock_access_token_5_" + Date.now();
      const testRefreshToken = "mock_refresh_token_5_" + Date.now();

      this.storeTokens(testToken, testRefreshToken);
      this.storeUser(testUser);

      console.log("🔧 Test user created:", testUser.username);
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      if (this.isAuthenticated()) {
        await this.makeAuthenticatedRequest(
          `${API_URL}/api/users/auth/logout`,
          {
            method: "POST",
          }
        );
      }
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      this.clearStorage();
      console.log("🔐 Logout completed - storage cleared");
    }
  }

  // Clear all stored data
  private clearStorage(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }
}

export const authService = new AuthService();
*/
