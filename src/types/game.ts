export interface GameTile {
  letter: string;
  status: TileStatus;
  animate?: boolean;
}

export enum TileStatus {
  EMPTY = "empty",
  FILLED = "filled",
  CORRECT = "correct",
  PRESENT = "present",
  ABSENT = "absent",
}

export interface GuessFeedback {
  position: number;
  letter: string;
  status: TileStatus;
}

export interface GuessResult {
  word: string;
  feedback: GuessFeedback[];
  isCorrect: boolean;
  isValidWord: boolean;
  gameStatus: GameStatus;
}

export enum GameStatus {
  PLAYING = "playing",
  WON = "won",
  LOST = "lost",
  NOT_STARTED = "not_started",
}

export interface GameRow {
  tiles: GameTile[];
  submitted: boolean;
  isCurrentRow?: boolean;
}

export interface GameState {
  id?: string;
  word: string;
  rows: GameRow[];
  currentRow: number;
  currentTile: number;
  status: GameStatus;
  startTime?: Date;
  endTime?: Date;
  attempts: number;
  isSubmitting: boolean;
  lastGuess?: string;
  validationError?: string;
}

export interface GameResult {
  id: string;
  word: string;
  attempts: number;
  won: boolean;
  duration: number; // in seconds
  guesses: string[];
  guessFeedback: GuessFeedback[][];
  createdAt: Date;
}

export interface GameStats {
  totalGames: number;
  totalWins: number;
  winRate: number;
  averageAttempts: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: { [key: number]: number };
}

export interface KeyboardKey {
  key: string;
  label: string;
  status?: TileStatus;
  isSpecial?: boolean;
  width?: "narrow" | "wide" | "normal";
}

export interface KeyboardState {
  [letter: string]: TileStatus;
}
