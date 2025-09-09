// hooks/useAuth.ts
import { useState, useEffect } from "react";
import {
  authService,
  User,
  LoginCredentials,
  RegisterData,
} from "../services/auth";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = () => {
      const currentUser = authService.getCurrentUser();
      if (currentUser && authService.isAuthenticated()) {
        setUser(currentUser);
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const result = await authService.login(credentials);
    if (result.success && result.data) {
      setUser(result.data.user);
    }
    return result;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const register = async (data: RegisterData) => {
    const result = await authService.register(data);
    if (result.success && result.data) {
      setUser(result.data.user);
    }
    return result;
  };

  return {
    user,
    loading,
    login,
    logout,
    register,
    isAuthenticated: !!user,
  };
};
