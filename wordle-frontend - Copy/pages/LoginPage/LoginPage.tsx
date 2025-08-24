import React, { useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LoginForm } from "../../components/auth/LoginForm/LoginForm";
import { OAuth2Login } from "../../components/auth/OAuth2Login/OAuth2Login";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./LoginPage.module.css";

/**
 * Login Page Component
 *
 * User authentication page with:
 * - Email/password login form
 * - OAuth2 social login options
 * - Registration link
 * - Redirect handling
 */
export const LoginPage: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
      </div>
    );
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.subtitle}>
            Sign in to your account to continue playing Wordle
          </p>
        </div>

        <div className={styles.formContainer}>
          <LoginForm />

          <OAuth2Login />

          <div className={styles.footer}>
            <p className={styles.footerText}>
              Don't have an account?{" "}
              <Link to="/register" className={styles.footerLink}>
                Sign up here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
