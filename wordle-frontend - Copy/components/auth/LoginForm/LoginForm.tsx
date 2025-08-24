import React, { useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { LoginCredentials } from "../../../types/auth";
import { Button } from "../../ui/Button/Button";
import {
  validateEmail,
  validatePassword,
} from "../../../services/validation/formValidation";
import styles from "./LoginForm.module.css";

/**
 * Login Form Component
 *
 * Implements form validation and authentication
 */
export const LoginForm: React.FC = () => {
  const { login, isLoading, error } = useAuth();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Partial<LoginCredentials>>({});

  const handleInputChange =
    (field: keyof LoginCredentials) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setCredentials((prev) => ({ ...prev, [field]: value }));

      // Clear field error on input
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginCredentials> = {};

    if (!validateEmail(credentials.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!credentials.password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) return;

    try {
      await login(credentials);
    } catch (err) {
      // Error handled by context
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="email" className={styles.label}>
          Email Address
        </label>
        <input
          id="email"
          type="email"
          className={`${styles.input} ${errors.email ? styles.error : ""}`}
          value={credentials.email}
          onChange={handleInputChange("email")}
          disabled={isLoading}
          autoComplete="email"
          required
        />
        {errors.email && (
          <span className={styles.errorText} role="alert">
            {errors.email}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="password" className={styles.label}>
          Password
        </label>
        <input
          id="password"
          type="password"
          className={`${styles.input} ${errors.password ? styles.error : ""}`}
          value={credentials.password}
          onChange={handleInputChange("password")}
          disabled={isLoading}
          autoComplete="current-password"
          required
        />
        {errors.password && (
          <span className={styles.errorText} role="alert">
            {errors.password}
          </span>
        )}
      </div>

      {error && (
        <div className={styles.formError} role="alert">
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="large"
        disabled={isLoading}
        loading={isLoading}
        className={styles.submitButton}
      >
        {isLoading ? "Signing In..." : "Sign In"}
      </Button>
    </form>
  );
};
