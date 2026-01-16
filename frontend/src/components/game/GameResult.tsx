import { memo, useEffect } from "react";
import { createPortal } from "react-dom";
import { GameResultProps } from "../../types/game";
import "./GameResult.css";

/**
 * GameResult Component
 *
 * Modal overlay component that displays the game completion state.
 * Shows win/loss status, solution word (if lost), and provides
 * interface to start a new game.
 *
 * @param gameOver - Whether the game has ended
 * @param won - Whether the player won the game
 * @param solution - The correct word (shown only on loss)
 * @param onNewGame - Callback to start a new game
 * @param loading - Whether a new game is being started
 *
 */
const GameResult = memo<GameResultProps>(
  ({ gameOver, won, solution, onNewGame, loading = false }) => {
    if (!gameOver) return null;

    useEffect(() => {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "unset";
      };
    }, []);

    const modalContent = (
      <div className="game-result-overlay">
        <div className="game-result-modal">
          <h2 className={won ? "win-title" : "lose-title"}>
            {won ? "Congratulations!" : "Game Over"}
          </h2>

          {!won && solution && (
            <p className="solution-text">
              The solution was <span className="solution-word">{solution}</span>
            </p>
          )}

          <p className="save-message">
            Your game has been saved to your profile.
          </p>

          <button
            className="new-game-button"
            onClick={onNewGame}
            disabled={loading}
            data-testid="new-game-button"
          >
            {loading ? "Starting..." : "New Game"}
          </button>
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  }
);

GameResult.displayName = "GameResult";

export { GameResult };
