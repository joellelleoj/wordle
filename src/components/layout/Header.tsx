// components/layout/Header.tsx - Fixed navigation handling
import { User } from "../../services/auth";

export interface HeaderProps {
  isAuthenticated: boolean;
  user: User | null;
  onLogout: () => void;
  onNavigate: (page: "game" | "login" | "register" | "profile") => void;
  currentPage: "game" | "login" | "register" | "profile";
}

export function Header({
  isAuthenticated,
  user,
  onLogout,
  onNavigate,
  currentPage,
}: HeaderProps) {
  const handleTitleClick = () => {
    if (isAuthenticated) {
      onNavigate("game");
    } else {
      onNavigate("login");
    }
  };

  const handleLogoutClick = async () => {
    try {
      await onLogout();
    } catch (error) {
      console.error("Logout failed:", error);
      // Force logout even if server call fails
      window.location.reload();
    }
  };

  return (
    <header className="app-header">
      <div className="header-content">
        {/* App Title */}
        <div className="header-title">
          <h1
            className="app-title"
            onClick={handleTitleClick}
            style={{ cursor: "pointer" }}
            title={isAuthenticated ? "Go to Game" : "Go to Login"}
          >
            WORDLE
          </h1>
        </div>

        {/* Navigation Menu */}
        <nav className="header-nav">
          {isAuthenticated ? (
            <>
              <button
                className={`nav-button ${
                  currentPage === "game" ? "active" : ""
                }`}
                onClick={() => onNavigate("game")}
                disabled={currentPage === "game"}
              >
                Game
              </button>
              <button
                className={`nav-button ${
                  currentPage === "profile" ? "active" : ""
                }`}
                onClick={() => onNavigate("profile")}
                disabled={currentPage === "profile"}
              >
                Profile
              </button>
            </>
          ) : (
            <>
              <button
                className={`nav-button ${
                  currentPage === "login" ? "active" : ""
                }`}
                onClick={() => onNavigate("login")}
                disabled={currentPage === "login"}
              >
                Login
              </button>
              <button
                className={`nav-button ${
                  currentPage === "register" ? "active" : ""
                }`}
                onClick={() => onNavigate("register")}
                disabled={currentPage === "register"}
              >
                Register
              </button>
            </>
          )}
        </nav>

        {/* User Info & Logout */}
        <div className="header-user">
          {isAuthenticated && user ? (
            <div className="user-info">
              <span className="username">Hello, {user.username}</span>
              <button className="logout-button" onClick={handleLogoutClick}>
                Logout
              </button>
            </div>
          ) : (
            <div className="guest-info">
              <span className="guest-text">Please log in to play</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/*interface HeaderProps {
  isAuthenticated: boolean;
  user?: any;
  onLogout: () => void;
  onNavigate: (page: "game" | "login" | "register" | "profile") => void;
  currentPage: string;
}

export function Header({
  isAuthenticated,
  user,
  onLogout,
  onNavigate,
  currentPage,
}: HeaderProps) {
  return (
    <header>
      <h1>WORDLE</h1>
      <nav className="header-nav">
        {!isAuthenticated ? (
          <>
            <button
              onClick={() => onNavigate("login")}
              className={`nav-btn ${currentPage === "login" ? "active" : ""}`}
            >
              Login
            </button>
            <button
              onClick={() => onNavigate("register")}
              className={`nav-btn ${
                currentPage === "register" ? "active" : ""
              }`}
            >
              Register
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onNavigate("game")}
              className={`nav-btn ${currentPage === "game" ? "active" : ""}`}
            >
              Play
            </button>
            <button
              onClick={() => onNavigate("profile")}
              className={`nav-btn ${currentPage === "profile" ? "active" : ""}`}
            >
              Profile
            </button>
            <div className="user-info">
              <span className="username">Hi, {user?.username}</span>
            </div>
            <button onClick={onLogout} className="nav-btn logout-btn">
              Logout
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
*/
