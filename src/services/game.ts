import { GameState, GuessResponse } from "@/types/game";

// services/game.ts - Fixed for browser compatibility
const getApiUrl = (): string => {
  // In production (deployed), use relative paths
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost"
  ) {
    return "/api";
  }
  // In development, use specific ports
  return "http://localhost:8002/api";
};

const API_URL = getApiUrl();

class GameService {
  // create new game
  async createGame(): Promise<GameState> {
    console.log("Creating new game via API Gateway");

    try {
      const response = await fetch(`${API_URL}/game/new`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Create game failed:", response.status, errorText);
        throw new Error(
          `Failed to create game: ${response.status} ${errorText}`
        );
      }

      const gameState: GameState = await response.json();
      console.log("Game created:", gameState.gameId);
      return gameState;
    } catch (error) {
      console.error("Network error creating game:", error);
      throw new Error("Failed to connect to game service");
    }
  }

  // submit guess for current game
  async submitGuess(gameId: string, guess: string): Promise<GuessResponse> {
    console.log(`Submitting guess for game ${gameId}: ${guess}`);

    try {
      const response = await fetch(`${API_URL}/game/${gameId}/guess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ guess }),
      });

      if (response.ok) {
        const result: GuessResponse = await response.json();

        if (!result.valid) {
          console.log(
            "Invalid word response:",
            result.error || "Not a valid word"
          );
        } else {
          console.log("Valid guess processed");
        }

        return result;
      }

      if (response.status === 400) {
        const errorData = await response.json();
        throw new Error(`Invalid request: ${errorData.error}`);
      }

      if (response.status === 404) {
        throw new Error("Game not found");
      }

      if (response.status === 503) {
        throw new Error("Game service temporarily unavailable");
      }

      const errorText = await response.text();
      console.error("Submit guess failed:", response.status, errorText);
      throw new Error(`Network error: ${response.status} ${errorText}`);
    } catch (error) {
      console.error("Network error submitting guess:", error);
      throw error;
    }
  }

  // get current game state
  async getGameState(gameId: string): Promise<GameState> {
    console.log(`Getting game state for game ${gameId}`);

    try {
      const response = await fetch(`${API_URL}/game/${gameId}`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        return response.json();
      }

      if (response.status === 404) {
        throw new Error("Game not found");
      }

      if (response.status === 400) {
        const errorData = await response.json();
        throw new Error(`Invalid request: ${errorData.error}`);
      }

      const errorText = await response.text();
      console.error("Get game state failed:", response.status, errorText);
      throw new Error(
        `Failed to get game state: ${response.status} ${errorText}`
      );
    } catch (error) {
      console.error("Network error getting game state:", error);
      throw error;
    }
  }

  // health check endpoint
  async healthCheck(): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error("Health check failed:", error);
      throw error;
    }
  }
}

export const gameService = new GameService();

/*// For local testing, use localhost
const API_URL = "http://localhost:8082/api";

export const gameApi = {
  async createGame(): Promise<{ gameId: string }> {
    const res = await fetch(`${API_URL}/game/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to create game");
    return res.json();
  },

  async submitGuess(gameId: string, guess: string): Promise<any> {
    const res = await fetch(`${API_URL}/game/${gameId}/guess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guess }),
    });
    if (!res.ok) throw new Error("Failed to submit guess");
    return res.json();
  },

  async getGameState(gameId: string): Promise<any> {
    const res = await fetch(`${API_URL}/game/${gameId}`);
    if (!res.ok) throw new Error("Failed to get game state");
    return res.json();
  },
};
*/
