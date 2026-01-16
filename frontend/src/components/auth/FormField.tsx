import React, { memo, forwardRef } from "react";
import "./FormField.css";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const FormField = memo(
  forwardRef<HTMLInputElement, FormFieldProps>(
    ({ label, error, className = "", id, required, ...props }, ref) => {
      const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
      const hasError = Boolean(error);

      const inputClasses = [
        "form-input__field",
        hasError && "form-input__field--error",
        className,
      ]
        .filter(Boolean)
        .join(" ");

      return (
        <div className="form-input">
          <label htmlFor={fieldId} className="form-input__label">
            {label}
            {required && <span className="form-input__required">*</span>}
          </label>
          <input
            ref={ref}
            id={fieldId}
            className={inputClasses}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${fieldId}-error` : undefined}
            {...props}
          />
          {error && (
            <span
              id={`${fieldId}-error`}
              className="form-input__error"
              role="alert"
            >
              {error}
            </span>
          )}
        </div>
      );
    }
  )
);

FormField.displayName = "FormField";
