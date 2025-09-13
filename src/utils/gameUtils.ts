// utils/gameUtils.ts - Game-related utility functions
import { GameRecord, GameVisualization } from "../types";

/**
 * Generate a visual representation of a completed game
 */
export const generateGameVisualization = (
  game: GameRecord
): GameVisualization => {
  const word = game.targetWord.toUpperCase();
  const board: string[][] = Array(6)
    .fill(null)
    .map(() => Array(5).fill(""));
  const colors: string[][] = Array(6)
    .fill(null)
    .map(() => Array(5).fill(""));

  if (game.guesses && Array.isArray(game.guesses)) {
    game.guesses.forEach((guess, rowIndex) => {
      if (rowIndex < 6 && guess && guess.length === 5) {
        for (let i = 0; i < 5; i++) {
          board[rowIndex][i] = guess[i].toUpperCase();

          // Calculate tile colors
          if (word[i] === guess[i].toUpperCase()) {
            colors[rowIndex][i] = "correct";
          } else if (word.includes(guess[i].toUpperCase())) {
            colors[rowIndex][i] = "present";
          } else {
            colors[rowIndex][i] = "absent";
          }
        }
      }
    });
  }

  return {
    board,
    colors,
    metadata: {
      word,
      attempts: game.attempts,
      won: game.won,
    },
  };
};

/**
 * Format a date string for display
 */
export const formatGameDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString();
  } catch {
    return "Invalid date";
  }
};

/**
 * Get a formatted result string for a game
 */
export const getGameResult = (won: boolean, attempts: number): string => {
  if (won) {
    return `Won in ${attempts}/6`;
  } else {
    return `Lost (${attempts}/6)`;
  }
};

/**
 * Calculate win percentage
 */
export const calculateWinRate = (wins: number, totalGames: number): number => {
  if (totalGames === 0) return 0;
  return Math.round((wins / totalGames) * 100);
};

/**
 * Get display text for streak
 */
export const getStreakText = (streak: number): string => {
  if (streak === 0) return "No streak";
  if (streak === 1) return "1 game";
  return `${streak} games`;
};
