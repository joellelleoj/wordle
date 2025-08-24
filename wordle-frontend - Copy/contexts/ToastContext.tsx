import React, { createContext, useContext, useState, ReactNode } from "react";
import { ToastMessage } from "../types/global";

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (message: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: Omit<ToastMessage, "id">) => {
    const id =
      Math.random().toString(36).substring(2) + Date.now().toString(36);
    const newToast: ToastMessage = { ...message, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after duration
    if (message.duration !== 0) {
      setTimeout(() => {
        dismissToast(id);
      }, message.duration || 3000);
    }
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const clearAllToasts = () => {
    setToasts([]);
  };

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, dismissToast, clearAllToasts }}
    >
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
