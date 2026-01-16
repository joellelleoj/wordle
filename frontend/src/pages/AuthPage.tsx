// pages/AuthPage.tsx - FIXED: Removed redundant OAuth callback handling
import React, { memo } from "react";
import { AuthForm } from "../components/auth/AuthForm";
import { OAuthSection } from "../components/auth/OAuthSection";
import { LoadingSpinner } from "../components/layout/LoadingSpinner";
import { AuthResponse } from "../types";
import { logger } from "../utils/logger";
import "./AuthPage.css";

interface AuthPageProps {
  mode: "login" | "register";
  onSuccess: () => void;
  onLogin: (username: string, password: string) => Promise<AuthResponse>;
  onRegister?: (
    email: string,
    username: string,
    password: string
  ) => Promise<AuthResponse>;
  onModeChange: (mode: "login" | "register") => void;
  onOAuthLogin: () => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

/**
 * AuthPage Component
 *
 * FIXED: OAuth callback is now handled at App level, this component
 * only handles the auth forms and OAuth initiation
 */
export const AuthPage = memo(
  ({
    mode,
    onSuccess,
    onLogin,
    onRegister,
    onModeChange,
    onOAuthLogin,
    loading = false,
    error,
  }: AuthPageProps) => {
    const handleFormSubmit = async (
      usernameOrEmail: string,
      password: string,
      email?: string
    ) => {
      try {
        let result: AuthResponse;

        if (mode === "register" && onRegister && email) {
          result = await onRegister(email, usernameOrEmail, password);
        } else {
          result = await onLogin(usernameOrEmail, password);
        }

        if (result.success) {
          onSuccess();
        }

        return result;
      } catch (error) {
        logger.error("Form submission error in AuthPage", { error });
        return {
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    };

    const handleLoginSubmit = async (username: string, password: string) => {
      return await handleFormSubmit(username, password);
    };

    const handleRegisterSubmit = async (
      email: string,
      username: string,
      password: string
    ) => {
      return await handleFormSubmit(username, password, email);
    };

    if (loading) {
      return (
        <div className="auth-page">
          <div className="auth-container">
            <LoadingSpinner size="large" message="Authenticating..." />
          </div>
        </div>
      );
    }

    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <h1 className="auth-title">WORDLE</h1>
            <p className="auth-subtitle">
              {mode === "register"
                ? "Create your account to save your progress"
                : "Sign in to access your saved games"}
            </p>
          </div>

          <div className="auth-content">
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <OAuthSection onOAuthLogin={onOAuthLogin} loading={loading} />

            <AuthForm
              mode={mode}
              onLogin={handleLoginSubmit}
              onRegister={onRegister ? handleRegisterSubmit : undefined}
              loading={loading}
            />

            <div className="auth-switch">
              {mode === "login" ? (
                <p>
                  Don't have an account?{" "}
                  <button
                    onClick={() => onModeChange("register")}
                    className="auth-link"
                    disabled={loading}
                  >
                    Sign up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <button
                    onClick={() => onModeChange("login")}
                    className="auth-link"
                    disabled={loading}
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

AuthPage.displayName = "AuthPage";
