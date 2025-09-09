/*export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  gitlab_id?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  username: string;
  email: string;
  password_hash: string;
  gitlab_id?: number;
}

export interface UserSession {
  id: number;
  user_id: number;
  refresh_token: string;
  expires_at: Date;
  created_at: Date;
}

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        username: string;
        email: string;
        iat?: number;
        exp?: number;
      };
    }
  }
}*/

// user-service/src/types/user.ts
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
