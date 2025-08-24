export interface Game {
  id: string;
  userId: string;
  targetWord: string;
  guesses: Guess[];
  status: GameStatus;
  startTime: Date;
  endTime?: Date;
  currentAttempt: number;
}

export interface Guess {
  word: string;
  feedback: LetterFeedback[];
  timestamp: Date;
}

export interface LetterFeedback {
  letter: string;
  position: number;
  status: LetterStatus;
}

export enum LetterStatus {
  CORRECT = "correct", // Green - right letter, right position
  PRESENT = "present", // Yellow - right letter, wrong position
  ABSENT = "absent", // Gray - letter not in word
}

export enum GameStatus {
  PLAYING = "playing",
  WON = "won",
  LOST = "lost",
}
