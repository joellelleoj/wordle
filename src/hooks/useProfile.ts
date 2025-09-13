// hooks/useProfile.ts - Simplified for specific component needs
import { useState, useEffect, useCallback } from "react";
import { UserStats, GameRecord, GameAlbum } from "../types";
import { profileService } from "../services/profile";
import { authService } from "../services/auth";
import { logger } from "../utils/logger";

interface UseProfileOptions {
  autoLoad?: boolean;
  statsOnly?: boolean;
  gamesOnly?: boolean;
  albumsOnly?: boolean;
}

interface UseProfileReturn {
  stats: UserStats | null;
  gameHistory: GameRecord[];
  albums: GameAlbum[];
  loading: boolean;
  error: string | null;
  loadStats: () => Promise<void>;
  loadGameHistory: () => Promise<void>;
  loadAlbums: () => Promise<void>;
  clearError: () => void;
}

/**
 * Simplified profile hook for specific component needs
 * Use this when you need granular control over what data to load
 */
export const useProfile = (
  options: UseProfileOptions = {}
): UseProfileReturn => {
  const {
    autoLoad = false,
    statsOnly = false,
    gamesOnly = false,
    albumsOnly = false,
  } = options;

  const [stats, setStats] = useState<UserStats | null>(null);
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);
  const [albums, setAlbums] = useState<GameAlbum[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const loadStats = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      setError("Authentication required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userStats = await profileService.getUserStats();
      setStats(userStats);
      logger.debug("Stats loaded successfully", { userStats });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load stats";
      setError(errorMessage);
      logger.error("Failed to load stats", { error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGameHistory = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      setError("Authentication required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const history = await profileService.getGameHistory(50, 0);
      setGameHistory(history);
      logger.debug("Game history loaded successfully", {
        count: history.length,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load game history";
      setError(errorMessage);
      logger.error("Failed to load game history", { error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAlbums = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      setError("Authentication required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userAlbums = await profileService.getUserAlbums();
      setAlbums(userAlbums);
      logger.debug("Albums loaded successfully", { count: userAlbums.length });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load albums";
      setError(errorMessage);
      logger.error("Failed to load albums", { error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load data on mount if requested
  useEffect(() => {
    if (!autoLoad || !authService.isAuthenticated()) {
      return;
    }

    const loadData = async () => {
      if (statsOnly) {
        await loadStats();
      } else if (gamesOnly) {
        await loadGameHistory();
      } else if (albumsOnly) {
        await loadAlbums();
      } else {
        // Load all data
        setLoading(true);
        setError(null);

        try {
          await Promise.all([loadStats(), loadGameHistory(), loadAlbums()]);
        } catch (err) {
          logger.error("Failed to load profile data", { error: err });
        } finally {
          setLoading(false);
        }
      }
    };

    loadData();
  }, [
    autoLoad,
    statsOnly,
    gamesOnly,
    albumsOnly,
    loadStats,
    loadGameHistory,
    loadAlbums,
  ]);

  return {
    stats,
    gameHistory,
    albums,
    loading,
    error,
    loadStats,
    loadGameHistory,
    loadAlbums,
    clearError,
  };
};
