export type TileState = "correct" | "present" | "absent" | null;
export interface KeyboardProps {
  onKeyPress: (key: string) => void;
  usedLetters: Map<string, TileState>;
  disabled?: boolean;
}

export interface GameResultProps {
  gameOver: boolean;
  won: boolean;
  solution?: string;
  onNewGame: () => void;
  loading?: boolean;
}

export interface BoardProps {
  board: string[][];
  evaluations: TileState[][];
  shakingRow: number | null;
  poppingTile: { row: number; col: number } | null;
  currentRow: number;
}

export interface GameState {
  gameId: string;
  board: string[][];
  evaluations: ("correct" | "present" | "absent" | null)[][];
  currentRow: number;
  gameOver: boolean;
  won: boolean;
  attempts: number;
  guesses: string[];
}

export interface GuessResponse {
  valid: boolean;
  result?: ("correct" | "present" | "absent")[];
  gameOver?: boolean;
  won?: boolean;
  solution?: string;
  gameState?: GameState;
  error?: string;
}

export interface GameSessionData {
  gameId: string;
  gameState: Omit<GameState, "gameId">;
  timestamp: string;
  userId?: string | number;
  sessionType?: "authenticated" | "anonymous" | "oauth";
}

export type Page = "game" | "login" | "register" | "profile";

export interface RouteState {
  page: Page;
  gameId?: string;
  albumId?: string;
  isAuthenticated?: boolean;
}

/*

export type TileState = "correct" | "present" | "absent" | null;
export interface GameBoardProps {
  board: string[][];
  evaluations: TileState[][];
  size?: "small" | "medium" | "large";
  interactive?: boolean;
  animationDelay?: number;
  shakingRow?: number | null;
  poppingTile?: { row: number; col: number } | null;
  currentRow?: number;
  showMetadata?: boolean;
  gameMetadata?: {
    word: string;
    attempts: number;
    won: boolean;
    date?: string;
  };
}

export interface KeyboardProps {
  onKeyPress: (key: string) => void;
  usedLetters: Map<string, TileState>;
  disabled?: boolean;
  size?: "small" | "medium" | "large";
}

export interface StorageItem<T> {
  data: T;
  timestamp: number;
  expiresAt?: number;
}
*/
