// types/index.ts - Fixed LoadingState and Types

// Core Data Types
export interface User {
  id: string | number;
  username: string;
  email: string;
  gitlab_id?: number;
  created_at: string;
}

// Authentication
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface GameVisualization {
  board: string[][];
  colors: string[][];
  metadata: {
    word: string;
    attempts: number;
    won: boolean;
  };
}
export interface UseGameStateReturn {
  gameState: GameState | null;
  loading: boolean;
  error: string | null;
  actions: {
    submitGuess: (guess: string) => Promise<void>;
    startNewGame: () => Promise<void>;
    loadGameState: (gameId: string) => Promise<void>;
  };
}

// FIXED: LoadingState should be string literals, not enum
export type LoadingState = "idle" | "loading" | "success" | "error";

export interface UseProfileReturn {
  stats: UserStats | null;
  gameHistory: GameRecord[];
  albums: GameAlbum[];
  loading: LoadingState;
  error: string | null;
  actions: {
    refreshStats: () => Promise<void>;
    loadGameHistory: (params?: PaginationParams) => Promise<void>;
    createAlbum: (data: AlbumFormData) => Promise<void>;
    updateAlbum: (id: string, data: Partial<AlbumFormData>) => Promise<void>;
    deleteAlbum: (id: string) => Promise<void>;
    refreshAllData?: () => Promise<void>; // ADDED: Manual refresh action
  };
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

export interface PaginationParams {
  limit?: number;
  offset?: number;
}
export interface GuessResponse {
  valid: boolean;
  result?: TileState[];
  gameOver?: boolean;
  won?: boolean;
  solution?: string;
  gameState?: GameState;
  error?: string;
}

export type TileState = "correct" | "present" | "absent";

// Navigation
export type Page = "game" | "login" | "register" | "profile";

export interface RouteState {
  page: Page;
  gameId?: string;
  albumId?: string;
  isAuthenticated?: boolean;
}
export interface GameState {
  gameId: string;
  board: string[][];
  evaluations: (TileState | null)[][];
  currentRow: number;
  gameOver: boolean;
  won: boolean;
  attempts: number;
  guesses: string[];
  targetWord?: string;
}

// Game Session
export interface GameSessionData {
  gameId: string;
  userId?: string | number;
  gameState: {
    board: string[][];
    evaluations: (TileState | null)[][]; // FIXED: Allow null values
    currentRow: number;
    gameOver: boolean;
    won: boolean;
    attempts: number;
    guesses: string[];
  };
  timestamp: string;
  sessionType?: "authenticated" | "anonymous";
}

// Game & Profile
export interface GameRecord {
  gameId: string;
  targetWord: string;
  guesses: string[];
  won: boolean;
  attempts: number;
  completedAt: string;
}

export interface GameHistoryProps {
  games: GameRecord[];
  loading?: boolean;
  onGameSelect?: (gameId: string) => void;
  showPagination?: boolean;
}

export interface UserStatsProps {
  stats: UserStats | null;
  loading?: boolean;
  size?: "compact" | "full";
}

export interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large";
  message?: string;
}

export interface AlbumFormData {
  title: string;
  description: string;
  selectedGameIds: string[];
}

export interface UserStats {
  totalGames: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  averageAttempts: number;
  guessDistribution: { [attempts: string]: number };
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

// Component Props
export interface AuthPageProps {
  mode: "login" | "register";
  onSuccess: () => void;
  onLogin: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; message?: string }>;
  onRegister?: (
    email: string,
    username: string,
    password: string
  ) => Promise<{ success: boolean; message?: string }>;
  onModeChange: (mode: "login" | "register") => void;
  onOAuthLogin?: () => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export interface HeaderProps {
  isAuthenticated: boolean;
  user: User | null;
  onLogout: () => void;
  onNavigate: (page: Page) => void;
  currentPage: Page;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
