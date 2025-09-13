/*// hooks/useAuth.ts - FIXED: Single event handler to prevent duplicate initializations
import { useState, useEffect, useCallback, useRef } from "react";
import { authService } from "../services/auth";
import { User, LoginCredentials, RegisterData, AuthResponse } from "../types";
import { logger } from "../utils/logger";

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<AuthResponse>;
  register: (
    email: string,
    username: string,
    password: string
  ) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  clearError: () => void;
  initializeFromStorage: () => void;
  initiateOAuth: () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent multiple storage event handlers
  const storageListenerRef = useRef<boolean>(false);

  // Initialize authentication state from storage
  const initializeFromStorage = useCallback(() => {
    try {
      logger.debug("Initializing auth state from storage");
      if (authService.isAuthenticated()) {
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          logger.info("User authenticated from storage", {
            username: currentUser.username,
          });
        }
      }
    } catch (error) {
      logger.error("Failed to initialize auth from storage", { error });
      setError("Failed to restore authentication session");
    }
  }, []);

  // FIXED: Single storage event listener
  useEffect(() => {
    if (storageListenerRef.current) {
      return; // Already set up
    }

    storageListenerRef.current = true;

    const checkAuthState = () => {
      const currentUser = authService.getCurrentUser();
      const isAuth = authService.isAuthenticated();

      // Only update if there's a meaningful change
      if (isAuth && currentUser && (!user || user.id !== currentUser.id)) {
        logger.debug("Auth state changed - user logged in", {
          username: currentUser.username,
        });
        setUser(currentUser);
        setError(null);
      } else if (!isAuth && user) {
        logger.debug("Auth state changed - user logged out");
        setUser(null);
      }
    };

    // Initial check
    checkAuthState();

    // Listen for storage changes (OAuth flow)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "wordle_access_token" || e.key === "wordle_user") {
        logger.debug("Storage changed, checking auth state");
        setTimeout(checkAuthState, 100); // Small delay to ensure storage is updated
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      storageListenerRef.current = false;
    };
  }, [user]); // Depend on user to detect changes

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<AuthResponse> => {
      setLoading(true);
      setError(null);

      try {
        const credentials: LoginCredentials = { username, password };
        const response = await authService.login(credentials);

        if (response.success && response.data) {
          setUser(response.data.user);
          logger.info("Login successful via hook", {
            username: response.data.user.username,
          });
        } else {
          setError(response.message || "Login failed");
          logger.warn("Login failed via hook", {
            username,
            message: response.message,
          });
        }

        return response;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Network error during login";
        setError(errorMessage);
        logger.error("Login error in hook", { username, error });

        return {
          success: false,
          message: errorMessage,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const register = useCallback(
    async (
      email: string,
      username: string,
      password: string
    ): Promise<AuthResponse> => {
      setLoading(true);
      setError(null);

      try {
        const userData: RegisterData = { email, username, password };
        const response = await authService.register(userData);

        if (response.success && response.data) {
          setUser(response.data.user);
          logger.info("Registration successful via hook", {
            username: response.data.user.username,
          });
        } else {
          setError(response.message || "Registration failed");
          logger.warn("Registration failed via hook", {
            username,
            message: response.message,
          });
        }

        return response;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Network error during registration";
        setError(errorMessage);
        logger.error("Registration error in hook", { username, error });

        return {
          success: false,
          message: errorMessage,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const initiateOAuth = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      logger.info("Initiating OAuth flow");
      const authUrl = await authService.initiateGitLabAuth();
      window.location.href = authUrl;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start GitLab login";
      setError(errorMessage);
      logger.error("OAuth initiation failed", { error });
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await authService.logout();
      setUser(null);
      logger.info("Logout successful via hook");
    } catch (error) {
      logger.error("Logout error in hook", { error });
      // Still clear user state even if logout request failed
      setUser(null);
      setError("Logout completed with errors");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
    clearError,
    initializeFromStorage,
    initiateOAuth,
  };
};
*/ // hooks/useAuth.ts - FIXED: Eliminates OAuth race conditions and duplicate event handlers
// hooks/useAuth.ts - FIXED: Better OAuth state synchronization
import { useState, useEffect, useCallback, useRef } from "react";
import { authService } from "../services/auth";
import { User, LoginCredentials, RegisterData, AuthResponse } from "../types";
import { logger } from "../utils/logger";

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<AuthResponse>;
  register: (
    email: string,
    username: string,
    password: string
  ) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  clearError: () => void;
  initializeFromStorage: () => void;
  initiateOAuth: () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent multiple storage event handlers
  const storageListenerRef = useRef<boolean>(false);
  const lastAuthCheckRef = useRef<number>(0);
  const DEBOUNCE_MS = 100;

  // Initialize authentication state from storage
  const initializeFromStorage = useCallback(() => {
    try {
      logger.debug("Initializing auth state from storage");
      if (authService.isAuthenticated()) {
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          logger.info("User authenticated from storage", {
            username: currentUser.username,
          });
        }
      }
    } catch (error) {
      logger.error("Failed to initialize auth from storage", { error });
      setError("Failed to restore authentication session");
    }
  }, []);

  // FIXED: Better storage event listener with debouncing
  useEffect(() => {
    if (storageListenerRef.current) {
      return;
    }

    storageListenerRef.current = true;

    const checkAuthState = () => {
      const now = Date.now();

      // Debounce rapid auth state checks
      if (now - lastAuthCheckRef.current < DEBOUNCE_MS) {
        return;
      }
      lastAuthCheckRef.current = now;

      const currentUser = authService.getCurrentUser();
      const isAuth = authService.isAuthenticated();

      // More precise state update logic
      if (isAuth && currentUser) {
        if (
          !user ||
          user.id !== currentUser.id ||
          user.username !== currentUser.username
        ) {
          logger.debug("Auth state changed - user logged in", {
            username: currentUser.username,
            wasAuthenticated: !!user,
          });
          setUser(currentUser);
          setError(null);
        }
      } else if (!isAuth && user) {
        logger.debug("Auth state changed - user logged out");
        setUser(null);
      }
    };

    // Initial check with a small delay to allow for storage synchronization
    setTimeout(checkAuthState, 50);

    // FIXED: Listen for both storage events and custom auth events
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "wordle_access_token" || e.key === "wordle_user") {
        logger.debug("Storage changed, checking auth state", { key: e.key });
        // Longer delay for OAuth callbacks to ensure proper synchronization
        setTimeout(checkAuthState, 250);
      }
    };

    // Also listen for custom auth events (for same-window OAuth updates)
    const handleAuthEvent = (e: Event) => {
      logger.debug("Custom auth event received");
      setTimeout(checkAuthState, 100);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("auth-state-changed", handleAuthEvent);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("auth-state-changed", handleAuthEvent);
      storageListenerRef.current = false;
    };
  }, [user]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<AuthResponse> => {
      setLoading(true);
      setError(null);

      try {
        const credentials: LoginCredentials = { username, password };
        const response = await authService.login(credentials);

        if (response.success && response.data) {
          setUser(response.data.user);
          logger.info("Login successful via hook", {
            username: response.data.user.username,
          });
        } else {
          setError(response.message || "Login failed");
          logger.warn("Login failed via hook", {
            username,
            message: response.message,
          });
        }

        return response;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Network error during login";
        setError(errorMessage);
        logger.error("Login error in hook", { username, error });

        return {
          success: false,
          message: errorMessage,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const register = useCallback(
    async (
      email: string,
      username: string,
      password: string
    ): Promise<AuthResponse> => {
      setLoading(true);
      setError(null);

      try {
        const userData: RegisterData = { email, username, password };
        const response = await authService.register(userData);

        if (response.success && response.data) {
          setUser(response.data.user);
          logger.info("Registration successful via hook", {
            username: response.data.user.username,
          });
        } else {
          setError(response.message || "Registration failed");
          logger.warn("Registration failed via hook", {
            username,
            message: response.message,
          });
        }

        return response;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Network error during registration";
        setError(errorMessage);
        logger.error("Registration error in hook", { username, error });

        return {
          success: false,
          message: errorMessage,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const initiateOAuth = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      logger.info("Initiating OAuth flow");
      const authUrl = await authService.initiateGitLabAuth();

      // FIXED: Add a small delay before redirect to ensure state is updated
      await new Promise((resolve) => setTimeout(resolve, 100));

      window.location.href = authUrl;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start GitLab login";
      setError(errorMessage);
      logger.error("OAuth initiation failed", { error });
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await authService.logout();
      setUser(null);
      logger.info("Logout successful via hook");
    } catch (error) {
      logger.error("Logout error in hook", { error });
      // Still clear user state even if logout request failed
      setUser(null);
      setError("Logout completed with errors");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
    clearError,
    initializeFromStorage,
    initiateOAuth,
  };
};
