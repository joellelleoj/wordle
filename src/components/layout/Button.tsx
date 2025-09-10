import React, { memo, forwardRef } from "react";
import "./Button.css";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

/**
 * Button Component
 *
 * A reusable button component
 * Provides consistent styling and behavior with three semantic variants
 *
 * Design System:
 * - Primary: Green for main actions
 * - Secondary: Outlined style for navigation and secondary actions
 * - Danger: Red for destructive actions like logout
 */
const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(
    (
      {
        variant = "primary",
        loading = false,
        fullWidth = false,
        disabled,
        className = "",
        children,
        ...props
      },
      ref
    ) => {
      const buttonClasses = [
        "btn",
        `btn--${variant}`,
        loading && "btn--loading",
        fullWidth && "btn--full-width",
        className,
      ]
        .filter(Boolean)
        .join(" ");

      return (
        <button
          ref={ref}
          className={buttonClasses}
          disabled={disabled || loading}
          aria-busy={loading}
          aria-disabled={disabled || loading}
          {...props}
        >
          {children}
        </button>
      );
    }
  )
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps };
