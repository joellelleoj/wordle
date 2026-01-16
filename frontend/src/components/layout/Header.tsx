import { memo, useCallback } from "react";
import { HeaderProps } from "../../types/nav";
import { Button } from "./Button";
import "./Header.css";

/**
 * Header Component
 *
 * Main navigation header for the Wordle application.
 * Provides authentication-aware navigation with consistent button components.
 * - Unauthenticated: Shows only title and login prompt
 * - Authenticated: Shows Game/Profile navigation and user greeting
 *
 */
const Header = memo<HeaderProps>(
  ({ isAuthenticated, user, onLogout, onNavigate, currentPage }) => {
    const handleTitleClick = useCallback(() => {
      if (isAuthenticated) {
        onNavigate("game");
      } else {
        onNavigate("login");
      }
    }, [isAuthenticated, onNavigate]);

    const handleLogoutClick = useCallback(async () => {
      try {
        await onLogout();
      } catch (error) {
        console.error("Logout failed:", error);
        window.location.reload();
      }
    }, [onLogout]);

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleTitleClick();
        }
      },
      [handleTitleClick]
    );

    return (
      <header className="header" role="banner">
        <div className="header-content">
          <h1
            className="wordle-title"
            onClick={handleTitleClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`WORDLE - Go to ${isAuthenticated ? "game" : "login"}`}
          >
            WORDLE
          </h1>

          <nav
            className="nav-buttons"
            role="navigation"
            aria-label="Main navigation"
          >
            {isAuthenticated && (
              <>
                <Button
                  variant={currentPage === "game" ? "primary" : "secondary"}
                  onClick={() => onNavigate("game")}
                  disabled={currentPage === "game"}
                  className="nav-button"
                  aria-current={currentPage === "game" ? "page" : undefined}
                >
                  Game
                </Button>

                <Button
                  variant={currentPage === "profile" ? "primary" : "secondary"}
                  onClick={() => onNavigate("profile")}
                  disabled={currentPage === "profile"}
                  className="nav-button"
                  aria-current={currentPage === "profile" ? "page" : undefined}
                >
                  Profile
                </Button>

                <Button
                  variant="danger"
                  onClick={handleLogoutClick}
                  className="logout-button"
                  aria-label="Log out of your account"
                >
                  Logout
                </Button>
              </>
            )}
          </nav>

          <div className="user-status" role="status" aria-live="polite">
            {isAuthenticated && user ? (
              <span className="user-greeting">Hello, {user.username}</span>
            ) : (
              <span className="login-prompt">Please log in to play</span>
            )}
          </div>
        </div>
      </header>
    );
  }
);

Header.displayName = "Header";

export { Header };
