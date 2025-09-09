// src/types/user.types.ts

export interface User {
  id: string;
  email: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  oauth_provider: string;
  oauth_id?: string;
  email_verified: boolean;
  is_active: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  oauth_provider: string;
  oauth_id?: string;
  password_hash?: string;
}

export interface UpdateUserData {
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  is_revoked: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface OAuthState {
  id: string;
  state_token: string;
  user_session?: string;
  expires_at: Date;
  created_at: Date;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
  created_at: Date;
  last_accessed_at: Date;
}

export interface JWTPayload {
  sub: string; // user id
  email: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  iat: number;
  exp: number;
}

export interface GitLabUserInfo {
  id: number;
  username: string;
  email: string;
  name: string;
  avatar_url: string;
  web_url: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthResponse {
  success: boolean;
  user: User;
  tokens: AuthTokens;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Request/Response interfaces
export interface LoginRequest {
  redirectUrl?: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface UpdateProfileRequest {
  username?: string;
  display_name?: string;
}
