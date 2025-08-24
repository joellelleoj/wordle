export interface GameState {
  id: string;
  userId?: string;
  targetWord: string;
  guesses: string[];
  gameStatus: "active" | "won" | "lost";
  startTime: Date;
  endTime?: Date;
  maxGuesses: number;
}

export interface GuessResult {
  guess: string;
  result: LetterResult[];
  gameStatus: "active" | "won" | "lost";
  remainingGuesses: number;
  isValidWord: boolean;
}

export interface LetterResult {
  letter: string;
  status: "correct" | "present" | "absent";
  position: number;
}

export interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  winPercentage: number;
  averageGuesses: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: { [key: number]: number };
}
