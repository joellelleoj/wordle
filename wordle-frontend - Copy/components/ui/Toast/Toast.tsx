import React, { useEffect } from "react";
import styles from "./Toast.module.css";

interface ToastProps {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
  onDismiss: (id: string) => void;
}

/**
 * Toast Component
 *
 * Notification toast with auto-dismiss functionality
 */
export const Toast: React.FC<ToastProps> = ({
  id,
  type,
  message,
  duration = 3000,
  onDismiss,
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, duration, onDismiss]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      case "info":
        return "ℹ";
      default:
        return "";
    }
  };

  return (
    <div
      className={`${styles.toast} ${styles[type]}`}
      role="alert"
      aria-live="polite"
    >
      <span className={styles.icon} aria-hidden="true">
        {getIcon()}
      </span>

      <span className={styles.message}>{message}</span>

      <button
        className={styles.dismissButton}
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
};

// Toast Container Component
interface ToastContainerProps {
  toasts: Array<{
    id: string;
    type: "success" | "error" | "warning" | "info";
    message: string;
    duration?: number;
  }>;
  onDismiss: (id: string) => void;
  position?:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center";
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  position = "top-right",
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className={`${styles.container} ${styles[position]}`}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          duration={toast.duration}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};
