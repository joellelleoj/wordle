import React, { useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: "small" | "medium" | "large" | "fullscreen";
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  children: ReactNode;
}

/**
 * Modal Component
 *
 * Accessible modal dialog with keyboard navigation
 * Supports different sizes and behaviors
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = "medium",
  closeOnOverlayClick = true,
  closeOnEscape = true,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    // Lock body scroll
    document.body.style.overflow = "hidden";

    // Focus management
    const previousActiveElement = document.activeElement as HTMLElement;

    return () => {
      document.body.style.overflow = "";
      previousActiveElement?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div className={`${styles.modal} ${styles[size]}`}>
        {title && (
          <header className={styles.header}>
            <h2 id="modal-title" className={styles.title}>
              {title}
            </h2>
            <button
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close modal"
            >
              ×
            </button>
          </header>
        )}

        <div className={styles.content}>{children}</div>
      </div>
    </div>,
    document.body
  );
};
