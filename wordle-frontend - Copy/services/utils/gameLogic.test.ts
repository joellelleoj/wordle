import {
  GameState,
  GameStatus,
  TileStatus,
  GameRow,
  KeyboardState,
} from "../../types/game";
import { GAME_CONFIG } from "./constants";

/**
 * Creates empty game state with proper initialization
 */
export const createEmptyGameState = (): GameState => {
  const rows: GameRow[] = Array.from(
    { length: GAME_CONFIG.MAX_ATTEMPTS },
    (_, index) => ({
      tiles: Array.from({ length: GAME_CONFIG.WORD_LENGTH }, () => ({
        letter: "",
        status: TileStatus.EMPTY,
      })),
      submitted: false,
      isCurrentRow: index === 0,
    })
  );

  return {
    word: "",
    rows,
    currentRow: 0,
    currentTile: 0,
    status: GameStatus.NOT_STARTED,
    startTime: new Date(),
    attempts: 0,
    isSubmitting: false,
  };
};

/**
 * Wordle Game Logic - Letter Status Calculation
 *
 * This is the core logic that determines tile colors based on:
 * 1. Letter position in guess vs target word
 * 2. Letter frequency in both words
 * 3. Wordle's specific rules for duplicate letters
 */
export const calculateLetterFeedback = (
  guess: string,
  targetWord: string
): TileStatus[] => {
  const guessArray = guess.toUpperCase().split("");
  const targetArray = targetWord.toUpperCase().split("");
  const feedback: TileStatus[] = new Array(GAME_CONFIG.WORD_LENGTH).fill(
    TileStatus.ABSENT
  );

  // Track which letters in target have been "used" for correct/present matches
  const targetUsed = new Array(GAME_CONFIG.WORD_LENGTH).fill(false);

  // First pass: Mark all CORRECT letters (right letter, right position)
  for (let i = 0; i < GAME_CONFIG.WORD_LENGTH; i++) {
    if (guessArray[i] === targetArray[i]) {
      feedback[i] = TileStatus.CORRECT;
      targetUsed[i] = true;
    }
  }

  // Second pass: Mark PRESENT letters (right letter, wrong position)
  for (let i = 0; i < GAME_CONFIG.WORD_LENGTH; i++) {
    if (feedback[i] !== TileStatus.CORRECT) {
      // Look for this letter in unused positions of target
      for (let j = 0; j < GAME_CONFIG.WORD_LENGTH; j++) {
        if (!targetUsed[j] && guessArray[i] === targetArray[j]) {
          feedback[i] = TileStatus.PRESENT;
          targetUsed[j] = true;
          break;
        }
      }
    }
  }

  return feedback;
};

/**
 * Updates keyboard state based on guess feedback
 *
 * Priority system for key colors:
 * 1. CORRECT (green) - highest priority, never changes
 * 2. PRESENT (yellow) - medium priority, can be upgraded to CORRECT
 * 3. ABSENT (gray) - lowest priority, can be upgraded to PRESENT or CORRECT
 * 4. EMPTY - default state
 */
export const updateKeyboardState = (
  currentState: KeyboardState,
  guess: string,
  feedback: TileStatus[]
): KeyboardState => {
  const newState = { ...currentState };

  for (let i = 0; i < guess.length; i++) {
    const letter = guess[i].toUpperCase();
    const newStatus = feedback[i];
    const currentStatus = newState[letter] || TileStatus.EMPTY;

    // Priority: CORRECT > PRESENT > ABSENT > EMPTY
    if (currentStatus === TileStatus.CORRECT) {
      // Keep CORRECT, it's the highest priority
      continue;
    } else if (
      currentStatus === TileStatus.PRESENT &&
      newStatus === TileStatus.ABSENT
    ) {
      // Keep PRESENT, don't downgrade to ABSENT
      continue;
    } else {
      // Update to new status (upgrade)
      newState[letter] = newStatus;
    }
  }

  return newState;
};

/**
 * Validates if a word is acceptable for Wordle
 */
export const validateWord = (word: string): boolean => {
  return (
    word.length === GAME_CONFIG.WORD_LENGTH &&
    /^[A-Z]+$/.test(word.toUpperCase())
  );
};

/**
 * Checks if the game is won
 */
export const isGameWon = (guess: string, targetWord: string): boolean => {
  return guess.toUpperCase() === targetWord.toUpperCase();
};

/**
 * Checks if the game is lost (max attempts reached)
 */
export const isGameLost = (attempts: number): boolean => {
  return attempts >= GAME_CONFIG.MAX_ATTEMPTS;
};

/**
 * Generates share text with emoji squares
 */
export const generateShareText = (
  guesses: string[],
  feedback: TileStatus[][],
  attempts: number,
  won: boolean
): string => {
  const date = new Date().toISOString().split("T")[0];
  const result = won ? `${attempts}/${GAME_CONFIG.MAX_ATTEMPTS}` : "X/6";

  let shareText = `Wordle ${date} ${result}\n\n`;

  for (let i = 0; i < attempts; i++) {
    const row = feedback[i];
    const emojiRow = row
      .map((status) => {
        switch (status) {
          case TileStatus.CORRECT:
            return "🟩";
          case TileStatus.PRESENT:
            return "🟨";
          case TileStatus.ABSENT:
            return "⬛";
          default:
            return "⬜";
        }
      })
      .join("");
    shareText += emojiRow + "\n";
  }

  return shareText.trim();
};

/**
 * Calculate game statistics from game results
 */
export const calculateGameStats = (gameResults: any[]) => {
  const totalGames = gameResults.length;
  const totalWins = gameResults.filter((game) => game.won).length;
  const winRate =
    totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  const winningGames = gameResults.filter((game) => game.won);
  const averageAttempts =
    winningGames.length > 0
      ? Math.round(
          (winningGames.reduce((sum, game) => sum + game.attempts, 0) /
            winningGames.length) *
            10
        ) / 10
      : 0;

  // Calculate current streak (from most recent games)
  let currentStreak = 0;
  for (let i = gameResults.length - 1; i >= 0; i--) {
    if (gameResults[i].won) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Calculate max streak
  let maxStreak = 0;
  let tempStreak = 0;
  for (const game of gameResults) {
    if (game.won) {
      tempStreak++;
      maxStreak = Math.max(maxStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  // Guess distribution (how many games won in X attempts)
  const guessDistribution: { [key: number]: number } = {};
  for (let i = 1; i <= GAME_CONFIG.MAX_ATTEMPTS; i++) {
    guessDistribution[i] = gameResults.filter(
      (game) => game.won && game.attempts === i
    ).length;
  }

  return {
    totalGames,
    totalWins,
    winRate,
    averageAttempts,
    currentStreak,
    maxStreak,
    guessDistribution,
    fastestWin:
      winningGames.length > 0
        ? Math.min(...winningGames.map((g) => g.duration))
        : undefined,
  };
};

// Example of how the color/status system works in practice:
/**
 * WORDLE GAME EXAMPLE:
 * Target word: "SLATE"
 *
 * Guess 1: "STORY"
 * S -> CORRECT (green) - S is in position 0, matches target
 * T -> PRESENT (yellow) - T is in the word but wrong position (should be position 3)
 * O -> ABSENT (gray) - O is not in the word
 * R -> ABSENT (gray) - R is not in the word
 * Y -> ABSENT (gray) - Y is not in the word
 *
 * Keyboard after guess 1:
 * S: CORRECT (green)
 * T: PRESENT (yellow)
 * O, R, Y: ABSENT (gray)
 * All other letters: EMPTY (default)
 *
 * Guess 2: "SLANT"
 * S -> CORRECT (green)
 * L -> CORRECT (green)
 * A -> CORRECT (green)
 * N -> ABSENT (gray) - N not in word
 * T -> CORRECT (green) - T in correct position now
 *
 * Keyboard after guess 2:
 * S, L, A, T: CORRECT (green) - upgraded from previous states
 * N: ABSENT (gray) - new letter
 * O, R, Y: ABSENT (gray) - unchanged
 *
 * This system ensures the keyboard always shows the "best" information
 * about each letter across all guesses.
 */
