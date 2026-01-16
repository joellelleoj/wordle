// hooks/useAuthForm.ts - Form state and validation hook

import { useState, useCallback } from "react";

interface ValidationRules {
  required?: boolean;
  minLength?: number;
  email?: boolean;
}

interface FieldConfig {
  [key: string]: ValidationRules;
}

interface FormState {
  [key: string]: string;
}

interface FormErrors {
  [key: string]: string;
}

export const useAuthForm = (
  initialState: FormState,
  fieldConfig: FieldConfig
) => {
  const [formData, setFormData] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});

  const validateField = useCallback(
    (name: string, value: string): string => {
      const rules = fieldConfig[name];
      if (!rules) return "";

      if (rules.required && !value.trim()) {
        return `${name.charAt(0).toUpperCase() + name.slice(1)} is required`;
      }

      if (rules.minLength && value.length < rules.minLength) {
        return `${
          name.charAt(0).toUpperCase() + name.slice(1)
        } must be at least ${rules.minLength} characters`;
      }

      if (rules.email && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return "Please enter a valid email address";
      }

      return "";
    },
    [fieldConfig]
  );

  const handleChange = useCallback(
    (name: string, value: string) => {
      setFormData((prev) => ({ ...prev, [name]: value }));

      // Clear error when user starts typing
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }
    },
    [errors]
  );

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    Object.keys(fieldConfig).forEach((fieldName) => {
      const error = validateField(fieldName, formData[fieldName] || "");
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [formData, fieldConfig, validateField]);

  const reset = useCallback(() => {
    setFormData(initialState);
    setErrors({});
  }, [initialState]);

  return {
    formData,
    errors,
    handleChange,
    validateForm,
    reset,
  };
};
