import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RegisterForm } from "../../components/auth/RegisterForm/RegisterForm";
import { OAuth2Login } from "../../components/auth/OAuth2Login/OAuth2Login";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./RegisterPage.module.css";

/**
 * Registration Page Component
 *
 * User registration page with:
 * - Registration form with validation
 * - OAuth2 social registration options
 * - Login link
 */
export const RegisterPage: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
      </div>
    );
  }

  return (
    <div className={styles.registerPage}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Create Account</h1>
          <p className={styles.subtitle}>
            Join thousands of players and start your Wordle journey
          </p>
        </div>

        <div className={styles.formContainer}>
          <RegisterForm />

          <OAuth2Login />

          <div className={styles.footer}>
            <p className={styles.footerText}>
              Already have an account?{" "}
              <Link to="/login" className={styles.footerLink}>
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
