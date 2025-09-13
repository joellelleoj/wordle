import React, { memo, useState } from "react";
import { FormField } from "./FormField";
import { Button } from "../layout/Button";
import "./AuthForm.css";

interface AuthFormProps {
  mode: "login" | "register";
  onLogin: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; message?: string }>;
  onRegister?: (
    email: string,
    username: string,
    password: string
  ) => Promise<{ success: boolean; message?: string }>;
  loading?: boolean;
}

interface FormData {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  [key: string]: string;
}

/**
 * AuthForm Component
 *
 * Handles both login and registration forms with validation.
 * Shows clear validation requirements for registration.
 */
export const AuthForm = memo(
  ({ mode, onLogin, onRegister, loading = false }: AuthFormProps) => {
    const [formData, setFormData] = useState<FormData>({
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
    });

    const [errors, setErrors] = useState<FormErrors>({});
    const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));

      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const { name } = e.target;
      setTouched((prev) => ({ ...prev, [name]: true }));

      if (mode === "register") {
        validateField(name);
      }
    };

    const validateField = (fieldName: string) => {
      const newErrors: FormErrors = { ...errors };

      switch (fieldName) {
        case "email":
          if (!formData.email.trim()) {
            newErrors.email = "Email is required";
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = "Please enter a valid email address";
          } else {
            delete newErrors.email;
          }
          break;

        case "username":
          if (!formData.username.trim()) {
            newErrors.username = "Username is required";
          } else if (formData.username.length < 3) {
            newErrors.username = "Username must be at least 3 characters";
          } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
            newErrors.username =
              "Username can only contain letters, numbers, and underscores";
          } else {
            delete newErrors.username;
          }
          break;

        case "password":
          if (!formData.password) {
            newErrors.password = "Password is required";
          } else if (formData.password.length < 6) {
            newErrors.password = "Password must be at least 6 characters";
          } else {
            delete newErrors.password;
          }
          break;

        case "confirmPassword":
          if (!formData.confirmPassword) {
            newErrors.confirmPassword = "Please confirm your password";
          } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
          } else {
            delete newErrors.confirmPassword;
          }
          break;
      }

      setErrors(newErrors);
    };

    const validateForm = (): boolean => {
      const newErrors: FormErrors = {};

      if (mode === "register") {
        if (!formData.email.trim()) {
          newErrors.email = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = "Please enter a valid email address";
        }

        if (!formData.username.trim()) {
          newErrors.username = "Username is required";
        } else if (formData.username.length < 3) {
          newErrors.username = "Username must be at least 3 characters";
        } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
          newErrors.username =
            "Username can only contain letters, numbers, and underscores";
        }

        if (!formData.password) {
          newErrors.password = "Password is required";
        } else if (formData.password.length < 6) {
          newErrors.password = "Password must be at least 6 characters";
        }

        if (!formData.confirmPassword) {
          newErrors.confirmPassword = "Please confirm your password";
        } else if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = "Passwords do not match";
        }
      } else {
        if (!formData.username.trim()) {
          newErrors.username = "Username is required";
        }

        if (!formData.password) {
          newErrors.password = "Password is required";
        }
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) {
        const allFields =
          mode === "register"
            ? ["email", "username", "password", "confirmPassword"]
            : ["username", "password"];
        setTouched(Object.fromEntries(allFields.map((field) => [field, true])));
        return;
      }

      try {
        if (mode === "register" && onRegister) {
          await onRegister(
            formData.email,
            formData.username,
            formData.password
          );
        } else {
          await onLogin(formData.username, formData.password);
        }
      } catch (error) {
        console.error("Form submission error:", error);
      }
    };

    return (
      <div>
        {mode === "register" && (
          <div className="auth-requirements">
            <h3>Registration Requirements</h3>
            <ul>
              <li>Username: min. 3 characters</li>
              <li>Username: letters numbers/underscores only</li>
              <li>Password: min. 6 charactersh</li>
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <FormField
              label="Email Address"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.email ? errors.email : undefined}
              placeholder="your.email@example.com"
              disabled={loading}
              required
            />
          )}

          <FormField
            label="Username"
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.username ? errors.username : undefined}
            placeholder="Enter your username"
            disabled={loading}
            required
          />

          <FormField
            label="Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.password ? errors.password : undefined}
            placeholder={
              mode === "register"
                ? "At least 6 characters"
                : "Enter your password"
            }
            disabled={loading}
            required
          />

          {mode === "register" && (
            <FormField
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              error={
                touched.confirmPassword ? errors.confirmPassword : undefined
              }
              placeholder="Confirm your password"
              disabled={loading}
              required
            />
          )}

          <Button type="submit" loading={loading} fullWidth disabled={loading}>
            {loading
              ? "Processing..."
              : mode === "register"
              ? "Create Account"
              : "Sign In"}
          </Button>
        </form>
      </div>
    );
  }
);

AuthForm.displayName = "AuthForm";
