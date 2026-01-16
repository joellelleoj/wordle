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