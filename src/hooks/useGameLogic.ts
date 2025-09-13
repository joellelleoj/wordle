import { useState, useCallback, useRef, useEffect } from "react";
import { GameState, GuessResponse, TileState } from "../types";
import { gameService } from "../services/game";
import { profileService } from "../services/profile";
import { gameSessionService } from "../services/gameSession";
import { authService } from "../services/auth";
import { logger } from "../utils/logger";

interface UseGameLogicProps {
  onGameComplete?: (gameData: any) => void;
  onSessionUpdate?: (sessionData: any) => void;
}

interface UseGameLogicReturn {
  // Game state
  gameState: GameState | null;
  loading: boolean;
  error: string | null;

  // Animation states
  shakingRow: number | null;
  poppingTile: { row: number; col: number } | null;

  // Keyboard state
  usedLetters: Map<string, TileState>;

  // Game result state
  showGameResult: boolean;
  gameResult: {
    won: boolean;
    solution?: string;
  } | null;

  // Actions
  handleKeyPress: (key: string) => Promise<void>;
  startNewGame: () => Promise<void>;
  resetError: () => void;
}

export const useGameLogic = ({
  onGameComplete,
  onSessionUpdate,
}: UseGameLogicProps = {}): UseGameLogicReturn => {
  // Game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animation states
  const [shakingRow, setShakingRow] = useState<number | null>(null);
  const [poppingTile, setPoppingTile] = useState<{
    row: number;
    col: number;
  } | null>(null);

  // Game result display state
  const [showGameResult, setShowGameResult] = useState(false);
  const [gameResult, setGameResult] = useState<{
    won: boolean;
    solution?: string;
  } | null>(null);

  // Keyboard state
  const [usedLetters, setUsedLetters] = useState<Map<string, TileState>>(
    new Map()
  );

  // Refs for debouncing and cleanup
  const lastInputTimeRef = useRef<number>(0);
  const pendingRequestRef = useRef<AbortController | null>(null);
  const gameResultTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  const INPUT_DEBOUNCE_MS = 100;

  // Flip animation timing constants
  const FLIP_ANIMATION_DELAY = 1200; // Last tile starts at 1200ms
  const FLIP_ANIMATION_DURATION = 600; // Each flip takes 600ms
  const TOTAL_FLIP_TIME = FLIP_ANIMATION_DELAY + FLIP_ANIMATION_DURATION; // 1800ms total

  // Initialize game
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      initializeGame();
    }

    return () => {
      // Cleanup on unmount
      if (pendingRequestRef.current) {
        pendingRequestRef.current.abort();
      }
      if (gameResultTimeoutRef.current) {
        clearTimeout(gameResultTimeoutRef.current);
      }
    };
  }, []);

  // Update keyboard state when evaluations change
  useEffect(() => {
    if (!gameState) return;

    const newUsedLetters = new Map<string, TileState>();

    gameState.board.forEach((row, i) => {
      row.forEach((letter, j) => {
        if (letter && gameState.evaluations[i] && gameState.evaluations[i][j]) {
          const current = newUsedLetters.get(letter);
          const newStatus = gameState.evaluations[i][j];

          // Prioritize correct > present > absent
          if (
            !current ||
            (current === "absent" && newStatus !== "absent") ||
            (current === "present" && newStatus === "correct")
          ) {
            newUsedLetters.set(letter, newStatus);
          }
        }
      });
    });

    setUsedLetters(newUsedLetters);
  }, [gameState?.evaluations]);

  // FIXED: Save session when game state changes with proper type conversion
  useEffect(() => {
    if (gameState && !gameState.gameOver && onSessionUpdate) {
      const user = authService.getCurrentUser();
      if (user) {
        const sessionData = {
          gameId: gameState.gameId,
          gameState: {
            board: gameState.board,
            evaluations: gameState.evaluations,
            currentRow: gameState.currentRow,
            gameOver: gameState.gameOver,
            won: gameState.won,
            attempts: gameState.attempts,
            guesses: gameState.guesses,
          },
          timestamp: new Date().toISOString(),
          userId: user.id,
        };

        // FIXED: Convert user.id to string for gameSessionService
        gameSessionService.saveGameSession(sessionData, user.id);
        onSessionUpdate(sessionData);
      }
    }
  }, [gameState, onSessionUpdate]);

  const initializeGame = async () => {
    const user = authService.getCurrentUser();
    if (!user) {
      setError("Authentication required to play");
      return;
    }

    setLoading(true);
    setError(null);
    setShowGameResult(false);
    setGameResult(null);

    try {
      // FIXED: Try to restore existing session with proper type conversion
      const savedSession = gameSessionService.loadGameSession(user.id);

      if (
        savedSession &&
        savedSession.gameId &&
        !savedSession.gameState.gameOver
      ) {
        try {
          const serverGameState = await gameService.getGameState(
            savedSession.gameId
          );

          // Double-check the server state isn't completed
          if (!serverGameState.gameOver) {
            setGameState(serverGameState);
            logger.info("Active game session restored", {
              gameId: savedSession.gameId,
            });
            return;
          } else {
            // Server says game is complete, clear the session and create new game
            logger.info("Restored session was completed on server, clearing", {
              gameId: savedSession.gameId,
            });
            // FIXED: Pass user.id with proper type conversion
            gameSessionService.clearGameSession(user.id);
          }
        } catch (error) {
          logger.warn("Could not restore session, creating new game", {
            error,
          });
          // FIXED: Pass user.id with proper type conversion
          gameSessionService.clearGameSession(user.id);
        }
      }

      // Create new game (either no session found or session was completed)
      const newGameState = await gameService.createGame();
      setGameState(newGameState);
      setUsedLetters(new Map());
      logger.info("New game created", { gameId: newGameState.gameId });
    } catch (error: any) {
      logger.error("Failed to initialize game", { error });
      setError(`Failed to initialize game: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startNewGame = useCallback(async () => {
    const user = authService.getCurrentUser();
    if (!user) {
      setError("Authentication required to play");
      return;
    }

    setLoading(true);
    setError(null);
    setShowGameResult(false);
    setGameResult(null);

    // Clear any pending game result timeout
    if (gameResultTimeoutRef.current) {
      clearTimeout(gameResultTimeoutRef.current);
      gameResultTimeoutRef.current = null;
    }

    try {
      // FIXED: Clear existing session with proper type conversion
      gameSessionService.clearGameSession(user.id);

      const newGameState = await gameService.createGame();
      setGameState(newGameState);
      setUsedLetters(new Map());
      logger.info("New game started", { gameId: newGameState.gameId });
    } catch (error: any) {
      logger.error("Failed to start new game", { error });
      setError("Failed to start new game. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKeyPress = useCallback(
    async (key: string): Promise<void> => {
      // Debounce input
      const now = Date.now();
      if (now - lastInputTimeRef.current < INPUT_DEBOUNCE_MS) {
        return;
      }
      lastInputTimeRef.current = now;

      if (!gameState || gameState.gameOver || loading || showGameResult) return;

      if (key === "ENTER") {
        await handleEnterKey();
      } else if (key === "BACKSPACE") {
        handleBackspaceKey();
      } else if (/^[A-Z]$/.test(key)) {
        handleLetterKey(key);
      }
    },
    [gameState, loading, showGameResult]
  );

  const handleEnterKey = async (): Promise<void> => {
    if (!gameState) return;

    const currentRowLetters = gameState.board[gameState.currentRow];
    const completedLetters = currentRowLetters.filter(
      (letter) => letter !== ""
    ).length;

    if (completedLetters !== 5) return;

    const guess = currentRowLetters.join("");

    // Cancel previous request
    if (pendingRequestRef.current) {
      pendingRequestRef.current.abort();
    }

    const controller = new AbortController();
    pendingRequestRef.current = controller;
    setLoading(true);

    try {
      const response = await gameService.submitGuess(gameState.gameId, guess);

      if (controller.signal.aborted) return;

      if (!response.valid) {
        setShakingRow(gameState.currentRow);
        setTimeout(() => setShakingRow(null), 600);
        return;
      }

      if (response.gameState) {
        setGameState(response.gameState);
      }

      if (response.gameOver) {
        // FIXED: Clear session immediately with proper type conversion
        const user = authService.getCurrentUser();
        if (user) {
          gameSessionService.clearGameSession(user.id);
        }

        // Set game result data but don't show it yet
        setGameResult({
          won: response.won || false,
          solution: response.solution,
        });

        // Delay showing the result until flip animation completes
        gameResultTimeoutRef.current = setTimeout(() => {
          setShowGameResult(true);
          handleGameCompletion(response);
        }, TOTAL_FLIP_TIME);
      }
    } catch (error: any) {
      if (error.name === "AbortError") return;

      logger.error("Failed to submit guess", { error, guess });
      setError("Failed to submit guess. Please try again.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
      pendingRequestRef.current = null;
    }
  };

  const handleBackspaceKey = (): void => {
    if (!gameState || gameState.currentRow >= 6) return;

    const currentRowLetters = [...gameState.board[gameState.currentRow]];
    let lastLetterIndex = -1;

    for (let i = currentRowLetters.length - 1; i >= 0; i--) {
      if (currentRowLetters[i] !== "") {
        lastLetterIndex = i;
        break;
      }
    }

    if (lastLetterIndex >= 0) {
      currentRowLetters[lastLetterIndex] = "";
      const updatedBoard = [...gameState.board];
      updatedBoard[gameState.currentRow] = currentRowLetters;
      setGameState({ ...gameState, board: updatedBoard });
    }
  };

  const handleLetterKey = (key: string): void => {
    if (!gameState || gameState.currentRow >= 6) return;

    const currentRowLetters = [...gameState.board[gameState.currentRow]];
    const nextEmptyIndex = currentRowLetters.findIndex(
      (letter) => letter === ""
    );

    if (nextEmptyIndex >= 0) {
      currentRowLetters[nextEmptyIndex] = key;
      const updatedBoard = [...gameState.board];
      updatedBoard[gameState.currentRow] = currentRowLetters;
      setGameState({ ...gameState, board: updatedBoard });

      setPoppingTile({ row: gameState.currentRow, col: nextEmptyIndex });
      setTimeout(() => setPoppingTile(null), 200);
    }
  };

  const handleGameCompletion = async (
    response: GuessResponse
  ): Promise<void> => {
    const user = authService.getCurrentUser();
    if (!user) return;

    const gameData = {
      gameId: response.gameState?.gameId || gameState?.gameId || "",
      targetWord: response.solution || "UNKNOWN",
      guesses: response.gameState?.guesses || [],
      won: response.won || false,
      attempts: response.gameState?.attempts || 0,
      completedAt: new Date().toISOString(),
    };

    try {
      // Record game to profile
      await profileService.recordGame(gameData);
      logger.info("Game recorded successfully", { gameId: gameData.gameId });

      // Notify parent component
      if (onGameComplete) {
        onGameComplete(gameData);
      }

      logger.info("Game completion handled", {
        won: response.won,
        gameId: gameData.gameId,
      });
    } catch (error) {
      logger.error("Failed to record game", { error, gameData });
    }
  };

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  return {
    gameState,
    loading,
    error,
    shakingRow,
    poppingTile,
    usedLetters,
    showGameResult,
    gameResult,
    handleKeyPress,
    startNewGame,
    resetError,
  };
};
