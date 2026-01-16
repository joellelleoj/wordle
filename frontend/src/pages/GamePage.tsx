import { useEffect, useCallback, memo } from "react";
import { Board } from "../components/game/Board";
import { Keyboard } from "../components/game/Keyboard";
import { GameResult } from "../components/game/GameResult";
import { LoadingSpinner } from "../components/layout/LoadingSpinner";
import { useGameLogic } from "../hooks/useGameLogic";
import { authService } from "../services/auth";
import { useNavigation } from "../hooks/useNavigation";
import "./GamePage.css";

interface GamePageProps {
  gameId?: string;
  onGameComplete?: (gameData: any) => void;
  onSessionUpdate?: (sessionData: any) => void;
}

export const GamePage = memo<GamePageProps>(
  ({ onGameComplete, onSessionUpdate }) => {
    const { navigateTo } = useNavigation();

    const {
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
    } = useGameLogic({
      onGameComplete,
      onSessionUpdate,
    });

    // Check authentication on mount
    useEffect(() => {
      if (!authService.isAuthenticated()) {
        navigateTo("login");
        return;
      }
    }, [navigateTo]);

    // Physical keyboard listener
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent): void => {
        // Ignore if modifier keys are pressed, game is over, or modal is showing
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
        if (gameState?.gameOver || showGameResult) return;

        const key = e.key.toUpperCase();
        if (key === "ENTER" || key === "BACKSPACE") {
          e.preventDefault();
          handleKeyPress(key);
        } else if (/^[A-Z]$/.test(key)) {
          e.preventDefault();
          handleKeyPress(key);
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyPress, gameState?.gameOver, showGameResult]);

    // Handle new game - enhanced to clear game result state
    const handleNewGame = useCallback(async () => {
      await startNewGame();
    }, [startNewGame]);

    // Authentication check
    if (!authService.isAuthenticated()) {
      return null;
    }

    // Loading state
    if (loading && !gameState) {
      return (
        <div className="game-page">
          <div className="game-loading">
            <LoadingSpinner size="large" />
            <p>Setting up your game...</p>
          </div>
        </div>
      );
    }

    // Error state
    if (error && !gameState) {
      return (
        <div className="game-page">
          <div className="game-error">
            <h3>Game Error</h3>
            <p>{error}</p>
            <button
              onClick={handleNewGame}
              className="retry-button"
              disabled={loading}
            >
              {loading ? "Retrying..." : "Try Again"}
            </button>
          </div>
        </div>
      );
    }

    // No game state
    if (!gameState) {
      return (
        <div className="game-page">
          <div className="no-game">
            <p>Unable to load game.</p>
            <button
              onClick={handleNewGame}
              className="new-game-button"
              disabled={loading}
            >
              Start New Game
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="game-page">
        {error && (
          <div className="error-overlay">
            <div className="error-message">
              {error}
              <button onClick={resetError} className="error-close">
                ×
              </button>
            </div>
          </div>
        )}

        <div className="game-container">
          <Board
            board={gameState.board}
            evaluations={gameState.evaluations}
            shakingRow={shakingRow}
            poppingTile={poppingTile}
            currentRow={gameState.currentRow}
          />

          <Keyboard
            onKeyPress={handleKeyPress}
            usedLetters={usedLetters}
            disabled={loading || gameState.gameOver}
          />

          {loading && !gameState.gameOver && (
            <div className="game-action-loading">
              <LoadingSpinner size="small" />
            </div>
          )}
        </div>

        {showGameResult && gameResult && (
          <GameResult
            gameOver={true}
            won={gameResult.won}
            solution={gameResult.solution}
            onNewGame={handleNewGame}
            loading={loading}
          />
        )}
      </div>
    );
  }
);

GamePage.displayName = "GamePage";
