// services/profile.ts - FIXED: Correct field mapping for game recording
import { UserStats, GameRecord, GameAlbum, AlbumFormData } from "../types";
import { authService } from "./auth";
import { logger } from "../utils/logger";

class ProfileService {
  private readonly baseURL: string;

  constructor() {
    this.baseURL = this.getApiBaseUrl();
  }

  private getApiBaseUrl(): string {
    if (
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost"
    ) {
      return "/dev11/api";
    }
    return "http://localhost:8002/api";
  }

  private getAuthHeaders(): Record<string, string> {
    const token = authService.getAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    };

    logger.debug("Profile API request", {
      method: config.method || "GET",
      url,
      authenticated: !!authService.getAccessToken(),
    });

    const response = await fetch(url, config);

    if (!response.ok) {
      if (response.status === 401) {
        logger.warn("Authentication failed - clearing session");
        throw new Error("Authentication required. Please log in again.");
      }

      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `HTTP ${response.status}` };
      }

      const errorMessage =
        errorData?.message ||
        errorData?.error ||
        `Request failed: ${response.status}`;
      logger.error("Profile API request failed", {
        url,
        status: response.status,
        message: errorMessage,
        errorData,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    logger.debug("API response received", {
      endpoint,
      resultType: typeof result,
      isArray: Array.isArray(result),
      hasData: result?.data !== undefined,
      resultKeys: Object.keys(result || {}),
    });

    return result;
  }

  // Get user statistics
  async getUserStats(): Promise<UserStats> {
    try {
      logger.info("Fetching user stats");

      const response = await this.makeRequest<any>("/profile/stats");
      logger.debug("Raw stats response", { response });

      // Handle both wrapped and unwrapped responses
      let stats;
      if (response?.data) {
        stats = response.data;
      } else if (response?.userId || response?.totalGames !== undefined) {
        stats = response;
      } else {
        logger.error("Unexpected stats response format", { response });
        throw new Error("Invalid stats response format");
      }

      // Normalize the response data with better field mapping
      const normalizedStats: UserStats = {
        totalGames: parseInt(String(stats.totalGames || 0)),
        wins: parseInt(String(stats.wins || 0)),
        winRate: parseFloat(String(stats.winRate || 0)),
        currentStreak: parseInt(String(stats.currentStreak || 0)),
        maxStreak: parseInt(String(stats.maxStreak || 0)),
        averageAttempts: parseFloat(String(stats.averageAttempts || 0)),
        guessDistribution: this.normalizeGuessDistribution(
          stats.guessDistribution || {}
        ),
      };

      logger.info("User stats normalized successfully", { normalizedStats });
      return normalizedStats;
    } catch (error) {
      logger.error("Failed to fetch user stats", { error });
      throw error;
    }
  }

  // Get game history with pagination
  async getGameHistory(limit = 20, offset = 0): Promise<GameRecord[]> {
    try {
      logger.info("Fetching game history", { limit, offset });

      const response = await this.makeRequest<any>(
        `/profile/games?limit=${limit}&offset=${offset}`
      );

      logger.debug("Raw game history response", { response });

      // Handle both wrapped and unwrapped responses
      let games;
      if (response?.data && Array.isArray(response.data)) {
        games = response.data;
      } else if (Array.isArray(response)) {
        games = response;
      } else {
        logger.warn("Unexpected game history response format", { response });
        games = [];
      }

      // Normalize game data
      const normalizedGames = games.map(this.normalizeGameRecord);
      logger.info("Game history loaded successfully", {
        count: normalizedGames.length,
      });
      return normalizedGames;
    } catch (error) {
      logger.error("Failed to fetch game history", { error });
      throw error;
    }
  }

  // FIXED: Record a completed game with correct field mapping
  async recordGame(gameData: Omit<GameRecord, "id">): Promise<void> {
    try {
      logger.info("Recording game", { gameId: gameData.gameId });

      // FIXED: Map frontend fields to backend expected fields
      const backendPayload = {
        gameId: gameData.gameId,
        word: gameData.targetWord, // FIXED: Backend expects 'word', not 'targetWord'
        guesses: gameData.guesses,
        won: gameData.won,
        attempts: gameData.attempts,
        // Note: completedAt is optional, backend will set if not provided
        ...(gameData.completedAt && { completedAt: gameData.completedAt }),
      };

      logger.debug("Game recording payload", { backendPayload });

      await this.makeRequest("/profile/games", {
        method: "POST",
        body: JSON.stringify(backendPayload),
      });

      logger.info("Game recorded successfully", { gameId: gameData.gameId });
    } catch (error) {
      logger.error("Failed to record game", { gameData, error });
      throw error;
    }
  }

  // Album management
  async getUserAlbums(): Promise<GameAlbum[]> {
    try {
      logger.info("Fetching user albums");

      const response = await this.makeRequest<any>("/profile/albums");
      logger.debug("Raw albums response", { response });

      // Handle both wrapped and unwrapped responses
      let albums;
      if (response?.data && Array.isArray(response.data)) {
        albums = response.data;
      } else if (Array.isArray(response)) {
        albums = response;
      } else {
        logger.warn("Unexpected albums response format", { response });
        albums = [];
      }

      logger.info("Albums loaded successfully", {
        count: albums.length,
      });
      return albums;
    } catch (error) {
      logger.error("Failed to fetch albums", { error });
      throw error;
    }
  }

  async createAlbum(albumData: AlbumFormData): Promise<GameAlbum> {
    try {
      logger.info("Creating album", { title: albumData.title });

      // First create the album
      const response = await this.makeRequest<any>("/profile/albums", {
        method: "POST",
        body: JSON.stringify({
          title: albumData.title,
          description: albumData.description,
        }),
      });

      // Handle wrapped vs unwrapped response
      const album = response?.data || response;

      // Then add games to the album
      if (albumData.selectedGameIds && albumData.selectedGameIds.length > 0) {
        for (const gameId of albumData.selectedGameIds) {
          try {
            await this.addGameToAlbum(album.id, gameId);
          } catch (error) {
            logger.error("Failed to add game to album", {
              albumId: album.id,
              gameId,
              error,
            });
          }
        }
      }

      logger.info("Album created successfully", { albumId: album.id });
      return album;
    } catch (error) {
      logger.error("Failed to create album", { albumData, error });
      throw error;
    }
  }

  async updateAlbum(
    albumId: string,
    updates: Partial<AlbumFormData>
  ): Promise<GameAlbum> {
    try {
      logger.info("Updating album", { albumId, updates });

      // Update album metadata
      const response = await this.makeRequest<any>(
        `/profile/albums/${albumId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            title: updates.title,
            description: updates.description,
          }),
        }
      );

      const updatedAlbum = response?.data || response;

      // Handle game selection updates if provided
      if (updates.selectedGameIds) {
        const currentAlbum = await this.getAlbumWithGames(albumId);
        const currentGameIds = new Set(currentAlbum.gameIds || []);
        const newGameIds = new Set(updates.selectedGameIds);

        // Add new games
        for (const gameId of newGameIds) {
          if (!currentGameIds.has(gameId)) {
            try {
              await this.addGameToAlbum(albumId, gameId);
            } catch (error) {
              logger.error("Failed to add game during update", {
                albumId,
                gameId,
                error,
              });
            }
          }
        }

        // Remove deselected games
        for (const gameId of currentGameIds) {
          if (!newGameIds.has(gameId)) {
            try {
              await this.removeGameFromAlbum(albumId, gameId);
            } catch (error) {
              logger.error("Failed to remove game during update", {
                albumId,
                gameId,
                error,
              });
            }
          }
        }
      }

      logger.info("Album updated successfully", { albumId });
      return updatedAlbum;
    } catch (error) {
      logger.error("Failed to update album", { albumId, updates, error });
      throw error;
    }
  }

  async deleteAlbum(albumId: string): Promise<void> {
    try {
      logger.info("Deleting album", { albumId });

      await this.makeRequest(`/profile/albums/${albumId}`, {
        method: "DELETE",
      });

      logger.info("Album deleted successfully", { albumId });
    } catch (error) {
      logger.error("Failed to delete album", { albumId, error });
      throw error;
    }
  }

  async addGameToAlbum(albumId: string, gameId: string): Promise<void> {
    try {
      await this.makeRequest(`/profile/albums/${albumId}/games/${gameId}`, {
        method: "POST",
      });
    } catch (error) {
      logger.error("Failed to add game to album", { albumId, gameId, error });
      throw error;
    }
  }

  async removeGameFromAlbum(albumId: string, gameId: string): Promise<void> {
    try {
      await this.makeRequest(`/profile/albums/${albumId}/games/${gameId}`, {
        method: "DELETE",
      });
    } catch (error) {
      logger.error("Failed to remove game from album", {
        albumId,
        gameId,
        error,
      });
      throw error;
    }
  }

  async getAlbumWithGames(
    albumId: string
  ): Promise<GameAlbum & { games?: GameRecord[] }> {
    try {
      logger.info("Fetching album with games", { albumId });

      const response = await this.makeRequest<any>(
        `/profile/albums/${albumId}`
      );

      const album = response?.data || response;

      // Normalize game data if present
      if (album.games) {
        album.games = album.games.map(this.normalizeGameRecord);
      }

      return album;
    } catch (error) {
      logger.error("Failed to fetch album with games", { albumId, error });
      throw error;
    }
  }

  // Helper methods
  private normalizeGuessDistribution(distribution: any): {
    [attempts: string]: number;
  } {
    const normalized: { [attempts: string]: number } = {};

    for (let i = 1; i <= 6; i++) {
      const key = i.toString();
      const value = distribution[key] || distribution[i] || 0;
      normalized[key] =
        typeof value === "number" ? value : parseInt(String(value || 0));
    }

    return normalized;
  }

  private normalizeGameRecord = (game: any): GameRecord => {
    return {
      gameId: game.gameId || game.game_id || game.id || "",
      targetWord: game.targetWord || game.target_word || game.word || "UNKNOWN",
      guesses: Array.isArray(game.guesses) ? game.guesses : [],
      won: Boolean(game.won),
      attempts: parseInt(String(game.attempts || 0)),
      completedAt:
        game.completedAt ||
        game.completed_at ||
        game.date ||
        new Date().toISOString(),
    };
  };
}

export const profileService = new ProfileService();
/*// services/profile.ts - FIXED: Correct field mapping for game recording
import { UserStats, GameRecord, GameAlbum, AlbumFormData } from "../types";
import { authService } from "./auth";
import { logger } from "../utils/logger";

class ProfileService {
  private readonly baseURL: string;

  constructor() {
    this.baseURL = this.getApiBaseUrl();
  }

  private getApiBaseUrl(): string {
    if (
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost"
    ) {
      return "/dev11/api";
    }
    return "http://localhost:8002/api";
  }

  private getAuthHeaders(): Record<string, string> {
    const token = authService.getAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    };

    logger.debug("Profile API request", {
      method: config.method || "GET",
      url,
      authenticated: !!authService.getAccessToken(),
    });

    const response = await fetch(url, config);

    if (!response.ok) {
      if (response.status === 401) {
        logger.warn("Authentication failed - clearing session");
        throw new Error("Authentication required. Please log in again.");
      }

      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `HTTP ${response.status}` };
      }

      const errorMessage =
        errorData?.message ||
        errorData?.error ||
        `Request failed: ${response.status}`;
      logger.error("Profile API request failed", {
        url,
        status: response.status,
        message: errorMessage,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    logger.debug("API response received", {
      endpoint,
      resultType: typeof result,
      isArray: Array.isArray(result),
      hasData: result?.data !== undefined,
      resultKeys: Object.keys(result || {}),
    });

    return result;
  }

  // FIXED: Record a completed game with correct field mapping
  async recordGame(gameData: Omit<GameRecord, "id">): Promise<void> {
    try {
      logger.info("Recording game", { gameId: gameData.gameId });

      // FIXED: Map frontend fields to backend expected fields
      const backendGameData = {
        gameId: gameData.gameId,
        word: gameData.targetWord, // Backend expects 'word' not 'targetWord'
        guesses: gameData.guesses,
        won: gameData.won,
        attempts: gameData.attempts,
        // Convert completedAt to date format if needed
        date: gameData.completedAt
          ? new Date(gameData.completedAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      };

      logger.debug("Mapped game data for backend", {
        original: gameData,
        mapped: backendGameData,
      });

      await this.makeRequest("/profile/games", {
        method: "POST",
        body: JSON.stringify(backendGameData),
      });

      logger.info("Game recorded successfully", { gameId: gameData.gameId });
    } catch (error) {
      logger.error("Failed to record game", { gameData, error });
      throw error;
    }
  }

  // Get user statistics
  async getUserStats(): Promise<UserStats> {
    try {
      logger.info("Fetching user stats");

      const response = await this.makeRequest<any>("/profile/stats");
      logger.debug("Raw stats response", { response });

      // Handle both wrapped and unwrapped responses
      let stats;
      if (response?.data) {
        stats = response.data;
      } else if (response?.userId || response?.totalGames !== undefined) {
        stats = response;
      } else {
        logger.error("Unexpected stats response format", { response });
        throw new Error("Invalid stats response format");
      }

      // Normalize the response data
      const normalizedStats: UserStats = {
        totalGames: parseInt(String(stats.totalGames || 0)),
        wins: parseInt(String(stats.wins || 0)),
        winRate: parseFloat(String(stats.winRate || 0)),
        currentStreak: parseInt(String(stats.currentStreak || 0)),
        maxStreak: parseInt(String(stats.maxStreak || 0)),
        averageAttempts: parseFloat(String(stats.averageAttempts || 0)),
        guessDistribution: this.normalizeGuessDistribution(
          stats.guessDistribution || {}
        ),
      };

      logger.info("User stats normalized successfully", { normalizedStats });
      return normalizedStats;
    } catch (error) {
      logger.error("Failed to fetch user stats", { error });
      throw error;
    }
  }

  // Get game history with pagination
  async getGameHistory(limit = 20, offset = 0): Promise<GameRecord[]> {
    try {
      logger.info("Fetching game history", { limit, offset });

      const response = await this.makeRequest<any>(
        `/profile/games?limit=${limit}&offset=${offset}`
      );

      logger.debug("Raw game history response", { response });

      // Handle both wrapped and unwrapped responses
      let games;
      if (response?.data && Array.isArray(response.data)) {
        games = response.data;
      } else if (Array.isArray(response)) {
        games = response;
      } else if (response?.games && Array.isArray(response.games)) {
        // Additional fallback for different response format
        games = response.games;
      } else {
        logger.warn("Unexpected game history response format", { response });
        games = [];
      }

      // Normalize game data
      const normalizedGames = games.map(this.normalizeGameRecord);
      logger.info("Game history loaded successfully", {
        count: normalizedGames.length,
      });
      return normalizedGames;
    } catch (error) {
      logger.error("Failed to fetch game history", { error });
      throw error;
    }
  }

  // Album management methods remain the same...
  async getUserAlbums(): Promise<GameAlbum[]> {
    try {
      logger.info("Fetching user albums");

      const response = await this.makeRequest<any>("/profile/albums");
      logger.debug("Raw albums response", { response });

      let albums;
      if (response?.data && Array.isArray(response.data)) {
        albums = response.data;
      } else if (Array.isArray(response)) {
        albums = response;
      } else {
        logger.warn("Unexpected albums response format", { response });
        albums = [];
      }

      logger.info("Albums loaded successfully", {
        count: albums.length,
      });
      return albums;
    } catch (error) {
      logger.error("Failed to fetch albums", { error });
      throw error;
    }
  }

  async createAlbum(albumData: AlbumFormData): Promise<GameAlbum> {
    try {
      logger.info("Creating album", { title: albumData.title });

      const response = await this.makeRequest<any>("/profile/albums", {
        method: "POST",
        body: JSON.stringify({
          title: albumData.title,
          description: albumData.description,
        }),
      });

      const album = response?.data || response;

      if (albumData.selectedGameIds && albumData.selectedGameIds.length > 0) {
        for (const gameId of albumData.selectedGameIds) {
          try {
            await this.addGameToAlbum(album.id, gameId);
          } catch (error) {
            logger.error("Failed to add game to album", {
              albumId: album.id,
              gameId,
              error,
            });
          }
        }
      }

      logger.info("Album created successfully", { albumId: album.id });
      return album;
    } catch (error) {
      logger.error("Failed to create album", { albumData, error });
      throw error;
    }
  }

  async updateAlbum(
    albumId: string,
    updates: Partial<AlbumFormData>
  ): Promise<GameAlbum> {
    try {
      logger.info("Updating album", { albumId, updates });

      const response = await this.makeRequest<any>(
        `/profile/albums/${albumId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            title: updates.title,
            description: updates.description,
          }),
        }
      );

      const updatedAlbum = response?.data || response;

      if (updates.selectedGameIds) {
        const currentAlbum = await this.getAlbumWithGames(albumId);
        const currentGameIds = new Set(currentAlbum.gameIds || []);
        const newGameIds = new Set(updates.selectedGameIds);

        // Add new games
        for (const gameId of newGameIds) {
          if (!currentGameIds.has(gameId)) {
            try {
              await this.addGameToAlbum(albumId, gameId);
            } catch (error) {
              logger.error("Failed to add game during update", {
                albumId,
                gameId,
                error,
              });
            }
          }
        }

        // Remove deselected games
        for (const gameId of currentGameIds) {
          if (!newGameIds.has(gameId)) {
            try {
              await this.removeGameFromAlbum(albumId, gameId);
            } catch (error) {
              logger.error("Failed to remove game during update", {
                albumId,
                gameId,
                error,
              });
            }
          }
        }
      }

      logger.info("Album updated successfully", { albumId });
      return updatedAlbum;
    } catch (error) {
      logger.error("Failed to update album", { albumId, updates, error });
      throw error;
    }
  }

  async deleteAlbum(albumId: string): Promise<void> {
    try {
      logger.info("Deleting album", { albumId });

      await this.makeRequest(`/profile/albums/${albumId}`, {
        method: "DELETE",
      });

      logger.info("Album deleted successfully", { albumId });
    } catch (error) {
      logger.error("Failed to delete album", { albumId, error });
      throw error;
    }
  }

  async addGameToAlbum(albumId: string, gameId: string): Promise<void> {
    try {
      await this.makeRequest(`/profile/albums/${albumId}/games/${gameId}`, {
        method: "POST",
      });
    } catch (error) {
      logger.error("Failed to add game to album", { albumId, gameId, error });
      throw error;
    }
  }

  async removeGameFromAlbum(albumId: string, gameId: string): Promise<void> {
    try {
      await this.makeRequest(`/profile/albums/${albumId}/games/${gameId}`, {
        method: "DELETE",
      });
    } catch (error) {
      logger.error("Failed to remove game from album", {
        albumId,
        gameId,
        error,
      });
      throw error;
    }
  }

  async getAlbumWithGames(
    albumId: string
  ): Promise<GameAlbum & { games?: GameRecord[] }> {
    try {
      logger.info("Fetching album with games", { albumId });

      const response = await this.makeRequest<any>(
        `/profile/albums/${albumId}`
      );

      const album = response?.data || response;

      if (album.games) {
        album.games = album.games.map(this.normalizeGameRecord);
      }

      return album;
    } catch (error) {
      logger.error("Failed to fetch album with games", { albumId, error });
      throw error;
    }
  }

  // Helper methods
  private normalizeGuessDistribution(distribution: any): {
    [attempts: string]: number;
  } {
    const normalized: { [attempts: string]: number } = {};

    for (let i = 1; i <= 6; i++) {
      const key = i.toString();
      const value = distribution[key] || distribution[i] || 0;
      normalized[key] =
        typeof value === "number" ? value : parseInt(String(value || 0));
    }

    return normalized;
  }

  // FIXED: Better field mapping for game records
  private normalizeGameRecord = (game: any): GameRecord => {
    return {
      gameId: game.gameId || game.game_id || game.id || "",
      targetWord: game.targetWord || game.target_word || game.word || "UNKNOWN",
      guesses: Array.isArray(game.guesses) ? game.guesses : [],
      won: Boolean(game.won),
      attempts: parseInt(String(game.attempts || 0)),
      completedAt:
        game.completedAt ||
        game.completed_at ||
        game.date ||
        new Date().toISOString(),
    };
  };
}

export const profileService = new ProfileService();

import { GameRecord, UserStats } from "@/types/profile";
// API URL configuration for browser environment
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

export class ProfileService {
  private readonly API_BASE_URL: string;

  constructor() {
    this.API_BASE_URL = getApiUrl();
  }

  async getUserStats(userId: number | string): Promise<UserStats> {
    try {
      const response = await fetch(
        `${this.API_BASE_URL}/profile/stats/${userId.toString()}`
      );
      const result = await response.json();

      if (result.success) {
        return result.data;
      }

      return {
        wins: 0,
        losses: 0,
        streak: 0,
        averageGuesses: 0,
        gamesPlayed: 0,
        winRate: 0,
        currentStreak: 0,
        maxStreak: 0,
        guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      };
    } catch (error) {
      console.error("Failed to fetch user stats:", error);
      return {
        wins: 0,
        losses: 0,
        streak: 0,
        averageGuesses: 0,
        gamesPlayed: 0,
        winRate: 0,
        currentStreak: 0,
        maxStreak: 0,
        guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      };
    }
  }

  async getGameHistory(userId: number | string): Promise<GameRecord[]> {
    try {
      const response = await fetch(
        `${this.API_BASE_URL}/profile/games/${userId.toString()}`
      );
      const result = await response.json();

      if (result.success) {
        return result.data;
      }

      return [];
    } catch (error) {
      console.error("Failed to fetch game history:", error);
      return [];
    }
  }
}

export const profileService = new ProfileService();


const getApiUrl = (): string => {
  if (process.env.NODE_ENV === "production") {
    return "/api";
  }
  return "http://localhost:8082/api";
};

const API_URL = getApiUrl();

export interface UserStats {
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  averageGuesses: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: Record<string, number>;
}

export interface GameRecord {
  gameId: string;
  targetWord: string;
  attempts: number;
  won: boolean;
  guessPattern: string[][];
  completedAt: string;
}

export interface GamePost {
  id: string;
  userId: string;
  username: string;
  gameId: string;
  targetWord: string;
  attempts: number;
  won: boolean;
  guessPattern: string[][];
  comment: string;
  likes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostData {
  gameId: string;
  targetWord: string;
  attempts: number;
  won: boolean;
  guessPattern: string[][];
  comment: string;
}

class ProfileService {

  async getUserStats(userId: string): Promise<UserStats> {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_URL}/users/${userId}/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user stats");
    }

    const data = await response.json();
    return data.stats;
  }


  async getGameHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<GameRecord[]> {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(
      `${API_URL}/users/${userId}/games?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch game history");
    }

    const data = await response.json();
    return data.games;
  }


  async recordGame(
    userId: string,
    gameData: {
      gameId: string;
      targetWord: string;
      guesses: string[][];
      won: boolean;
      attempts: number;
    }
  ): Promise<void> {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_URL}/users/${userId}/games`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gameData),
    });

    if (!response.ok) {
      throw new Error("Failed to record game");
    }
  }


  async createPost(postData: CreatePostData): Promise<GamePost> {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_URL}/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      throw new Error("Failed to create post");
    }

    return response.json();
  }


  async togglePostLike(postId: string): Promise<GamePost> {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_URL}/posts/${postId}/like`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to toggle post like");
    }

    return response.json();
  }


  async getUserPosts(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<GamePost[]> {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(
      `${API_URL}/users/${userId}/posts?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch user posts");
    }

    const data = await response.json();
    return data.posts;
  }
}

export const profileService = new ProfileService();
*/
