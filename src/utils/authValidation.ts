/**
 * Authentication Validation Utilities
 *
 * Provides client-side validation rules for authentication forms.
 * Ensures consistent validation across the application.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates login credentials
 */
export const validateLoginCredentials = (
  username: string,
  password: string
): ValidationResult => {
  const errors: Record<string, string> = {};

  if (!username.trim()) {
    errors.username = "Username is required";
  }

  if (!password) {
    errors.password = "Password is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validates registration data
 */
export const validateRegistrationData = (
  email: string,
  username: string,
  password: string,
  confirmPassword: string
): ValidationResult => {
  const errors: Record<string, string> = {};

  // Email validation
  if (!email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Please enter a valid email address";
  }

  // Username validation
  if (!username.trim()) {
    errors.username = "Username is required";
  } else if (username.length < 3) {
    errors.username = "Username must be at least 3 characters long";
  } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.username =
      "Username can only contain letters, numbers, underscores, and hyphens";
  }

  // Password validation
  if (!password) {
    errors.password = "Password is required";
  } else if (password.length < 6) {
    errors.password = "Password must be at least 6 characters long";
  }

  // Confirm password validation
  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm your password";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
