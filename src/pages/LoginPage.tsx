// pages/LoginPage.tsx - Updated for login-first approach
import React, { useState } from "react";
import { authService } from "../services/auth";

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<any>;
  onRegister?: (
    email: string,
    username: string,
    password: string
  ) => Promise<any>;
  onNavigate: (page: "game" | "login" | "register" | "profile") => void;
  isRegister?: boolean;
  error?: string | null;
}

export function LoginPage({
  onLogin,
  onRegister,
  onNavigate,
  isRegister = false,
  error: globalError,
}: LoginPageProps) {
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayError = globalError || error;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const validateForm = (): boolean => {
    if (isRegister) {
      if (!formData.email || !formData.username || !formData.password) {
        setError("All fields are required");
        return false;
      }

      if (formData.username.length < 3) {
        setError("Username must be at least 3 characters long");
        return false;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        setError("Please enter a valid email address");
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return false;
      }

      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters long");
        return false;
      }
    } else {
      if (!formData.username || !formData.password) {
        setError("Username and password are required");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      let result;

      if (isRegister && onRegister) {
        result = await onRegister(
          formData.email,
          formData.username,
          formData.password
        );
      } else {
        result = await onLogin(formData.username, formData.password);
      }

      if (!result.success && result.message) {
        setError(result.message);
      }
    } catch (error: any) {
      setError(error.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const authUrl = await authService.initiateGitLabAuth();
      window.location.href = authUrl;
    } catch (error: any) {
      setError("Failed to initiate GitLab login. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-form">
        <h2>{isRegister ? "Create Account" : "Sign In to Play Wordle"}</h2>

        <p
          style={{
            textAlign: "center",
            marginBottom: "20px",
            color: "#666",
            fontSize: "14px",
          }}
        >
          {isRegister
            ? "Join the community to track your progress and compete with friends"
            : "Login required to play games and save your progress"}
        </p>

        {displayError && <div className="error-message">{displayError}</div>}

        <div className="oauth-section">
          <button
            onClick={handleOAuthLogin}
            className="oauth-btn"
            type="button"
            disabled={loading}
          >
            {loading ? "Connecting..." : "Login with GitLab"}
          </button>
          <div className="divider">
            <span>or</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label htmlFor="email">Email Address:</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="your.email@example.com"
                autoComplete="email"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={loading}
              minLength={3}
              placeholder="Enter your username"
              autoComplete={isRegister ? "username" : "username"}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={isRegister ? 6 : 1}
              disabled={loading}
              placeholder={
                isRegister ? "At least 6 characters" : "Enter your password"
              }
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>

          {isRegister && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password:</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Confirm your password"
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            type="submit"
            className={`auth-btn ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : isRegister
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>

        <div className="auth-switch">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => onNavigate("login")}
                className="link-btn"
                disabled={loading}
              >
                Sign in here
              </button>
            </>
          ) : (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => onNavigate("register")}
                className="link-btn"
                disabled={loading}
              >
                Create account
              </button>
            </>
          )}
        </div>

        {/* Features highlight for motivation */}
        <div className="features-highlight">
          <h4>Why create an account?</h4>
          <ul>
            <li>📊 Track your game statistics and streaks</li>
            <li>🎯 View detailed game history</li>
            <li>📸 Create albums of your best games</li>
            <li>🏆 Compete with other players</li>
            <li>☁️ Sync progress across devices</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
