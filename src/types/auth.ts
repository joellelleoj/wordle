// types/auth.ts - Authentication type definitions
export interface User {
  id: string | number;
  username: string;
  email: string;
  gitlab_id?: number;
  created_at: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
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

// Additional types for profile service integration
export interface GameRecord {
  gameId: string;
  word: string;
  targetWord?: string;
  guesses: string[];
  won: boolean;
  attempts: number;
  date: string;
  completedAt?: string;
  createdAt?: string;
}

export interface UserStats {
  totalGames: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  averageAttempts: number;
  guessDistribution: { [attempts: string]: number };
  lastPlayedAt?: Date | null;
}

export interface GameAlbum {
  id: string;
  userId: string;
  title: string;
  description: string;
  isPublic: boolean;
  gameIds: string[];
  createdAt: string;
  updatedAt: string;
}
