import React, { memo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import "./Modal.css";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: "small" | "medium" | "large";
  children: React.ReactNode;
}

const Modal = memo<ModalProps>(
  ({ isOpen, onClose, title, size = "medium", children }) => {
    const modalRef = useRef<HTMLDivElement>(null);

    // Focus management
    useEffect(() => {
      if (isOpen) {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements?.[0] as HTMLElement;
        firstElement?.focus();
      }
    }, [isOpen]);

    // Escape key handler
    useEffect(() => {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onClose();
        }
      };

      if (isOpen) {
        document.addEventListener("keydown", handleEscape);
        document.body.style.overflow = "hidden";
      }

      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "unset";
      };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleBackdropClick = (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    };

    return createPortal(
      <div className="modalOverlay" onClick={handleBackdropClick}>
        <div
          ref={modalRef}
          className={`modal modal--${size}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "modal-title" : undefined}
        >
          {title && (
            <div className="modalHeader">
              <h3 id="modal-title" className="modalTitle">
                {title}
              </h3>
              <Button
                variant="secondary"
                onClick={onClose}
                aria-label="Close modal"
              >
                ×
              </Button>
            </div>
          )}

          <div className="modalContent">{children}</div>
        </div>
      </div>,
      document.body
    );
  }
);

export { Modal };
