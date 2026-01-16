// hooks/useNavigation.ts - Navigation logic hook
import { useState, useEffect, useCallback } from "react";
import { Page, RouteState } from "../types";
import { logger } from "../utils/logger";

export function useNavigation() {
  const [currentRoute, setCurrentRoute] = useState<RouteState>({
    page: "game",
  });

  // Initialize from URL on mount
  useEffect(() => {
    const initialRoute = getRouteFromURL();
    setCurrentRoute(initialRoute);

    const handlePopState = (event: PopStateEvent) => {
      const route = event.state?.route || getRouteFromURL();
      setCurrentRoute(route);
      logger.debug("Navigation via browser history", { route });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = useCallback(
    (
      page: Page,
      options?: { gameId?: string; albumId?: string; replace?: boolean }
    ) => {
      const newRoute: RouteState = {
        page,
        gameId: options?.gameId,
        albumId: options?.albumId,
      };

      setCurrentRoute(newRoute);

      const url = getURLForRoute(newRoute);

      if (options?.replace) {
        window.history.replaceState({ route: newRoute }, "", url);
      } else {
        window.history.pushState({ route: newRoute }, "", url);
      }

      logger.debug("Navigation", {
        from: currentRoute.page,
        to: page,
        options,
      });
    },
    [currentRoute.page]
  );

  const forceRedirect = useCallback(
    (page: Page) => {
      navigateTo(page, { replace: true });
    },
    [navigateTo]
  );

  return {
    currentRoute,
    navigateTo,
    forceRedirect,
  };
}

// Helper functions for URL handling
function getRouteFromURL(): RouteState {
  const hash = window.location.hash.slice(1); // Remove #
  const path = window.location.pathname;

  // Support both hash routing and path routing
  const route = hash || path.split("/").filter(Boolean).pop() || "";

  const urlParams = new URLSearchParams(window.location.search);

  let page: Page;
  switch (route) {
    case "login":
      page = "login";
      break;
    case "register":
      page = "register";
      break;
    case "profile":
      page = "profile";
      break;
    case "game":
    case "":
    default:
      page = "game";
      break;
  }

  return {
    page,
    gameId: urlParams.get("gameId") || undefined,
    albumId: urlParams.get("albumId") || undefined,
  };
}

function getURLForRoute(route: RouteState): string {
  const params = new URLSearchParams();

  if (route.gameId) params.set("gameId", route.gameId);
  if (route.albumId) params.set("albumId", route.albumId);

  const queryString = params.toString();
  const baseURL = `#${route.page}`;

  return queryString ? `${baseURL}?${queryString}` : baseURL;
}
/*// hooks/useNavigation.ts - Simple navigation with browser history support
import { useState, useEffect } from "react";

export type Page = "game" | "login" | "register" | "profile";

interface NavigationState {
  currentPage: Page;
  navigateTo: (page: Page) => void;
}

export function useNavigation(): NavigationState {
  const [currentPage, setCurrentPage] = useState<Page>("game");

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const page = (event.state?.page as Page) || "game";
      setCurrentPage(page);
    };

    // Set initial state
    const initialPage = getPageFromURL();
    setCurrentPage(initialPage);
    window.history.replaceState(
      { page: initialPage },
      "",
      getURLForPage(initialPage)
    );

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (page: Page) => {
    if (page === currentPage) return;

    setCurrentPage(page);
    window.history.pushState({ page }, "", getURLForPage(page));
  };

  return { currentPage, navigateTo };
}

// Helper functions for URL mapping
function getPageFromURL(): Page {
  const path = window.location.pathname;
  const hash = window.location.hash.slice(1); // Remove #

  // Support both hash routing and path routing
  const route = hash || path.split("/").pop() || "";

  switch (route) {
    case "login":
      return "login";
    case "register":
      return "register";
    case "profile":
      return "profile";
    case "game":
    case "":
    default:
      return "game";
  }
}

function getURLForPage(page: Page): string {
  // Use hash routing to avoid server routing issues
  switch (page) {
    case "login":
      return "#login";
    case "register":
      return "#register";
    case "profile":
      return "#profile";
    case "game":
    default:
      return "#game";
  }
}

/*import { useState } from "react";

export type Page = "game" | "login" | "register" | "profile";

*
 * Navigation Hook
 * Manages current page state in a centralized way
 
export const useNavigation = () => {
  const [currentPage, setCurrentPage] = useState<Page>("game");

  const navigateTo = (page: Page) => {
    setCurrentPage(page);
  };

  return {
    currentPage,
    navigateTo,
  };
};
*/
