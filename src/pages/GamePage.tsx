// pages/GamePage.tsx - Fixed initialization and loading issues
import { useState, useEffect, useCallback, JSX, useRef } from "react";
import { Board } from "../components/game/Board";
import { Keyboard } from "../components/game/Keyboard";
import { gameService, GameState } from "../services/game";
import { authService } from "../services/auth";
import { GameSessionData, gameSessionService } from "../services/gameSession";

interface GamePageProps {
  initialGameSession?: GameSessionData | null;
  onGameSessionUpdate?: (sessionData: GameSessionData) => void;
  onGameComplete?: (gameData: any) => void;
  gameId?: string;
  isSessionLoaded?: boolean;
}

export function GamePage({
  initialGameSession,
  onGameSessionUpdate,
  onGameComplete,
  gameId: urlGameId,
  isSessionLoaded = true,
}: GamePageProps): JSX.Element {
  // Game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Animation states
  const [shakingRow, setShakingRow] = useState<number | null>(null);
  const [poppingTile, setPoppingTile] = useState<{
    row: number;
    col: number;
  } | null>(null);

  // Keyboard state
  const [usedLetters, setUsedLetters] = useState<
    Map<string, "correct" | "present" | "absent">
  >(new Map());

  // Race condition prevention
  const pendingRequestRef = useRef<AbortController | null>(null);
  const lastSessionUpdateRef = useRef<string>("");
  const initializationRef = useRef<boolean>(false);

  // Input debouncing
  const lastInputTimeRef = useRef<number>(0);
  const INPUT_DEBOUNCE_MS = 50;

  // Initialize game ONCE when component mounts
  useEffect(() => {
    if (initializationRef.current) return; // Prevent multiple initialization

    initializationRef.current = true;
    console.log("GamePage initializing...");

    const initializeGame = async () => {
      if (!authService.isAuthenticated()) {
        setError("Please log in to play");
        setInitialized(true);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const currentUser = authService.getCurrentUser();
        console.log("Authenticated user:", currentUser?.username);

        // Try to restore from initialGameSession first
        if (initialGameSession && initialGameSession.gameId) {
          console.log(
            "Restoring from initial session:",
            initialGameSession.gameId
          );
          try {
            const serverGameState = await gameService.getGameState(
              initialGameSession.gameId
            );
            setGameState(serverGameState);
            setInitialized(true);
            return;
          } catch (error) {
            console.log(
              "Could not restore from initial session, creating new game"
            );
          }
        }

        // Try URL gameId
        if (urlGameId) {
          console.log("Attempting to load game from URL:", urlGameId);
          try {
            const existingGameState = await gameService.getGameState(urlGameId);
            setGameState(existingGameState);
            setInitialized(true);
            return;
          } catch (error) {
            console.log("Game from URL not found, creating new game");
          }
        }

        // Try to load from saved session storage
        if (currentUser) {
          const savedSession = gameSessionService.loadGameSession(
            currentUser.id
          );
          if (savedSession && savedSession.gameId) {
            console.log(
              "Attempting to restore from saved session:",
              savedSession.gameId
            );
            try {
              const serverGameState = await gameService.getGameState(
                savedSession.gameId
              );
              setGameState(serverGameState);
              setInitialized(true);
              return;
            } catch (error) {
              console.log("Saved session game not found, creating new game");
            }
          }
        }

        // Create new game as last resort
        console.log("Creating new game...");
        const newGameState = await gameService.createGame();
        console.log("✅ New game created successfully:", newGameState.gameId);
        setGameState(newGameState);
        setUsedLetters(new Map());
      } catch (error: any) {
        console.error("Failed to initialize game:", error);
        setError(`Failed to initialize game: ${error.message}`);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initializeGame();

    // Cleanup function
    return () => {
      if (pendingRequestRef.current) {
        pendingRequestRef.current.abort();
      }
    };
  }, []); // Empty dependency array - run only once

  // Update session when game state changes
  useEffect(() => {
    if (
      gameState &&
      onGameSessionUpdate &&
      !gameState.gameOver &&
      initialized
    ) {
      const stateKey = `${gameState.gameId}-${gameState.currentRow}-${gameState.gameOver}`;

      if (stateKey !== lastSessionUpdateRef.current) {
        lastSessionUpdateRef.current = stateKey;

        const currentUser = authService.getCurrentUser();
        if (currentUser) {
          const sessionData: GameSessionData = {
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
            userId: currentUser.id,
          };

          onGameSessionUpdate(sessionData);
        }
      }
    }
  }, [gameState, onGameSessionUpdate, initialized]);

  // Update keyboard state based on game evaluations
  useEffect(() => {
    if (!gameState || !initialized) return;

    const newUsedLetters = new Map<string, "correct" | "present" | "absent">();

    gameState.board.forEach((row, i) => {
      row.forEach((letter, j) => {
        if (letter && gameState.evaluations[i] && gameState.evaluations[i][j]) {
          const current = newUsedLetters.get(letter);
          const newStatus = gameState.evaluations[i][j];

          if (
            !current ||
            (current === "absent" && newStatus !== "absent") ||
            (current === "present" && newStatus === "correct")
          ) {
            newUsedLetters.set(
              letter,
              newStatus as "correct" | "present" | "absent"
            );
          }
        }
      });
    });

    setUsedLetters(newUsedLetters);
  }, [gameState?.evaluations, initialized]);

  // Start new game session
  const startNewGame = async (): Promise<void> => {
    if (!authService.isAuthenticated()) {
      setError("Please log in to play");
      return;
    }

    setLoading(true);
    setError(null);
    lastSessionUpdateRef.current = "";

    try {
      // Clear existing session
      gameSessionService.clearGameSession();

      const newGameState = await gameService.createGame();
      setGameState(newGameState);
      setUsedLetters(new Map());
      console.log("New game started:", newGameState.gameId);
    } catch (error: any) {
      console.error("Failed to start game:", error);
      setError("Failed to start new game. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle keyboard input
  const handleKey = useCallback(
    async (key: string): Promise<void> => {
      const now = Date.now();
      if (now - lastInputTimeRef.current < INPUT_DEBOUNCE_MS) {
        return;
      }
      lastInputTimeRef.current = now;

      if (!gameState || gameState.gameOver || loading || !initialized) return;

      if (key === "ENTER") {
        await handleEnterKey();
      } else if (key === "BACKSPACE") {
        handleBackspaceKey();
      } else if (/^[A-Z]$/.test(key)) {
        handleLetterKey(key);
      }
    },
    [gameState, loading, initialized]
  );

  // Handle ENTER key
  const handleEnterKey = async (): Promise<void> => {
    if (!gameState) return;

    const currentRowLetters = gameState.board[gameState.currentRow];
    const completedLetters = currentRowLetters.filter(
      (letter) => letter !== ""
    ).length;

    if (completedLetters !== 5) return;

    const guess = currentRowLetters.join("");

    setLoading(true);

    try {
      const response = await gameService.submitGuess(gameState.gameId, guess);

      if (!response.valid) {
        setShakingRow(gameState.currentRow);
        setTimeout(() => setShakingRow(null), 600);
        return;
      }

      if (response.gameState) {
        setGameState(response.gameState);
      }

      if (response.gameOver) {
        await handleGameCompletion(response);
      }
    } catch (error: any) {
      console.error("Network error submitting guess:", error);
      setError("Failed to submit guess. Please try again.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Handle BACKSPACE key
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

  // Handle letter key
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

  // Handle game completion
  const handleGameCompletion = async (response: any): Promise<void> => {
    const gameData = {
      gameId: response.gameState?.gameId || gameState?.gameId,
      word: response.solution || "UNKNOWN",
      guesses: response.gameState?.guesses || [],
      won: response.won || false,
      attempts: response.gameState?.attempts || 0,
      date: new Date().toISOString().split("T")[0],
    };

    // Notify parent component
    if (onGameComplete) {
      onGameComplete(gameData);
    }

    // Record the game for authenticated users
    try {
      console.log("Recording completed game...");
      await authService.recordGame(gameData);
      console.log("Game recorded successfully");

      setTimeout(() => {
        if (response.won) {
          alert("Congratulations! You won! Game saved to your profile.");
        } else {
          alert(
            `Game Over! The word was: ${response.solution}. Game saved to your profile.`
          );
        }
      }, 1500);
    } catch (error) {
      console.error("Failed to record game:", error);
      setTimeout(() => {
        if (response.won) {
          alert("Congratulations! You won! (Failed to save to profile)");
        } else {
          alert(
            `Game Over! The word was: ${response.solution} (Failed to save to profile)`
          );
        }
      }, 1500);
    }
  };

  // Physical keyboard listener
  useEffect(() => {
    if (!initialized) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

      const key = e.key.toUpperCase();
      if (key === "ENTER" || key === "BACKSPACE") {
        handleKey(key);
      } else if (/^[A-Z]$/.test(key)) {
        handleKey(key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKey, initialized]);

  // Show authentication required message
  if (!authService.isAuthenticated()) {
    return (
      <div className="game-page">
        <div className="error">
          <p>Authentication required to play Wordle.</p>
          <p>Please log in to start playing.</p>
        </div>
      </div>
    );
  }

  // Show loading only when actually loading and no game state
  if ((loading || !initialized) && !gameState) {
    return (
      <div className="game-page">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div>Initializing your game...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !gameState) {
    return (
      <div className="game-page">
        <div className="error">
          <p>Failed to load game.</p>
          <p>{error}</p>
          <button
            onClick={startNewGame}
            className="new-game"
            disabled={loading}
          >
            {loading ? "Retrying..." : "Try Again"}
          </button>
        </div>
      </div>
    );
  }

  // Still initializing without error
  if (!gameState && !error && !initialized) {
    return (
      <div className="game-page">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div>Setting up your game...</div>
        </div>
      </div>
    );
  }

  const currentUser = authService.getCurrentUser();

  return (
    <div className="game-page">
      {error && <div className="error-message">{error}</div>}

      {currentUser && (
        <div className="user-info">
          <p>Welcome, {currentUser.username}!</p>
        </div>
      )}

      {gameState && (
        <>
          <Board
            board={gameState.board}
            evaluations={gameState.evaluations}
            shakingRow={shakingRow}
            poppingTile={poppingTile}
            currentRow={gameState.currentRow}
          />

          <Keyboard
            onKeyPress={handleKey}
            usedLetters={usedLetters}
            disabled={loading}
          />

          <div className="game-info">
            {gameState.gameOver && (
              <div className="game-result">
                <p>{gameState.won ? "🎉 You Won!" : "😞 Game Over"}</p>
                <button
                  onClick={startNewGame}
                  className="new-game"
                  disabled={loading}
                >
                  {loading ? "Starting..." : "New Game"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/*import { useState, useEffect, useCallback, JSX, useRef } from "react";
import { Board } from "../components/game/Board";
import { Keyboard } from "../components/game/Keyboard";
import { gameService, GameState } from "../services/game";
import { authService } from "../services/auth";

*
 * Game Page Component: Wordle Game
 *
 * - Game state management and synchronization
 * - User input handling (both virtual and physical keyboard)
 * - Server communication with race condition prevention
 * - Animation states and visual feedback
 * - Authentication integration for game recording
 
export function GamePage(): JSX.Element {
  // game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // animation states
  const [shakingRow, setShakingRow] = useState<number | null>(null);
  const [poppingTile, setPoppingTile] = useState<{
    row: number;
    col: number;
  } | null>(null);

  // keyboard state
  const [usedLetters, setUsedLetters] = useState<
    Map<string, "correct" | "present" | "absent">
  >(new Map());

  // Race condition prevention
  const pendingRequestRef = useRef<AbortController | null>(null);

  // Input debouncing
  const lastInputTimeRef = useRef<number>(0);
  const INPUT_DEBOUNCE_MS = 50;

  // initialize game on component mount
  useEffect(() => {
    startNewGame();

    // Cleanup pending requests on unmount
    return () => {
      if (pendingRequestRef.current) {
        pendingRequestRef.current.abort();
      }
    };
  }, []);

  // Make this change in GamePage.tsx
useEffect(() => {
  // Only allow authenticated users to play
  if (!authService.isAuthenticated()) {
    // Redirect to login instead of allowing anonymous play
    navigateTo('login');
    return;
  }
  startNewGame();
}, []); 

  // update keyboard state based on game evaluations
  useEffect(() => {
    if (!gameState) return;

    const newUsedLetters = new Map<string, "correct" | "present" | "absent">();

    gameState.board.forEach((row, i) => {
      row.forEach((letter, j) => {
        if (letter && gameState.evaluations[i] && gameState.evaluations[i][j]) {
          const current = newUsedLetters.get(letter);
          const newStatus = gameState.evaluations[i][j];

          if (
            !current ||
            (current === "absent" && newStatus !== "absent") ||
            (current === "present" && newStatus === "correct")
          ) {
            newUsedLetters.set(
              letter,
              newStatus as "correct" | "present" | "absent"
            );
          }
        }
      });
    });

    setUsedLetters(newUsedLetters);
  }, [gameState]);

  // start new game session
  const startNewGame = async (): Promise<void> => {
    if (pendingRequestRef.current) {
      pendingRequestRef.current.abort();
      pendingRequestRef.current = null;
    }

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    pendingRequestRef.current = controller;

    try {
      const newGameState = await gameService.createGame();

      if (controller.signal.aborted) return;

      setGameState(newGameState);
      setUsedLetters(new Map());
    } catch (error: any) {
      if (error.name === "AbortError") return;

      console.error("Failed to start game:", error);
      setError("Failed to start new game. Please try again.");
    } finally {
      setLoading(false);
      pendingRequestRef.current = null;
    }
  };

  // handle keyboard input (virtaul and physical)
  const handleKey = useCallback(
    async (key: string): Promise<void> => {
      const now = Date.now();
      if (now - lastInputTimeRef.current < INPUT_DEBOUNCE_MS) {
        return;
      }
      lastInputTimeRef.current = now;

      if (!gameState || gameState.gameOver || loading) return;

      if (pendingRequestRef.current) return;

      if (key === "ENTER") {
        await handleEnterKey();
      } else if (key === "BACKSPACE") {
        handleBackspaceKey();
      } else if (/^[A-Z]$/.test(key)) {
        handleLetterKey(key);
      }
    },
    [gameState, loading]
  );

  // handle ENTER key: submit current word for evaluation
  const handleEnterKey = async (): Promise<void> => {
    if (!gameState) return;

    const currentRowLetters = gameState.board[gameState.currentRow];
    const completedLetters = currentRowLetters.filter(
      (letter) => letter !== ""
    ).length;

    if (completedLetters !== 5) return;

    const guess = currentRowLetters.join("");

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
        await handleGameCompletion(response);
      }
    } catch (error: any) {
      if (error.name === "AbortError") return;
      console.error("Network error submitting guess:", error);
      setError("Failed to submit guess. Please try again.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
      pendingRequestRef.current = null;
    }
  };

  // handle BACKSPACE key
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

      setGameState({
        ...gameState,
        board: updatedBoard,
      });
    }
  };

  // Handle letter key
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

      setGameState({
        ...gameState,
        board: updatedBoard,
      });

      setPoppingTile({ row: gameState.currentRow, col: nextEmptyIndex });
      setTimeout(() => setPoppingTile(null), 200);
    }
  };

  // Handle game completion logic
  const handleGameCompletion = async (response: any): Promise<void> => {
    if (!authService.isAuthenticated()) {
      console.log("User not authenticated, skipping game recording");
      return;
    }

    try {
      const user = authService.getCurrentUser();
      if (!user) {
        console.log("No user data available, skipping game recording");
        return;
      }

      console.log("🎮 Recording completed game...");

      // Create properly formatted game record for profile service
      const gameRecord = {
        gameId: response.gameState?.gameId || `game_${Date.now()}`,
        targetWord: response.solution || response.gameState?.targetWord || "",
        guesses: response.gameState?.guesses || [],
        won: response.won || false,
        attempts:
          response.gameState?.attempts || response.gameState?.currentRow + 1,
        completedAt: new Date().toISOString(),
      };

      console.log("📊 Game record data:", gameRecord);

      // Record game via auth service (which forwards to profile service)
      await authService.recordGame({
        gameId: gameRecord.gameId,
        word: gameRecord.targetWord,
        guesses: gameRecord.guesses,
        won: gameRecord.won,
        attempts: gameRecord.attempts,
        date: new Date().toISOString().split("T")[0], // YYYY-MM-DD format
      });

      console.log("✅ Game recorded successfully");

      // Show success message
      setTimeout(() => {
        if (response.won) {
          alert("Congratulations! You won! Game saved to your profile.");
        } else {
          alert(
            `Game Over! The word was: ${response.solution}. Game saved to your profile.`
          );
        }
      }, 1500);
    } catch (error) {
      console.error("❌ Failed to record game:", error);

      // Still show game completion message even if recording fails
      setTimeout(() => {
        if (response.won) {
          alert("Congratulations! You won! (Failed to save to profile)");
        } else {
          alert(
            `Game Over! The word was: ${response.solution} (Failed to save to profile)`
          );
        }
      }, 1500);
    }
  };

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
        return;
      }

      const key = e.key.toUpperCase();
      if (key === "ENTER" || key === "BACKSPACE") {
        handleKey(key);
      } else if (/^[A-Z]$/.test(key)) {
        handleKey(key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKey]);

  if (loading && !gameState) {
    return (
      <div className="game-page">
        <div className="loading">Loading game...</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="game-page">
        <div className="error">
          <p>Failed to load game.</p>
          <button
            onClick={startNewGame}
            className="new-game"
            disabled={loading}
          >
            {loading ? "Retrying..." : "Try Again"}{" "}
          </button>
        </div>
      </div>
    );
  }

  const currentUser = authService.getCurrentUser();

  return (
    <div className="game-page">
      {error && <div className="error-message">{error}</div>}

      {currentUser && (
        <div className="user-info">
          <p>Playing as: {currentUser.username}</p>
        </div>
      )}

      <Board
        board={gameState.board}
        evaluations={gameState.evaluations}
        shakingRow={shakingRow}
        poppingTile={poppingTile}
        currentRow={gameState.currentRow}
      />

      <Keyboard
        onKeyPress={handleKey}
        usedLetters={usedLetters}
        disabled={loading}
      />

      <div className="game-info">
        {gameState.gameOver && (
          <div className="game-result">
            <p>{gameState.won ? "You Won!" : "Game Over"}</p>
            {!authService.isAuthenticated() && (
              <p className="auth-hint">Login to save your progress!</p>
            )}
            <button
              onClick={startNewGame}
              className="new-game"
              disabled={loading}
            >
              {loading ? "Starting..." : "New Game"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
*/
