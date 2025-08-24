import React, { useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { RegisterCredentials } from "../../../types/auth";
import { Button } from "../../ui/Button/Button";
import {
  validateEmail,
  validatePassword,
  validateUsername,
} from "../../../services/validation/formValidation";
import styles from "./RegisterForm.module.css";

export const RegisterForm: React.FC = () => {
  const { register, isLoading, error } = useAuth();
  const [credentials, setCredentials] = useState<RegisterCredentials>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
  });
  const [errors, setErrors] = useState<
    Partial<RegisterCredentials & { confirmPassword: string }>
  >({});

  const handleInputChange =
    (field: keyof RegisterCredentials) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setCredentials((prev) => ({ ...prev, [field]: value }));

      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  const validateForm = (): boolean => {
    const newErrors: Partial<
      RegisterCredentials & { confirmPassword: string }
    > = {};

    if (!validateUsername(credentials.username)) {
      newErrors.username =
        "Username must be 3-20 characters, letters, numbers, and underscores only";
    }

    if (!validateEmail(credentials.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!validatePassword(credentials.password)) {
      newErrors.password =
        "Password must be at least 8 characters with uppercase, lowercase, number and special character";
    }

    if (credentials.password !== credentials.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) return;

    try {
      await register(credentials);
    } catch (err) {
      // Error handled by context
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="username" className={styles.label}>
          Username
        </label>
        <input
          id="username"
          type="text"
          className={`${styles.input} ${errors.username ? styles.error : ""}`}
          value={credentials.username}
          onChange={handleInputChange("username")}
          disabled={isLoading}
          autoComplete="username"
          required
        />
        {errors.username && (
          <span className={styles.errorText} role="alert">
            {errors.username}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="displayName" className={styles.label}>
          Display Name (Optional)
        </label>
        <input
          id="displayName"
          type="text"
          className={styles.input}
          value={credentials.displayName || ""}
          onChange={handleInputChange("displayName")}
          disabled={isLoading}
          autoComplete="name"
        />
      </div>

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
          autoComplete="new-password"
          required
        />
        {errors.password && (
          <span className={styles.errorText} role="alert">
            {errors.password}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="confirmPassword" className={styles.label}>
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          className={`${styles.input} ${
            errors.confirmPassword ? styles.error : ""
          }`}
          value={credentials.confirmPassword}
          onChange={handleInputChange("confirmPassword")}
          disabled={isLoading}
          autoComplete="new-password"
          required
        />
        {errors.confirmPassword && (
          <span className={styles.errorText} role="alert">
            {errors.confirmPassword}
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
        {isLoading ? "Creating Account..." : "Create Account"}
      </Button>
    </form>
  );
};
