import React from "react";
import { authService } from "../../services/auth";

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  const isAuthenticated = authService.isAuthenticated();

  if (!isAuthenticated) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div>Please log in to access this content.</div>
    );
  }

  return <>{children}</>;
};
