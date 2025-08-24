import React, { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "small" | "medium" | "large";
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

/**
 * Button Component
 *
 * Reusable button with multiple variants and states
 * Implements accessibility best practices
 */
export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "medium",
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  className,
  children,
  ...props
}) => {
  const buttonClasses = [
    styles.button,
    styles[variant],
    styles[size],
    loading && styles.loading,
    disabled && styles.disabled,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={buttonClasses}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}

      <span className={styles.content}>
        {loading ? "Loading..." : children}
      </span>

      {rightIcon && <span className={styles.rightIcon}>{rightIcon}</span>}

      {loading && (
        <span className={styles.spinner} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="31.416"
              strokeDashoffset="31.416"
            />
          </svg>
        </span>
      )}
    </button>
  );
};
