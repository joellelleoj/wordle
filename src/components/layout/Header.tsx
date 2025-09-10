import { memo, useCallback } from "react";
import { HeaderProps } from "../../types/nav";
import "./Header.css";

/**
 * Header Component
 *
 * Main navigation header for the Wordle application.
 * Authentication-based button visibility
 * - Unauthenticated: Shows only title and login prompt
 * - Authenticated: Shows Game/Profile navigation and user greeting
 *
 * @component
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

    return (
      <header className="header">
        <div className="header-content">
          <h1
            className="wordle-title"
            onClick={handleTitleClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handleTitleClick()}
          >
            WORDLE
          </h1>

          <nav className="nav-buttons">
            {isAuthenticated && (
              <>
                <button
                  className={`nav-btn ${
                    currentPage === "game" ? "active" : ""
                  }`}
                  onClick={() => onNavigate("game")}
                  disabled={currentPage === "game"}
                >
                  Game
                </button>
                <button
                  className={`nav-btn ${
                    currentPage === "profile" ? "active" : ""
                  }`}
                  onClick={() => onNavigate("profile")}
                  disabled={currentPage === "profile"}
                >
                  Profile
                </button>
                <button className="logout-btn" onClick={handleLogoutClick}>
                  Logout
                </button>
              </>
            )}
          </nav>

          <div className="user-status">
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
