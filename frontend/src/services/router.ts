import { Page, RouteState } from "../types/game";

class RouterService {
  private currentRoute: RouteState = { page: "game" };
  private listeners: ((route: RouteState) => void)[] = [];
  private lastHistoryUpdate: number = 0;
  private readonly HISTORY_THROTTLE_MS = 500; // Reduced throttling
  private authenticationChecker: (() => boolean) | null = null;

  constructor() {
    // Listen for browser navigation events (back/forward)
    window.addEventListener("popstate", this.handlePopState);
    window.addEventListener("beforeunload", this.handleBeforeUnload);

    // Set initial route from URL
    this.initializeFromURL();
  }

  // Set authentication checker function
  setAuthenticationChecker(checker: () => boolean): void {
    this.authenticationChecker = checker;
  }

  // Check if user is authenticated
  private isAuthenticated(): boolean {
    return this.authenticationChecker?.() || false;
  }

  // Initialize route from current URL
  private initializeFromURL(): void {
    const path = window.location.pathname;
    const search = window.location.search;

    this.currentRoute = this.parseURL(path, search);
    console.log("🔄 Router initialized to:", this.currentRoute.page);
  }

  // Parse URL to route state with REDUCED security checks
  private parseURL(path: string, search: string): RouteState {
    const params = new URLSearchParams(search);
    const isAuth = this.isAuthenticated();

    // Handle different paths
    if (path.endsWith("/login") || path.includes("login")) {
      return { page: "login", isAuthenticated: isAuth };
    }

    if (path.endsWith("/register") || path.includes("register")) {
      return { page: "register", isAuthenticated: isAuth };
    }

    if (path.endsWith("/profile") || path.includes("profile")) {
      // RELAXED: Allow profile page access, but show login prompt if not authenticated
      return {
        page: "profile",
        albumId: params.get("album") || undefined,
        isAuthenticated: isAuth,
      };
    }

    // Default to game page (public access)
    return {
      page: "game",
      gameId: params.get("gameId") || undefined,
      isAuthenticated: isAuth,
    };
  }

  // Convert route state to URL
  private buildURL(route: RouteState): string {
    const baseURL = window.location.origin;

    switch (route.page) {
      case "login":
        return `${baseURL}/login`;

      case "register":
        return `${baseURL}/register`;

      case "profile":
        const profileURL = `${baseURL}/profile`;
        if (route.albumId) {
          return `${profileURL}?album=${route.albumId}`;
        }
        return profileURL;

      case "game":
      default:
        const gameURL = `${baseURL}/game`;
        if (route.gameId) {
          return `${gameURL}?gameId=${route.gameId}`;
        }
        return gameURL;
    }
  }

  // Handle browser back/forward navigation with RELAXED security
  private handlePopState = (event: PopStateEvent): void => {
    console.log("🔄 Browser navigation detected");

    let targetRoute: RouteState;

    if (event.state && event.state.route) {
      targetRoute = event.state.route;
    } else {
      // Fallback: parse URL
      targetRoute = this.parseURL(
        window.location.pathname,
        window.location.search
      );
    }

    // RELAXED: Apply minimal security checks
    const secureRoute = this.applyMinimalSecurity(targetRoute);

    if (secureRoute.page !== targetRoute.page) {
      // Route was modified, update history
      console.log("🔄 Route modified for security:", secureRoute.page);
      const secureURL = this.buildURL(secureRoute);
      try {
        window.history.replaceState(
          { route: secureRoute, timestamp: Date.now() },
          "",
          secureURL
        );
      } catch (error) {
        console.warn("History API error:", error);
      }
    }

    this.currentRoute = secureRoute;
    this.notifyListeners();
  };

  // MINIMAL security enforcement - only block if absolutely necessary
  private applyMinimalSecurity(route: RouteState): RouteState {
    const isAuth = this.isAuthenticated();

    // ONLY redirect to login if:
    // 1. User is trying to access auth pages while authenticated
    if (isAuth && (route.page === "login" || route.page === "register")) {
      console.log("🔄 Already authenticated, redirecting to game");
      return {
        page: "game",
        isAuthenticated: true,
      };
    }

    // Otherwise, allow access but update auth state
    return {
      ...route,
      isAuthenticated: isAuth,
    };
  }

  // Handle page unload
  private handleBeforeUnload = (): void => {
    // Minimal cleanup - don't clear auth data
  };

  // Navigate to a new route with RELAXED security checks
  navigateTo(
    page: Page,
    options?: {
      gameId?: string;
      albumId?: string;
      replace?: boolean;
    }
  ): void {
    const newRoute: RouteState = {
      page,
      gameId: options?.gameId,
      albumId: options?.albumId,
      isAuthenticated: this.isAuthenticated(),
    };

    // Apply minimal security checks
    const secureRoute = this.applyMinimalSecurity(newRoute);

    if (secureRoute.page !== page) {
      console.log(`🔄 Navigation to ${page} redirected to ${secureRoute.page}`);
    }

    this.currentRoute = secureRoute;

    const url = this.buildURL(secureRoute);
    const state = { route: secureRoute, timestamp: Date.now() };

    try {
      if (options?.replace) {
        // Replace current history entry
        window.history.replaceState(state, "", url);
      } else {
        // Add new history entry
        window.history.pushState(state, "", url);
      }

      console.log("🔄 Navigated to:", secureRoute.page, url);
    } catch (error) {
      console.warn("Navigation error:", error);
      // Fallback to direct URL change
      window.location.href = url;
    }

    this.notifyListeners();
  }

  // Get current route
  getCurrentRoute(): RouteState {
    return { ...this.currentRoute };
  }

  // Subscribe to route changes
  subscribe(listener: (route: RouteState) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners of route change
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentRoute);
      } catch (error) {
        console.error("Router listener error:", error);
      }
    });
  }

  // Update current game ID without navigation (with reduced throttling)
  updateGameId(gameId: string): void {
    if (this.currentRoute.page === "game") {
      const now = Date.now();

      // Reduced throttle timing
      if (now - this.lastHistoryUpdate < this.HISTORY_THROTTLE_MS) {
        return;
      }

      this.currentRoute.gameId = gameId;
      const url = this.buildURL(this.currentRoute);
      const state = { route: this.currentRoute, timestamp: now };

      try {
        window.history.replaceState(state, "", url);
        this.lastHistoryUpdate = now;
      } catch (error) {
        console.warn("History API update error:", error);
      }
    }
  }

  // Clear sensitive route data (called on logout) - MINIMAL clearing
  clearSensitiveData(): void {
    // Only clear sensitive parameters, not all data
    if (this.currentRoute.albumId) {
      this.currentRoute.albumId = undefined;
    }

    console.log("🧹 Cleared sensitive route data");
  }

  // Force redirect (used after logout) - LESS aggressive
  forceRedirect(targetPage: Page = "login"): void {
    this.clearSensitiveData();

    const redirectRoute: RouteState = {
      page: targetPage,
      isAuthenticated: false,
    };

    this.currentRoute = redirectRoute;
    const url = this.buildURL(redirectRoute);

    try {
      // Use pushState instead of replaceState to allow back navigation
      window.history.pushState(
        { route: redirectRoute, timestamp: Date.now() },
        "",
        url
      );
    } catch (error) {
      console.warn("Force redirect error:", error);
      window.location.href = url;
    }

    this.notifyListeners();
    console.log("🔄 Redirected to:", targetPage);
  }
}

export const routerService = new RouterService();
