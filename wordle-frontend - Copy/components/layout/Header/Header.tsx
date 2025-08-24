import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { Button } from "../../ui/Button/Button";
import styles from "./Header.module.css";

interface HeaderProps {
  onShowStats?: () => void;
  onShowRules?: () => void;
  onNewGame?: () => void;
  canStartNewGame?: boolean;
  isLoading?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onShowStats,
  onShowRules,
  onNewGame,
  canStartNewGame,
  isLoading,
}) => {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.left}>
          <Link to="/" className={styles.logo}>
            <span className={styles.logoText}>Wordle</span>
          </Link>
        </div>

        <nav className={styles.nav}>
          {isAuthenticated && (
            <>
              <Link to="/statistics" className={styles.navLink}>
                Statistics
              </Link>
              <Link to="/search" className={styles.navLink}>
                Search
              </Link>
              <Link to="/profile" className={styles.navLink}>
                Profile
              </Link>
            </>
          )}
        </nav>

        <div className={styles.right}>
          <div className={styles.actions}>
            {onShowRules && (
              <Button
                variant="ghost"
                size="small"
                onClick={onShowRules}
                aria-label="Show rules"
              >
                ?
              </Button>
            )}

            {onShowStats && isAuthenticated && (
              <Button
                variant="ghost"
                size="small"
                onClick={onShowStats}
                aria-label="Show statistics"
              >
                📊
              </Button>
            )}

            {onNewGame && canStartNewGame && (
              <Button
                variant="outline"
                size="small"
                onClick={onNewGame}
                disabled={isLoading}
                aria-label="Start new game"
              >
                New Game
              </Button>
            )}

            <Button
              variant="ghost"
              size="small"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </Button>

            {isAuthenticated ? (
              <div className={styles.userMenu}>
                <span className={styles.username}>
                  {user?.displayName || user?.username}
                </span>
                <Button variant="ghost" size="small" onClick={logout}>
                  Logout
                </Button>
              </div>
            ) : (
              <div className={styles.authButtons}>
                <Link to="/login">
                  <Button variant="ghost" size="small">
                    Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="small">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
