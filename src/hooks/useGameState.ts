import { useState, useCallback, useRef, useEffect } from "react";
import { GameState, LoadingState, UseGameStateReturn } from "../types";
import { gameService } from "../services/game";
import { logger } from "../utils/logger";

export const useGameState = (initialGameId?: string): UseGameStateReturn => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Prevent race conditions and memory leaks
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Submit guess with optimized error handling
  const submitGuess = useCallback(
    async (guess: string): Promise<void> => {
      if (!gameState || gameState.gameOver || loading === "loading") {
        return;
      }

      // Cancel previous request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setLoading("loading");
      setError(null);

      try {
        const response = await gameService.submitGuess(gameState.gameId, guess);

        if (!isMountedRef.current) return;

        if (response.valid && response.gameState) {
          setGameState(response.gameState);
          setLoading("success");
        } else {
          setLoading("idle");
          // Don't set error for invalid words - handled by UI feedback
        }
      } catch (err) {
        if (!isMountedRef.current) return;

        const errorMessage =
          err instanceof Error ? err.message : "Failed to submit guess";
        logger.error("Submit guess failed", {
          gameId: gameState.gameId,
          guess,
          error: err,
        });
        setError(errorMessage);
        setLoading("error");
      }
    },
    [gameState, loading]
  );

  // Start new game
  const startNewGame = useCallback(async (): Promise<void> => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setLoading("loading");
    setError(null);

    try {
      const newGameState = await gameService.createGame();

      if (!isMountedRef.current) return;

      setGameState(newGameState);
      setLoading("success");
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMessage =
        err instanceof Error ? err.message : "Failed to create game";
      logger.error("Create game failed", { error: err });
      setError(errorMessage);
      setLoading("error");
    }
  }, []);

  // Load existing game state
  const loadGameState = useCallback(async (gameId: string): Promise<void> => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setLoading("loading");
    setError(null);

    try {
      const existingGameState = await gameService.getGameState(gameId);

      if (!isMountedRef.current) return;

      setGameState(existingGameState);
      setLoading("success");
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMessage =
        err instanceof Error ? err.message : "Failed to load game";
      logger.error("Load game failed", { gameId, error: err });
      setError(errorMessage);
      setLoading("error");
    }
  }, []);

  return {
    gameState,
    loading: loading === "loading",
    error,
    actions: {
      submitGuess,
      startNewGame,
      loadGameState,
    },
  };
};
