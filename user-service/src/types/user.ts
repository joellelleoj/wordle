export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string | null;
  gitlab_id?: number | null;
  display_name?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  username: string;
  email: string;
  password_hash: string | null;
  gitlab_id?: number | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface UserSession {
  id: number;
  user_id: number;
  refresh_token: string;
  expires_at: Date;
  created_at: Date;
}

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}
