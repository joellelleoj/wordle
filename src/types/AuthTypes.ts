import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username?: string;
    displayName: string;
    avatarUrl?: string;
    provider: string;
    isActive: boolean;
  };
}

export interface GitLabProfile {
  id: string;
  username: string;
  name: string;
  displayName: string;
  email: string;
  emails: Array<{ value: string }>;
  avatarUrl?: string;
  avatar_url?: string;
  photos: Array<{ value: string }>;
  provider: string;
}

export interface JWTPayload {
  sub: string; // user id
  email: string;
  username?: string;
  displayName: string;
  provider: string;
  iat: number; // issued at
  exp: number; // expires at
  iss: string; // issuer
  aud: string; // audience
}
