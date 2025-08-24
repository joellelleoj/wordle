import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from "react";
import {
  AuthState,
  User,
  LoginCredentials,
  RegisterCredentials,
} from "../types/auth";
import { authService } from "../services/api/authService";
import { tokenStorage } from "../services/storage/tokenStorage";

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  loginWithOAuth2: (provider: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

type AuthAction =
  | { type: "AUTH_START" }
  | { type: "AUTH_SUCCESS"; payload: { user: User; token: string } }
  | { type: "AUTH_ERROR"; payload: string }
  | { type: "AUTH_LOGOUT" }
  | { type: "CLEAR_ERROR" };

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case "AUTH_START":
      return { ...state, isLoading: true, error: null };

    case "AUTH_SUCCESS":
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case "AUTH_ERROR":
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };

    case "AUTH_LOGOUT":
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    default:
      return state;
  }
};

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
};

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider Component
 *
 * Implements:
 * - 12-Factor App: Stateless processes, externalized auth state
 * - JWT Authentication: Secure token handling
 * - OAuth2 Integration: External authentication providers
 * - Single Responsibility: Authentication state management only
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state from storage
  useEffect(() => {
    const initializeAuth = async () => {
      const token = tokenStorage.getToken();
      if (token && !tokenStorage.isTokenExpired(token)) {
        try {
          const user = await authService.getCurrentUser(token);
          dispatch({ type: "AUTH_SUCCESS", payload: { user, token } });
        } catch (err) {
          tokenStorage.removeToken();
        }
      }
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    dispatch({ type: "AUTH_START" });

    try {
      const response = await authService.login(credentials);
      tokenStorage.setToken(response.token);
      dispatch({
        type: "AUTH_SUCCESS",
        payload: { user: response.user, token: response.token },
      });
    } catch (err: any) {
      dispatch({ type: "AUTH_ERROR", payload: err.message || "Login failed" });
      throw err;
    }
  };

  const register = async (credentials: RegisterCredentials): Promise<void> => {
    dispatch({ type: "AUTH_START" });

    try {
      const response = await authService.register(credentials);
      tokenStorage.setToken(response.token);
      dispatch({
        type: "AUTH_SUCCESS",
        payload: { user: response.user, token: response.token },
      });
    } catch (err: any) {
      dispatch({
        type: "AUTH_ERROR",
        payload: err.message || "Registration failed",
      });
      throw err;
    }
  };

  const logout = (): void => {
    tokenStorage.removeToken();
    dispatch({ type: "AUTH_LOGOUT" });
  };

  const refreshToken = async (): Promise<void> => {
    const currentToken = tokenStorage.getToken();
    if (!currentToken) {
      logout();
      return;
    }

    try {
      const response = await authService.refreshToken(currentToken);
      tokenStorage.setToken(response.token);
      dispatch({
        type: "AUTH_SUCCESS",
        payload: { user: response.user, token: response.token },
      });
    } catch (err) {
      logout();
      throw err;
    }
  };

  const loginWithOAuth2 = (provider: string): void => {
    const oauthUrl = authService.getOAuth2Url(provider);
    window.location.href = oauthUrl;
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshToken,
    loginWithOAuth2,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
