// App.tsx - Fixed authentication flow and routing issues
import React, { useState, useEffect } from "react";
import { GamePage } from "./pages/GamePage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { Header } from "./components/layout/Header";
import { authService, User } from "./services/auth";
import { gameSessionService, GameSessionData } from "./services/gameSession";
import { routerService, Page, RouteState } from "./services/router";
import "./App.css";

function App(): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentRoute, setCurrentRoute] = useState<RouteState>({
    page: "login",
  });
  const [error, setError] = useState<string | null>(null);
  const [gameSession, setGameSession] = useState<GameSessionData | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize app - SIMPLIFIED
  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);

      try {
        console.log("🚀 Initializing application...");

        // Set up authentication checker for router service
        routerService.setAuthenticationChecker(() => {
          return authService.isAuthenticated();
        });

        // Check for OAuth callback first
        const oauthHandled = await handleOAuthCallback();
        if (oauthHandled) {
          setIsInitialized(true);
          setIsLoading(false);
          return;
        }

        // Check existing authentication
        const currentUser = authService.getCurrentUser();
        const isAuthenticated = authService.isAuthenticated();

        console.log("🔐 Authentication check:", {
          hasUser: !!currentUser,
          isAuthenticated,
          username: currentUser?.username,
        });

        if (currentUser && isAuthenticated) {
          setUser(currentUser);
          console.log("✅ User authenticated:", currentUser.username);

          // Load game session for authenticated user
          await loadGameSession(currentUser);

          // Set initial route based on current URL or default to game
          const initialRoute = routerService.getCurrentRoute();
          setCurrentRoute({ ...initialRoute, isAuthenticated: true });
        } else {
          // User not authenticated - get current route but don't force redirect
          console.log("❌ User not authenticated");
          const initialRoute = routerService.getCurrentRoute();

          // Only redirect to login if explicitly trying to access protected content
          if (initialRoute.page === "profile") {
            routerService.navigateTo("login", { replace: true });
            setCurrentRoute({ page: "login", isAuthenticated: false });
          } else {
            setCurrentRoute({ ...initialRoute, isAuthenticated: false });
          }
        }
      } catch (error) {
        console.error("Error during app initialization:", error);
        setError("Failed to initialize application");
        const initialRoute = routerService.getCurrentRoute();
        setCurrentRoute({ ...initialRoute, isAuthenticated: false });
      } finally {
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    if (!isInitialized) {
      initializeApp();
    }
  }, [isInitialized]);

  // Subscribe to route changes - SIMPLIFIED
  useEffect(() => {
    if (!isInitialized) return;

    const unsubscribeRouter = routerService.subscribe((route) => {
      console.log("🔄 Route changed:", route);
      setCurrentRoute(route);
    });

    return () => {
      unsubscribeRouter();
    };
  }, [isInitialized]);

  // Load game session - IMPROVED
  const loadGameSession = async (currentUser: User | null) => {
    if (!currentUser) return;

    try {
      const savedSession = gameSessionService.loadGameSession(currentUser.id);

      if (savedSession) {
        // Validate session ownership
        if (savedSession.userId && savedSession.userId !== currentUser.id) {
          console.log("⚠️ Session belongs to different user, clearing...");
          gameSessionService.clearGameSession();
          setGameSession(null);
        } else {
          // Update session with current user if needed
          if (!savedSession.userId) {
            const updatedSession = {
              ...savedSession,
              userId: currentUser.id,
              timestamp: new Date().toISOString(),
            };
            gameSessionService.saveGameSession(updatedSession);
            setGameSession(updatedSession);
          } else {
            setGameSession(savedSession);
          }
          console.log("✅ Game session restored:", savedSession.gameId);
        }
      } else {
        setGameSession(null);
        console.log("ℹ️ No game session found - will create new game");
      }
    } catch (error) {
      console.error("Failed to load game session:", error);
      setGameSession(null);
    }
  };

  // Handle OAuth callback - IMPROVED
  const handleOAuthCallback = async (): Promise<boolean> => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthData = urlParams.get("data");
    const oauthError = urlParams.get("error");

    if (oauthError) {
      console.error("OAuth error:", oauthError);
      setError(`OAuth login failed: ${oauthError}`);
      routerService.navigateTo("login", { replace: true });
      window.history.replaceState({}, document.title, "/");
      return true;
    }

    if (oauthData) {
      try {
        console.log("🔄 Processing OAuth callback...");
        const authData = JSON.parse(decodeURIComponent(oauthData));

        if (authData.success && authData.data) {
          authService.storeTokens(
            authData.data.accessToken,
            authData.data.refreshToken
          );
          authService.storeUser(authData.data.user);

          setUser(authData.data.user);
          window.history.replaceState({}, document.title, "/");
          routerService.navigateTo("game", { replace: true });
          setCurrentRoute({ page: "game", isAuthenticated: true });

          console.log(
            "✅ OAuth login successful:",
            authData.data.user.username
          );
          await loadGameSession(authData.data.user);
          return true;
        } else {
          console.error("OAuth callback failed:", authData.message);
          setError("OAuth login failed. Please try again.");
          routerService.navigateTo("login", { replace: true });
          window.history.replaceState({}, document.title, "/");
          return true;
        }
      } catch (parseError) {
        console.error("OAuth data parsing error:", parseError);
        setError("OAuth login failed. Please try again.");
        routerService.navigateTo("login", { replace: true });
        window.history.replaceState({}, document.title, "/");
        return true;
      }
    }

    return false;
  };

  // Navigation handler - LESS RESTRICTIVE
  const navigateTo = (
    page: Page,
    options?: { gameId?: string; albumId?: string }
  ) => {
    // Only block profile access if not authenticated
    if (page === "profile" && !user) {
      console.log("❌ Profile requires authentication");
      setError("Please log in to access your profile");
      routerService.navigateTo("login", { replace: true });
      return;
    }

    // Allow other navigation freely
    setError(null);
    routerService.navigateTo(page, options);
  };

  // Login handler - IMPROVED
  const handleLogin = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("🔐 Attempting login for:", username);
      const result = await authService.login({ username, password });

      if (result.success && result.data) {
        setUser(result.data.user);
        console.log("✅ Login successful for user:", result.data.user.username);

        await loadGameSession(result.data.user);
        navigateTo("game");
        return { success: true };
      } else {
        setError(result.message || "Login failed");
        return { success: false, message: result.message || "Login failed" };
      }
    } catch (error) {
      const errorMessage = "Network error. Please try again.";
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Registration handler - IMPROVED
  const handleRegister = async (
    email: string,
    username: string,
    password: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("📝 Attempting registration for:", username);
      const result = await authService.register({ username, email, password });

      if (result.success && result.data) {
        setUser(result.data.user);
        console.log(
          "✅ Registration successful for user:",
          result.data.user.username
        );

        await loadGameSession(result.data.user);
        navigateTo("game");
        return { success: true };
      } else {
        setError(result.message || "Registration failed");
        return {
          success: false,
          message: result.message || "Registration failed",
        };
      }
    } catch (error) {
      const errorMessage = "Network error. Please try again.";
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Logout handler - IMPROVED
  const handleLogout = async () => {
    try {
      console.log("🚪 Logging out user...");

      // Clear session data
      if (user?.id) {
        gameSessionService.clearUserSessions(user.id);
      }
      gameSessionService.clearGameSession();
      setGameSession(null);

      // Logout from service
      await authService.logout();
      setUser(null);

      // Navigate to login
      routerService.forceRedirect("login");
      setCurrentRoute({ page: "login", isAuthenticated: false });

      console.log("✅ User logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      // Even if logout fails on server, clear local state
      if (user?.id) {
        gameSessionService.clearUserSessions(user.id);
      }
      gameSessionService.clearGameSession();
      setGameSession(null);
      setUser(null);
      routerService.forceRedirect("login");
      setCurrentRoute({ page: "login", isAuthenticated: false });
    }
  };

  // Game session handlers - IMPROVED
  const handleGameSessionUpdate = (sessionData: GameSessionData) => {
    if (!user) {
      console.warn("Cannot update game session - user not authenticated");
      return;
    }

    const updatedSession = {
      ...sessionData,
      userId: user.id,
      timestamp: new Date().toISOString(),
    };

    gameSessionService.saveGameSession(updatedSession);
    setGameSession(updatedSession);

    if (currentRoute.page === "game") {
      routerService.updateGameId(sessionData.gameId);
    }
  };

  const handleGameComplete = (_gameData: any) => {
    gameSessionService.clearGameSession();
    setGameSession(null);
  };

  // Render page - SIMPLIFIED LOGIC
  const renderPage = () => {
    switch (currentRoute.page) {
      case "login":
        return (
          <LoginPage
            onLogin={handleLogin}
            onNavigate={navigateTo}
            isRegister={false}
            error={error}
          />
        );

      case "register":
        return (
          <LoginPage
            onLogin={handleLogin}
            onRegister={handleRegister}
            onNavigate={navigateTo}
            isRegister={true}
            error={error}
          />
        );

      case "profile":
        // Show profile page but handle auth within the component
        return (
          <ProfilePage
            user={user}
            selectedAlbumId={currentRoute.albumId}
            onNavigate={navigateTo}
          />
        );

      case "game":
      default:
        // Always show game page, but it will handle auth requirements internally
        return (
          <GamePage
            initialGameSession={gameSession}
            onGameSessionUpdate={handleGameSessionUpdate}
            onGameComplete={handleGameComplete}
            gameId={currentRoute.gameId}
            isSessionLoaded={true}
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <div>Loading application...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        isAuthenticated={!!user}
        user={user}
        onLogout={handleLogout}
        onNavigate={navigateTo}
        currentPage={currentRoute.page}
      />
      <main>
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)} className="close-error">
              ×
            </button>
          </div>
        )}
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
// frontend/src/App.tsx - Fixed OAuth handling
/*import React, { useState, useEffect } from "react";
import { GamePage } from "./pages/GamePage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { Header } from "./components/layout/Header";
import { authService, User } from "./services/auth";

import "./App.css";

export type Page = "game" | "login" | "register" | "profile";

function App(): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>("game");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);

      try {
        // Check if we're returning from OAuth success
        const urlParams = new URLSearchParams(window.location.search);
        const oauthData = urlParams.get("data");
        const oauthError = urlParams.get("error");

        if (oauthError) {
          console.error("OAuth error:", oauthError);
          setError(`OAuth login failed: ${oauthError}`);
          setCurrentPage("login");
          // Clean up URL
          window.history.replaceState({}, document.title, "/");
        } else if (oauthData) {
          try {
            const authData = JSON.parse(decodeURIComponent(oauthData));

            if (authData.success && authData.data) {
              // Store the tokens and user data
              authService.storeTokens(
                authData.data.accessToken,
                authData.data.refreshToken
              );
              authService.storeUser(authData.data.user);

              setUser(authData.data.user);
              setCurrentPage("game");
              console.log(
                "OAuth login successful:",
                authData.data.user.username
              );
            } else {
              console.error("OAuth callback failed:", authData.message);
              setError("OAuth login failed. Please try again.");
              setCurrentPage("login");
            }

            // Clean up URL
            window.history.replaceState({}, document.title, "/");
          } catch (parseError) {
            console.error("OAuth data parsing error:", parseError);
            setError("OAuth login failed. Please try again.");
            setCurrentPage("login");
          }
        } else {
          // Check if user is already logged in from previous session
          const currentUser = authService.getCurrentUser();
          if (currentUser && authService.isAuthenticated()) {
            setUser(currentUser);
            console.log("User already authenticated:", currentUser.username);
          }
        }
      } catch (error) {
        console.error("Error during auth initialization:", error);
        setError("Failed to initialize authentication");
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const navigateTo = (page: Page) => {
    setCurrentPage(page);
    setError(null);
  };

  const handleLogin = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authService.login({ username, password });

      if (result.success && result.data) {
        setUser(result.data.user);
        navigateTo("game");
        return { success: true };
      } else {
        setError(result.message || "Login failed");
        return { success: false, message: result.message || "Login failed" };
      }
    } catch (error) {
      const errorMessage = "Network error. Please try again.";
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (
    email: string,
    username: string,
    password: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authService.register({ username, email, password });

      if (result.success && result.data) {
        setUser(result.data.user);
        navigateTo("game");
        return { success: true };
      } else {
        setError(result.message || "Registration failed");
        return {
          success: false,
          message: result.message || "Registration failed",
        };
      }
    } catch (error) {
      const errorMessage = "Network error. Please try again.";
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      setUser(null);
      navigateTo("login");
      console.log("User logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      setUser(null);
      navigateTo("login");
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case "game":
        return <GamePage />;

      case "login":
        return (
          <LoginPage
            onLogin={handleLogin}
            onNavigate={navigateTo}
            isRegister={false}
            error={error}
          />
        );

      case "register":
        return (
          <LoginPage
            onLogin={handleLogin}
            onRegister={handleRegister}
            onNavigate={navigateTo}
            isRegister={true}
            error={error}
          />
        );

      case "profile":
        return <ProfilePage user={user} />;

      default:
        return <GamePage />;
    }
  };

  if (isLoading) {
    return (
      <div className="loading-overlay">
        <div>Loading application...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        isAuthenticated={!!user}
        user={user}
        onLogout={handleLogout}
        onNavigate={navigateTo}
        currentPage={currentPage}
      />
      <main>
        {error && currentPage !== "login" && currentPage !== "register" && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)} className="close-error">
              ×
            </button>
          </div>
        )}
        {renderPage()}
      </main>
    </div>
  );
}

export default App;

// App.tsx - Fixed for browser compatibility
import React, { useState, useEffect } from "react";
import { GamePage } from "./pages/GamePage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { Header } from "./components/layout/Header";
import { authService, User } from "./services/auth";
import "./App.css";

// OAuth configuration - hardcoded for now to avoid process.env issues
const getOAuthConfig = () => {
  // In production, these would come from environment variables at build time
  // For development, use default values
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost"
  ) {
    // Production configuration
    return {
      CLIENT_ID: "your-production-client-id",
      REDIRECT_URI: `${window.location.origin}/oauth/callback`,
      GITLAB_BASE_URL: "https://git.imn.htwk-leipzig.de",
    };
  } else {
    // Development configuration
    return {
      CLIENT_ID: "your-dev-client-id",
      REDIRECT_URI: "http://localhost:3000/oauth/callback",
      GITLAB_BASE_URL: "https://git.imn.htwk-leipzig.de",
    };
  }
};

const oauthConfig = getOAuthConfig();

export type Page = "game" | "login" | "register" | "profile";

function App(): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>("game");
  const [error, setError] = useState<string | null>(null);

  // Initialize authentication on app load
  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);

      try {
        // Check if we're returning from OAuth callback
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");

        if (code && !user) {
          console.log("Processing OAuth callback with code:", code);

          try {
            const result = await authService.handleGitLabCallback(
              code,
              oauthConfig.REDIRECT_URI
            );

            if (result.success && result.data) {
              setUser(result.data.user);
              setCurrentPage("game"); // Redirect to game after successful OAuth login
              console.log("OAuth login successful:", result.data.user.username);

              // Clean up URL
              window.history.replaceState({}, document.title, "/");
            } else {
              console.error("OAuth callback failed:", result.message);
              setError("OAuth login failed. Please try again.");
              setCurrentPage("login");
            }
          } catch (oauthError) {
            console.error("OAuth callback error:", oauthError);
            setError("OAuth login failed. Please try again.");
            setCurrentPage("login");
          }
        } else {
          // Check if user is already logged in from previous session
          const currentUser = authService.getCurrentUser();
          if (currentUser && authService.isAuthenticated()) {
            setUser(currentUser);
            console.log("User already authenticated:", currentUser.username);
          }
        }
      } catch (error) {
        console.error("Error during auth initialization:", error);
        setError("Failed to initialize authentication");
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Navigation handler
  const navigateTo = (page: Page) => {
    setCurrentPage(page);
    setError(null); // Clear any errors when navigating
  };

  // OAuth login handler
  const handleOAuthLogin = () => {
    const authUrl = `${oauthConfig.GITLAB_BASE_URL}/oauth/authorize?client_id=${oauthConfig.CLIENT_ID}&redirect_uri=${oauthConfig.REDIRECT_URI}&response_type=code&scope=read_user`;
    window.location.href = authUrl;
  };

  // Manual login handler (username/password)
  const handleLogin = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authService.login({ username, password });

      if (result.success && result.data) {
        setUser(result.data.user);
        navigateTo("game");
        return { success: true };
      } else {
        setError(result.message || "Login failed");
        return { success: false, error: result.message || "Login failed" };
      }
    } catch (error) {
      const errorMessage = "Network error. Please try again.";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Registration handler
  const handleRegister = async (
    email: string,
    username: string,
    password: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authService.register({ username, email, password });

      if (result.success && result.data) {
        setUser(result.data.user);
        navigateTo("game");
        return { success: true };
      } else {
        setError(result.message || "Registration failed");
        return {
          success: false,
          error: result.message || "Registration failed",
        };
      }
    } catch (error) {
      const errorMessage = "Network error. Please try again.";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Add this to your App.tsx useEffect for OAuth handling

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);

      try {
        // Check if we're returning from OAuth success
        const urlParams = new URLSearchParams(window.location.search);
        const oauthData = urlParams.get("data");

        if (oauthData && window.location.pathname === "/oauth/success") {
          console.log("Processing OAuth success callback");

          try {
            const result = JSON.parse(decodeURIComponent(oauthData));

            if (result.success && result.data) {
              setUser(result.data.user);
              setCurrentPage("game");
              console.log("OAuth login successful:", result.data.user.username);

              // Store tokens
              localStorage.setItem("accessToken", result.data.accessToken);
              localStorage.setItem("refreshToken", result.data.refreshToken);
              localStorage.setItem("user", JSON.stringify(result.data.user));

              // Clean up URL
              window.history.replaceState({}, document.title, "/");
            } else {
              console.error("OAuth callback failed:", result.message);
              setError("OAuth login failed. Please try again.");
              setCurrentPage("login");
            }
          } catch (parseError) {
            console.error("Failed to parse OAuth data:", parseError);
            setError("OAuth login failed. Please try again.");
            setCurrentPage("login");
          }
        }
        // Check for OAuth error in URL params
        else if (urlParams.get("error")) {
          const errorType = urlParams.get("error");
          console.error("OAuth error:", errorType);
          setError(`OAuth login failed: ${errorType}`);
          setCurrentPage("login");

          // Clean up URL
          window.history.replaceState({}, document.title, "/");
        }
        // Check if we're returning from OAuth callback with code
        else if (urlParams.get("code") && !user) {
          console.log(
            "Processing OAuth callback with code:",
            urlParams.get("code")
          );

          try {
            const result = await authService.handleGitLabCallback(
              urlParams.get("code")!,
              oauthConfig.REDIRECT_URI
            );

            if (result.success && result.data) {
              setUser(result.data.user);
              setCurrentPage("game");
              console.log("OAuth login successful:", result.data.user.username);

              // Clean up URL
              window.history.replaceState({}, document.title, "/");
            } else {
              console.error("OAuth callback failed:", result.message);
              setError("OAuth login failed. Please try again.");
              setCurrentPage("login");
            }
          } catch (oauthError) {
            console.error("OAuth callback error:", oauthError);
            setError("OAuth login failed. Please try again.");
            setCurrentPage("login");
          }
        } else {
          // Check if user is already logged in from previous session
          const currentUser = authService.getCurrentUser();
          if (currentUser && authService.isAuthenticated()) {
            setUser(currentUser);
            console.log("User already authenticated:", currentUser.username);
          }
        }
      } catch (error) {
        console.error("Error during auth initialization:", error);
        setError("Failed to initialize authentication");
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Logout handler
  const handleLogout = async () => {
    try {
      await authService.logout();
      setUser(null);
      navigateTo("login");
      console.log("User logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      // Even if logout fails on server, clear local state
      setUser(null);
      navigateTo("login");
    }
  };

  // Render page content based on current page
  const renderPage = () => {
    switch (currentPage) {
      case "game":
        return <GamePage />;

      case "login":
        return (
          <LoginPage
            onLogin={handleLogin}
            onNavigate={navigateTo}
            onOAuthLogin={handleOAuthLogin}
            isRegister={false}
            error={error}
          />
        );

      case "register":
        return (
          <LoginPage
            onLogin={handleLogin}
            onRegister={handleRegister}
            onNavigate={navigateTo}
            onOAuthLogin={handleOAuthLogin}
            isRegister={true}
            error={error}
          />
        );

      case "profile":
        return <ProfilePage />;

      default:
        return <GamePage />;
    }
  };

  // Show loading screen during initialization
  if (isLoading) {
    return (
      <div className="loading-overlay">
        <div>Loading application...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        isAuthenticated={!!user}
        user={user}
        onLogout={handleLogout}
        onNavigate={navigateTo}
        currentPage={currentPage}
      />
      <main>
        {error && currentPage !== "login" && currentPage !== "register" && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)} className="close-error">
              ×
            </button>
          </div>
        )}
        {renderPage()}
      </main>
    </div>
  );
}

export default App;

/*import { JSX } from "react";
import { GamePage } from "./pages/GamePage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { Header } from "./components/layout/Header";
import { useAuth } from "./hooks/useAuth";
import { useNavigation } from "./hooks/useNavigation";
import "./App.css";


function App(): JSX.Element {
  const { user, isAuthenticated, isLoading, login, register, logout } =
    useAuth();
  const { currentPage, navigateTo } = useNavigation();

  const handleLogin = async (email: string, password: string) => {
    const result = await login(email, password);
    if (result.success) {
      navigateTo("game");
    }
    return result;
  };

  const handleRegister = async (
    email: string,
    username: string,
    password: string
  ) => {
    const result = await register(email, username, password);
    if (result.success) {
      navigateTo("game");
    }
    return result;
  };

  const handleLogout = () => {
    logout();
    navigateTo("login");
  };

  const renderPage = () => {
    switch (currentPage) {
      case "game":
        return <GamePage />;
      case "login":
        return (
          <LoginPage
            onLogin={handleLogin}
            onNavigate={navigateTo}
            isRegister={false}
          />
        );
      case "register":
        return (
          <LoginPage
            onLogin={handleLogin}
            onRegister={handleRegister}
            onNavigate={navigateTo}
            isRegister={true}
          />
        );
      case "profile":
        return <ProfilePage />;
      default:
        return <GamePage />;
    }
  };

  if (isLoading) {
    return <div className="loading-overlay">Loading application...</div>;
  }

  return (
    <div className="app">
      <Header
        isAuthenticated={isAuthenticated}
        user={user}
        onLogout={handleLogout}
        onNavigate={navigateTo}
        currentPage={currentPage}
      />
      <main>{renderPage()}</main>
    </div>
  );
}

export default App;*/

/*import React, { useState, useEffect, useCallback } from "react";
import { Board } from "./components/Board";
import { Keyboard } from "./components/Keyboard";
import { gameApi } from "./services/api";
import "./App.css";

function App() {
  const [gameId, setGameId] = useState<string>("");
  const [board, setBoard] = useState<string[][]>(
    Array(6)
      .fill(null)
      .map(() => Array(5).fill(""))
  );
  const [evaluations, setEvaluations] = useState<any[][]>(
    Array(6)
      .fill(null)
      .map(() => Array(5).fill(null))
  );
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [usedLetters, setUsedLetters] = useState(new Map());

  const [shakingRow, setShakingRow] = useState<number | null>(null);
  const [poppingTile, setPoppingTile] = useState<{
    row: number;
    col: number;
  } | null>(null);

  // Initialize game
  useEffect(() => {
    startNewGame();
  }, []);

  const startNewGame = async () => {
    try {
      const { gameId } = await gameApi.createGame();
      setGameId(gameId);
      setBoard(
        Array(6)
          .fill(null)
          .map(() => Array(5).fill(""))
      );
      setEvaluations(
        Array(6)
          .fill(null)
          .map(() => Array(5).fill(null))
      );
      setCurrentRow(0);
      setCurrentCol(0);
      setGameOver(false);
      setUsedLetters(new Map());
    } catch (error) {
      console.error("Failed to start game:", error);
    }
  };

  const handleKey = useCallback(
    async (key: string) => {
      if (gameOver) return;

      if (key === "ENTER") {
        if (currentCol === 5) {
          const guess = board[currentRow].join("");
          try {
            const response = await gameApi.submitGuess(gameId, guess);

            if (!response.valid) {
              setShakingRow(currentRow);
              setTimeout(() => setShakingRow(null), 600);
              return;
            }

            // Update evaluations
            const newEvaluations = [...evaluations];
            newEvaluations[currentRow] = response.result!;
            setEvaluations(newEvaluations);

            // Update used letters
            const newUsedLetters = new Map(usedLetters);
            board[currentRow].forEach((letter, i) => {
              const current = newUsedLetters.get(letter);
              const newStatus = response.result![i];
              if (
                !current ||
                (current === "absent" && newStatus !== "absent") ||
                (current === "present" && newStatus === "correct")
              ) {
                newUsedLetters.set(letter, newStatus);
              }
            });
            setUsedLetters(newUsedLetters);

            if (response.gameOver) {
              setGameOver(true);
              if (!response.won && response.solution) {
                setTimeout(
                  () => alert(`The word was: ${response.solution}`),
                  500
                );
              }
            } else {
              setCurrentRow(currentRow + 1);
              setCurrentCol(0);
            }
          } catch (error) {
            console.error("Failed to submit guess:", error);
          }
        }
      } else if (key === "BACKSPACE") {
        if (currentCol > 0) {
          const newBoard = [...board];
          newBoard[currentRow][currentCol - 1] = "";
          setBoard(newBoard);
          setCurrentCol(currentCol - 1);
        }
      } else if (/^[A-Z]$/.test(key)) {
        if (currentCol < 5) {
          const newBoard = [...board];
          newBoard[currentRow][currentCol] = key;
          setBoard(newBoard);
          setPoppingTile({ row: currentRow, col: currentCol });
          setTimeout(() => setPoppingTile(null), 100);

          setCurrentCol(currentCol + 1);
        }
      }
    },
    [gameId, board, currentRow, currentCol, gameOver, evaluations, usedLetters]
  );

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      if (key === "ENTER" || key === "BACKSPACE") {
        handleKey(key);
      } else if (/^[A-Z]$/.test(key)) {
        handleKey(key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKey]);

  return (
    <div className="app">
      <header>
        <h1>WORDLE</h1>
      </header>
      <main>
        <Board
          board={board}
          evaluations={evaluations}
          shakingRow={shakingRow}
          poppingTile={poppingTile}
          currentRow={currentRow}
        />
        <Keyboard onKeyPress={handleKey} usedLetters={usedLetters} />
        {gameOver && (
          <button onClick={startNewGame} className="new-game">
            New Game
          </button>
        )}
      </main>
    </div>
  );
}

export default App;
*/
