// hooks/useNavigation.ts - Simple navigation with browser history support
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
