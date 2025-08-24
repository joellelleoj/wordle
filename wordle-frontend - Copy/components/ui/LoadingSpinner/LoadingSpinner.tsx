import React from "react";
import styles from "./LoadingSpinner.module.css";

interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large";
  color?: string;
  className?: string;
}

/**
 * Loading Spinner Component
 *
 * Accessible loading indicator with ARIA support
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "medium",
  color,
  className,
}) => {
  const spinnerClasses = [styles.spinner, styles[size], className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={spinnerClasses}
      style={color ? { color } : undefined}
      role="status"
      aria-label="Loading"
    >
      <svg viewBox="0 0 50 50" className={styles.svg}>
        <circle
          className={styles.circle}
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="31.416"
          strokeDashoffset="31.416"
        />
      </svg>
      <span className={styles.srOnly}>Loading...</span>
    </div>
  );
};
