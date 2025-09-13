// App.tsx - FIXED: Proper OAuth callback handling without double login
import React, { useEffect, useState, useCallback } from "react";
import { AuthPage } from "./pages/AuthPage";
import { GamePage } from "./pages/GamePage";
import { ProfilePage } from "./pages/ProfilePage";
import { Header } from "./components/layout/Header";
import { LoadingSpinner } from "./components/layout/LoadingSpinner";
import { useAuth } from "./hooks/useAuth";
import { useNavigation } from "./hooks/useNavigation";
import { authService } from "./services/auth";
import { logger } from "./utils/logger";
import "./styles/main.css";

const App: React.FC = () => {
  const {
    user,
    loading: authLoading,
    error: authError,
    login,
    register,
    logout,
    clearError,
    initializeFromStorage,
    initiateOAuth,
  } = useAuth();

  const { currentRoute, navigateTo, forceRedirect } = useNavigation();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);

  // Initialize app once
  useEffect(() => {
    const initializeApp = async () => {
      try {
        logger.info("App initializing");

        // FIXED: More precise OAuth callback detection
        const isOAuthCallback = isValidOAuthCallback();

        if (isOAuthCallback) {
          setIsProcessingOAuth(true);
          logger.info("Processing OAuth callback");

          try {
            const oauthResult = await authService.processOAuthSuccess();
            if (oauthResult?.success && oauthResult.data) {
              logger.info("OAuth success, waiting for auth state sync");
              // Wait longer for proper state synchronization
              await new Promise((resolve) => setTimeout(resolve, 500));
              forceRedirect("game");
            } else {
              logger.error("OAuth failed, redirecting to login");
              forceRedirect("login");
            }
          } catch (error) {
            logger.error("OAuth processing failed", { error });
            forceRedirect("login");
          } finally {
            setIsProcessingOAuth(false);
          }
        } else {
          // Normal initialization - check existing auth
          initializeFromStorage();

          // FIXED: Don't redirect during OAuth processing
          if (
            !authService.isAuthenticated() &&
            currentRoute.page === "game" &&
            !isProcessingOAuth
          ) {
            logger.info("Not authenticated, defaulting to login page");
            forceRedirect("login");
          }
        }
      } catch (error) {
        logger.error("App initialization failed", { error });
        forceRedirect("login");
      } finally {
        setIsInitialized(true);
      }
    };

    if (!isInitialized) {
      initializeApp();
    }
  }, [
    isInitialized,
    initializeFromStorage,
    forceRedirect,
    currentRoute.page,
    isProcessingOAuth,
  ]);

  // FIXED: More precise OAuth callback detection
  const isValidOAuthCallback = (): boolean => {
    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;

    // Only consider it an OAuth callback if:
    // 1. We're on the exact OAuth success path, OR
    // 2. We have OAuth-specific data parameters
    const isOAuthPath = currentPath === "/oauth/success";
    const hasOAuthData =
      currentSearch.includes("data=") &&
      (currentSearch.includes("success") || currentSearch.includes("user"));
    const hasOAuthError =
      currentSearch.includes("error=") && currentSearch.includes("oauth");

    return isOAuthPath || hasOAuthData || hasOAuthError;
  };

  // FIXED: Handle authentication-based routing with OAuth consideration
  useEffect(() => {
    if (!isInitialized || authLoading || isProcessingOAuth) return;

    const isAuthenticated = !!user;

    // FIXED: Don't redirect during OAuth processing
    if (
      !isAuthenticated &&
      (currentRoute.page === "profile" || currentRoute.page === "game") &&
      !isProcessingOAuth
    ) {
      logger.warn("Authentication required - redirecting to login");
      forceRedirect("login");
      return;
    }

    // Redirect authenticated users from auth pages to game
    if (
      isAuthenticated &&
      (currentRoute.page === "login" || currentRoute.page === "register")
    ) {
      logger.info("User authenticated - redirecting to game");
      forceRedirect("game");
      return;
    }
  }, [
    user,
    currentRoute.page,
    isInitialized,
    authLoading,
    forceRedirect,
    isProcessingOAuth,
  ]);

  // Event handlers
  const handleAuthSuccess = useCallback(() => {
    clearError();
    navigateTo("game");
  }, [clearError, navigateTo]);

  const handleLogout = useCallback(async () => {
    await logout();
    forceRedirect("login");
  }, [logout, forceRedirect]);

  const handleModeChange = useCallback(
    (mode: "login" | "register") => {
      clearError();
      navigateTo(mode);
    },
    [clearError, navigateTo]
  );

  const handleNavigate = useCallback(
    (page: "game" | "login" | "register" | "profile") => {
      if ((page === "profile" || page === "game") && !user) {
        logger.warn("Authentication required for protected page");
        forceRedirect("login");
        return;
      }
      navigateTo(page);
    },
    [user, navigateTo, forceRedirect]
  );

  // Show loading during initialization or OAuth processing
  if (!isInitialized || isProcessingOAuth) {
    return (
      <div className="app">
        <div className="app-loading">
          <LoadingSpinner
            size="large"
            message={
              isProcessingOAuth ? "Processing login..." : "Starting Wordle..."
            }
          />
        </div>
      </div>
    );
  }

  // FIXED: More precise routing logic
  const shouldShowAuth =
    currentRoute.page === "login" ||
    currentRoute.page === "register" ||
    (!user &&
      (currentRoute.page === "game" || currentRoute.page === "profile"));

  return (
    <div className="app">
      <Header
        isAuthenticated={!!user}
        user={user}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        currentPage={currentRoute.page}
      />

      <main className="app-main">
        {authLoading && (
          <div className="app-loading">
            <LoadingSpinner size="large" message="Loading..." />
          </div>
        )}

        {!authLoading && (
          <>
            {shouldShowAuth && (
              <AuthPage
                mode={currentRoute.page === "register" ? "register" : "login"}
                onSuccess={handleAuthSuccess}
                onLogin={login}
                onRegister={register}
                onModeChange={handleModeChange}
                onOAuthLogin={initiateOAuth}
                loading={authLoading}
                error={authError}
              />
            )}

            {currentRoute.page === "profile" && user && (
              <ProfilePage
                user={user}
                selectedAlbumId={currentRoute.albumId}
                onNavigate={handleNavigate}
              />
            )}

            {currentRoute.page === "game" && user && (
              <GamePage
                gameId={currentRoute.gameId}
                onGameComplete={() => logger.info("Game completed")}
                onSessionUpdate={() => {}}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
/*// App.tsx - FIXED: OAuth callback race conditions and authentication state sync
import React, { useEffect, useState, useCallback } from "react";
import { AuthPage } from "./pages/AuthPage";
import { GamePage } from "./pages/GamePage";
import { ProfilePage } from "./pages/ProfilePage";
import { Header } from "./components/layout/Header";
import { LoadingSpinner } from "./components/layout/LoadingSpinner";
import { useAuth } from "./hooks/useAuth";
import { useNavigation } from "./hooks/useNavigation";
import { authService } from "./services/auth";
import { logger } from "./utils/logger";
import "./styles/main.css";

const App: React.FC = () => {
  const {
    user,
    loading: authLoading,
    error: authError,
    login,
    register,
    logout,
    clearError,
    initializeFromStorage,
    initiateOAuth,
  } = useAuth();

  const { currentRoute, navigateTo, forceRedirect } = useNavigation();
  const [isInitialized, setIsInitialized] = useState(false);
  const [oauthProcessing, setOauthProcessing] = useState(false);

  // FIXED: Comprehensive initialization with proper OAuth handling
  useEffect(() => {
    const initializeApp = async () => {
      try {
        logger.info("App initializing");
        setOauthProcessing(false);

        // FIXED: Check for OAuth callback FIRST and handle completely
        if (authService.isOAuthCallback()) {
          logger.info("OAuth callback detected, processing...");
          setOauthProcessing(true);

          try {
            const oauthResult = await authService.processOAuthSuccess();

            if (oauthResult?.success && oauthResult.data) {
              logger.info("OAuth success - authentication complete", {
                username: oauthResult.data.user.username,
              });

              // FIXED: Wait for auth state to fully update
              await new Promise((resolve) => setTimeout(resolve, 200));

              // Force redirect to game page after successful OAuth
              setTimeout(() => {
                forceRedirect("game");
                setOauthProcessing(false);
              }, 100);
              return;
            } else {
              logger.error("OAuth failed, redirecting to login", {
                message: oauthResult?.message,
              });
              setTimeout(() => {
                forceRedirect("login");
                setOauthProcessing(false);
              }, 100);
              return;
            }
          } catch (error) {
            logger.error("OAuth processing failed", { error });
            setTimeout(() => {
              forceRedirect("login");
              setOauthProcessing(false);
            }, 100);
            return;
          }
        }

        // Normal initialization - check existing auth
        initializeFromStorage();

        // FIXED: Only redirect if not authenticated and NOT processing OAuth
        if (!authService.isAuthenticated() && currentRoute.page === "game") {
          logger.info("Not authenticated, defaulting to login page");
          forceRedirect("login");
        }
      } catch (error) {
        logger.error("App initialization failed", { error });
        forceRedirect("login");
      } finally {
        setIsInitialized(true);
      }
    };

    if (!isInitialized) {
      initializeApp();
    }
  }, [isInitialized, initializeFromStorage, forceRedirect, currentRoute.page]);

  // FIXED: Authentication-based routing with OAuth awareness
  useEffect(() => {
    if (!isInitialized || authLoading || oauthProcessing) return;

    const isAuthenticated = !!user;

    // FIXED: Don't redirect during OAuth processing
    if (oauthProcessing) {
      logger.debug("OAuth processing active, skipping navigation checks");
      return;
    }

    // Redirect unauthenticated users from protected pages
    if (
      !isAuthenticated &&
      (currentRoute.page === "profile" || currentRoute.page === "game")
    ) {
      logger.warn("Authentication required - redirecting to login");
      forceRedirect("login");
      return;
    }

    // Redirect authenticated users from auth pages to game
    if (
      isAuthenticated &&
      (currentRoute.page === "login" || currentRoute.page === "register")
    ) {
      logger.info("User authenticated - redirecting to game");
      forceRedirect("game");
      return;
    }
  }, [
    user,
    currentRoute.page,
    isInitialized,
    authLoading,
    oauthProcessing,
    forceRedirect,
  ]);

  // Event handlers
  const handleAuthSuccess = useCallback(() => {
    clearError();
    navigateTo("game");
  }, [clearError, navigateTo]);

  const handleLogout = useCallback(async () => {
    await logout();
    forceRedirect("login");
  }, [logout, forceRedirect]);

  const handleModeChange = useCallback(
    (mode: "login" | "register") => {
      clearError();
      navigateTo(mode);
    },
    [clearError, navigateTo]
  );

  const handleNavigate = useCallback(
    (page: "game" | "login" | "register" | "profile") => {
      if ((page === "profile" || page === "game") && !user) {
        logger.warn("Authentication required for protected page");
        forceRedirect("login");
        return;
      }
      navigateTo(page);
    },
    [user, navigateTo, forceRedirect]
  );

  // FIXED: Show loading during initialization OR OAuth processing
  if (!isInitialized || oauthProcessing) {
    return (
      <div className="app">
        <div className="app-loading">
          <LoadingSpinner
            size="large"
            message={
              oauthProcessing ? "Completing login..." : "Starting Wordle..."
            }
          />
        </div>
      </div>
    );
  }

  // Determine what to show
  const shouldShowAuth =
    currentRoute.page === "login" ||
    currentRoute.page === "register" ||
    (!user &&
      (currentRoute.page === "game" || currentRoute.page === "profile"));

  return (
    <div className="app">
      <Header
        isAuthenticated={!!user}
        user={user}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        currentPage={currentRoute.page}
      />

      <main className="app-main">
        {authLoading && (
          <div className="app-loading">
            <LoadingSpinner size="large" message="Loading..." />
          </div>
        )}

        {!authLoading && (
          <>
            {shouldShowAuth && (
              <AuthPage
                mode={currentRoute.page === "register" ? "register" : "login"}
                onSuccess={handleAuthSuccess}
                onLogin={login}
                onRegister={register}
                onModeChange={handleModeChange}
                onOAuthLogin={initiateOAuth}
                loading={authLoading}
                error={authError}
              />
            )}

            {currentRoute.page === "profile" && user && (
              <ProfilePage
                user={user}
                selectedAlbumId={currentRoute.albumId}
                onNavigate={handleNavigate}
              />
            )}

            {currentRoute.page === "game" && user && (
              <GamePage
                gameId={currentRoute.gameId}
                onGameComplete={() => logger.info("Game completed")}
                onSessionUpdate={() => {}}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
// App.tsx - FIXED: Default to auth page, clean authentication flow
import React, { useEffect, useState, useCallback } from "react";
import { AuthPage } from "./pages/AuthPage";
import { GamePage } from "./pages/GamePage";
import { ProfilePage } from "./pages/ProfilePage";
import { Header } from "./components/layout/Header";
import { LoadingSpinner } from "./components/layout/LoadingSpinner";
import { useAuth } from "./hooks/useAuth";
import { useNavigation } from "./hooks/useNavigation";
import { authService } from "./services/auth";
import { logger } from "./utils/logger";
import "./styles/main.css";

const App: React.FC = () => {
  const {
    user,
    loading: authLoading,
    error: authError,
    login,
    register,
    logout,
    clearError,
    initializeFromStorage,
    initiateOAuth,
  } = useAuth();

  const { currentRoute, navigateTo, forceRedirect } = useNavigation();
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize app once
  useEffect(() => {
    const initializeApp = async () => {
      try {
        logger.info("App initializing");

        // Check for OAuth callback first
        if (authService.isOAuthCallback()) {
          try {
            const oauthResult = await authService.processOAuthSuccess();
            if (oauthResult?.success && oauthResult.data) {
              logger.info("OAuth success, redirecting to game");
              setTimeout(() => forceRedirect("game"), 100);
            } else {
              logger.error("OAuth failed, redirecting to login");
              setTimeout(() => forceRedirect("login"), 100);
            }
          } catch (error) {
            logger.error("OAuth processing failed", { error });
            setTimeout(() => forceRedirect("login"), 100);
          }
        } else {
          // Normal initialization - check existing auth
          initializeFromStorage();

          // FIXED: If not authenticated and no specific route, default to login
          if (!authService.isAuthenticated() && currentRoute.page === "game") {
            logger.info("Not authenticated, defaulting to login page");
            forceRedirect("login");
          }
        }
      } catch (error) {
        logger.error("App initialization failed", { error });
        // On error, default to login page
        forceRedirect("login");
      } finally {
        setIsInitialized(true);
      }
    };

    if (!isInitialized) {
      initializeApp();
    }
  }, [isInitialized, initializeFromStorage, forceRedirect, currentRoute.page]);

  // Handle authentication-based routing
  useEffect(() => {
    if (!isInitialized || authLoading) return;

    const isAuthenticated = !!user;

    // FIXED: Always redirect unauthenticated users to login
    if (
      !isAuthenticated &&
      (currentRoute.page === "profile" || currentRoute.page === "game")
    ) {
      logger.warn("Authentication required - redirecting to login");
      forceRedirect("login");
      return;
    }

    // Redirect authenticated users from auth pages to game
    if (
      isAuthenticated &&
      (currentRoute.page === "login" || currentRoute.page === "register")
    ) {
      logger.info("User authenticated - redirecting to game");
      forceRedirect("game");
      return;
    }
  }, [user, currentRoute.page, isInitialized, authLoading, forceRedirect]);

  // Event handlers
  const handleAuthSuccess = useCallback(() => {
    clearError();
    navigateTo("game");
  }, [clearError, navigateTo]);

  const handleLogout = useCallback(async () => {
    await logout();
    // FIXED: Always redirect to login after logout
    forceRedirect("login");
  }, [logout, forceRedirect]);

  const handleModeChange = useCallback(
    (mode: "login" | "register") => {
      clearError();
      navigateTo(mode);
    },
    [clearError, navigateTo]
  );

  const handleNavigate = useCallback(
    (page: "game" | "login" | "register" | "profile") => {
      // FIXED: Check authentication for all protected pages
      if ((page === "profile" || page === "game") && !user) {
        logger.warn("Authentication required for protected page");
        forceRedirect("login");
        return;
      }
      navigateTo(page);
    },
    [user, navigateTo, forceRedirect]
  );

  // Show loading during initialization
  if (!isInitialized) {
    return (
      <div className="app">
        <div className="app-loading">
          <LoadingSpinner size="large" message="Starting Wordle..." />
        </div>
      </div>
    );
  }

  // FIXED: Default to login page if no valid route or not authenticated
  const shouldShowAuth =
    currentRoute.page === "login" ||
    currentRoute.page === "register" ||
    (!user &&
      (currentRoute.page === "game" || currentRoute.page === "profile"));

  return (
    <div className="app">
      <Header
        isAuthenticated={!!user}
        user={user}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        currentPage={currentRoute.page}
      />

      <main className="app-main">
        {authLoading && (
          <div className="app-loading">
            <LoadingSpinner size="large" message="Loading..." />
          </div>
        )}

        {!authLoading && (
          <>
            {shouldShowAuth && (
              <AuthPage
                mode={currentRoute.page === "register" ? "register" : "login"}
                onSuccess={handleAuthSuccess}
                onLogin={login}
                onRegister={register}
                onModeChange={handleModeChange}
                onOAuthLogin={initiateOAuth}
                loading={authLoading}
                error={authError}
              />
            )}

            {currentRoute.page === "profile" && user && (
              <ProfilePage
                user={user}
                selectedAlbumId={currentRoute.albumId}
                onNavigate={handleNavigate}
              />
            )}

            {currentRoute.page === "game" && user && (
              <GamePage
                gameId={currentRoute.gameId}
                onGameComplete={() => logger.info("Game completed")}
                onSessionUpdate={() => {}}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
*/
