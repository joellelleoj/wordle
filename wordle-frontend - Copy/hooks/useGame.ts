import { useState, useCallback, useEffect } from "react";
import {
  GameState,
  GameStatus,
  TileStatus,
  KeyboardState,
} from "../types/game";
import { gameService } from "../services/api/gameService";
import { useAuth } from "./useAuth";
import { useVibration } from "./useVibration";
import { GAME_CONFIG, ERROR_MESSAGES } from "../services/utils/constants";
import {
  validateWord,
  createEmptyGameState,
  calculateLetterFeedback,
  updateKeyboardState,
  isGameWon,
  isGameLost,
} from "../services/utils/gameLogic";

export const useGame = () => {
  const { user, token } = useAuth();
  const { vibrate } = useVibration();

  const [gameState, setGameState] = useState<GameState>(createEmptyGameState());
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animateLastRow, setAnimateLastRow] = useState(false);
  const [shakeCurrentRow, setShakeCurrentRow] = useState(false);

  // Initialize new game
  const startNewGame = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const newGameData = await gameService.startNewGame(token);
      const newGameState = createEmptyGameState();
      newGameState.id = newGameData.gameId;
      newGameState.word = newGameData.word; // Hidden in production
      newGameState.status = GameStatus.PLAYING;

      setGameState(newGameState);
      setKeyboardState({}); // Reset keyboard colors
      setAnimateLastRow(false);
      setShakeCurrentRow(false);
    } catch (err) {
      setError(ERROR_MESSAGES.GAME_ERROR);
      console.error("Failed to start new game:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Handle key input
  const handleKeyPress = useCallback(
    async (key: string) => {
      if (gameState.status !== GameStatus.PLAYING || gameState.isSubmitting) {
        return;
      }

      setError(null);
      setShakeCurrentRow(false);

      if (key === "ENTER") {
        await submitGuess();
      } else if (key === "BACKSPACE") {
        deleteLetter();
      } else if (/^[A-Z]$/.test(key)) {
        addLetter(key);
      }
    },
    [gameState]
  );

  // Add letter to current row
  const addLetter = useCallback(
    (letter: string) => {
      if (gameState.currentTile >= GAME_CONFIG.WORD_LENGTH) return;

      setGameState((prev) => {
        const newState = { ...prev };
        const currentRow = newState.rows[newState.currentRow];

        // Update tile with letter and FILLED status
        currentRow.tiles[newState.currentTile] = {
          letter,
          status: TileStatus.FILLED, // Shows letter is entered but not submitted
          animate: false,
        };

        newState.currentTile += 1;
        return newState;
      });

      vibrate(GAME_CONFIG.VIBRATION.SUBMIT);
    },
    [gameState.currentTile, vibrate]
  );

  // Delete letter from current row
  const deleteLetter = useCallback(() => {
    if (gameState.currentTile <= 0) return;

    setGameState((prev) => {
      const newState = { ...prev };
      const currentRow = newState.rows[newState.currentRow];

      newState.currentTile -= 1;
      // Reset tile to empty state
      currentRow.tiles[newState.currentTile] = {
        letter: "",
        status: TileStatus.EMPTY,
        animate: false,
      };

      return newState;
    });
  }, [gameState.currentTile]);

  // Submit current guess
  const submitGuess = useCallback(async () => {
    if (!token || gameState.currentTile !== GAME_CONFIG.WORD_LENGTH) return;

    const currentRow = gameState.rows[gameState.currentRow];
    const guess = currentRow.tiles.map((tile) => tile.letter).join("");

    // Client-side validation
    if (!validateWord(guess)) {
      setError(ERROR_MESSAGES.INVALID_WORD_LENGTH);
      setShakeCurrentRow(true);
      vibrate(GAME_CONFIG.VIBRATION.ERROR);
      return;
    }

    setGameState((prev) => ({ ...prev, isSubmitting: true }));

    try {
      // Call backend for word validation and feedback
      const result = await gameService.submitGuess(token, gameState.id!, guess);

      if (!result.isValidWord) {
        setError(ERROR_MESSAGES.WORD_NOT_FOUND);
        setShakeCurrentRow(true);
        vibrate(GAME_CONFIG.VIBRATION.ERROR);
        return;
      }

      // Process the guess result
      processGuessResult(
        guess,
        result.feedback,
        result.gameStatus,
        result.isCorrect
      );
    } catch (err) {
      setError(ERROR_MESSAGES.GAME_ERROR);
      setShakeCurrentRow(true);
      vibrate(GAME_CONFIG.VIBRATION.ERROR);
      console.error("Failed to submit guess:", err);
    } finally {
      setGameState((prev) => ({ ...prev, isSubmitting: false }));
    }
  }, [token, gameState, vibrate]);

  // Process guess result and update state
  const processGuessResult = useCallback(
    (
      guess: string,
      feedback: TileStatus[],
      gameStatus: GameStatus,
      isCorrect: boolean
    ) => {
      setGameState((prev) => {
        const newState = { ...prev };
        const currentRow = newState.rows[newState.currentRow];

        // Update tiles with feedback from backend
        currentRow.tiles.forEach((tile, index) => {
          tile.status = feedback[index];
          tile.animate = true; // Trigger flip animation
        });

        currentRow.submitted = true;
        currentRow.isCurrentRow = false;
        newState.lastGuess = guess;
        newState.attempts += 1;

        // Update game status
        newState.status = gameStatus;
        if (gameStatus !== GameStatus.PLAYING) {
          newState.endTime = new Date();
          vibrate(
            gameStatus === GameStatus.WON
              ? GAME_CONFIG.VIBRATION.SUCCESS
              : GAME_CONFIG.VIBRATION.ERROR
          );
        }

        // Move to next row if game continues
        if (
          gameStatus === GameStatus.PLAYING &&
          newState.currentRow < GAME_CONFIG.MAX_ATTEMPTS - 1
        ) {
          newState.currentRow += 1;
          newState.currentTile = 0;
          newState.rows[newState.currentRow].isCurrentRow = true;
        }

        return newState;
      });

      // Update keyboard state with new feedback
      setKeyboardState((prevKeyboard) =>
        updateKeyboardState(prevKeyboard, guess, feedback)
      );

      // Trigger flip animation
      setAnimateLastRow(true);
      setTimeout(() => {
        setAnimateLastRow(false);
        // Reset tile animations
        setGameState((prev) => {
          const newState = { ...prev };
          newState.rows[prev.currentRow - 1]?.tiles.forEach((tile) => {
            tile.animate = false;
          });
          return newState;
        });
      }, GAME_CONFIG.ANIMATIONS.TILE_FLIP_DURATION + GAME_CONFIG.WORD_LENGTH * GAME_CONFIG.ANIMATIONS.TILE_REVEAL_DELAY);
    },
    [vibrate]
  );

  // Load existing game on mount
  useEffect(() => {
    if (token && user) {
      loadCurrentGame();
    }
  }, [token, user]);

  const loadCurrentGame = async () => {
    if (!token) return;

    try {
      const currentGame = await gameService.getCurrentGame(token);
      if (currentGame) {
        // Reconstruct game state from backend data
        reconstructGameState(currentGame);
      } else {
        // Start new game if no current game
        startNewGame();
      }
    } catch (err) {
      console.error("Failed to load current game:", err);
      startNewGame();
    }
  };

  const reconstructGameState = (gameData: any) => {
    // Reconstruct game state and keyboard state from saved game data
    const newGameState = createEmptyGameState();
    newGameState.id = gameData.gameId;
    newGameState.attempts = gameData.attempts;
    newGameState.status = gameData.status;
    newGameState.currentRow = Math.min(
      gameData.attempts,
      GAME_CONFIG.MAX_ATTEMPTS - 1
    );

    let newKeyboardState: KeyboardState = {};

    // Replay all guesses to rebuild state
    gameData.guesses.forEach((guessData: any, rowIndex: number) => {
      const row = newGameState.rows[rowIndex];
      row.submitted = true;

      guessData.feedback.forEach((letterFeedback: any, tileIndex: number) => {
        row.tiles[tileIndex] = {
          letter: letterFeedback.letter,
          status: letterFeedback.status,
          animate: false,
        };
      });

      // Update keyboard state
      newKeyboardState = updateKeyboardState(
        newKeyboardState,
        guessData.word,
        guessData.feedback.map((f: any) => f.status)
      );
    });

    // Set current row if game is still playing
    if (newGameState.status === GameStatus.PLAYING) {
      newGameState.rows[newGameState.currentRow].isCurrentRow = true;
    }

    setGameState(newGameState);
    setKeyboardState(newKeyboardState);
  };

  return {
    gameState,
    keyboardState, // Return keyboard state instead of keyStatuses
    isLoading,
    error,
    animateLastRow,
    shakeCurrentRow,
    handleKeyPress,
    startNewGame,
    canStartNewGame: gameState.status !== GameStatus.PLAYING,
  };
};
