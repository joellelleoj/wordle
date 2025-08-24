import { apiClient } from "./apiClient";
import { TileStatus, GameStatus } from "../../types/game";
import { API_ENDPOINTS } from "../utils/constants";

interface NewGameResponse {
  gameId: string;
  word: string; // Only for development - hidden in production
  status: GameStatus;
}

interface GuessResponse {
  isValidWord: boolean;
  feedback: TileStatus[];
  gameStatus: GameStatus;
  isCorrect: boolean;
  attempts: number;
}

interface CurrentGameResponse {
  gameId: string;
  attempts: number;
  status: GameStatus;
  guesses: {
    word: string;
    feedback: { letter: string; status: TileStatus; position: number }[];
  }[];
}

/**
 * Game Service - API communication for game operations
 *
 * Implements:
 * - RESTful API Communication via API Gateway
 * - Single Responsibility: Game-related API calls only
 * - Stateless: No service-side state storage
 * - API Gateway Pattern: All requests go through /api gateway
 */
export const gameService = {
  /**
   * Start a new game
   */
  async startNewGame(token: string): Promise<NewGameResponse> {
    const response = await apiClient.post<NewGameResponse>(
      API_ENDPOINTS.GAME.NEW_GAME,
      {},
      { token }
    );
    return response.data!;
  },

  /**
   * Submit a guess
   */
  async submitGuess(
    token: string,
    gameId: string,
    guess: string
  ): Promise<GuessResponse> {
    const response = await apiClient.post<GuessResponse>(
      API_ENDPOINTS.GAME.GUESS,
      { gameId, guess: guess.toUpperCase() },
      { token }
    );
    return response.data!;
  },

  /**
   * Get current active game
   */
  async getCurrentGame(token: string): Promise<CurrentGameResponse | null> {
    try {
      const response = await apiClient.get<CurrentGameResponse>(
        API_ENDPOINTS.GAME.CURRENT,
        { token }
      );
      return response.data || null;
    } catch (err: any) {
      // No current game found
      if (err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  },

  /**
   * Validate word exists in dictionary
   */
  async validateWord(word: string): Promise<boolean> {
    try {
      const response = await apiClient.post<{ valid: boolean }>(
        API_ENDPOINTS.GAME.VALIDATE,
        { word: word.toUpperCase() }
      );
      return response.data?.valid || false;
    } catch (err) {
      return false;
    }
  },

  /**
   * Get word definition (bonus feature)
   */
  async getWordDefinition(word: string): Promise<string | null> {
    try {
      const response = await apiClient.get<{ definition: string }>(
        `${API_ENDPOINTS.GAME.DICTIONARY}/${word.toUpperCase()}`
      );
      return response.data?.definition || null;
    } catch (err) {
      return null;
    }
  },
};
