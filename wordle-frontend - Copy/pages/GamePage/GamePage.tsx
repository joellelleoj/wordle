import React, { useEffect, useState } from "react";
import { GameBoard } from "../../components/game/GameBoard/GameBoard";
import { VirtualKeyboard } from "../../components/game/VirtualKeyboard/VirtualKeyboard";
import { GameHeader } from "../../components/game/GameHeader/GameHeader";
import { GameStats } from "../../components/game/GameStats/GameStats";
import { GameRules } from "../../components/game/GameRules/GameRules";
import { Modal } from "../../components/ui/Modal/Modal";
import { Button } from "../../components/ui/Button/Button";
import { useGameContext } from "../../contexts/GameContext";
import { useKeyboard } from "../../hooks/useKeyboard";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { GameStatus } from "../../types/game";
import { generateShareText } from "../../services/utils/gameLogic";
import styles from "./GamePage.module.css";

export const GamePage: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const {
    gameState,
    keyboardState,
    isLoading,
    error,
    animateLastRow,
    shakeCurrentRow,
    handleKeyPress,
    startNewGame,
    canStartNewGame,
  } = useGameContext();

  const [showStats, setShowStats] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showGameComplete, setShowGameComplete] = useState(false);

  // Enable keyboard input
  useKeyboard({
    onKeyPress: handleKeyPress,
    disabled: isLoading || gameState.status !== GameStatus.PLAYING,
  });

  // Show game complete modal when game ends
  useEffect(() => {
    if (
      gameState.status === GameStatus.WON ||
      gameState.status === GameStatus.LOST
    ) {
      setShowGameComplete(true);
    }
  }, [gameState.status]);

  // Show error toasts
  useEffect(() => {
    if (error) {
      addToast({
        type: "error",
        message: error,
        duration: 3000,
      });
    }
  }, [error, addToast]);

  const handleNewGame = async () => {
    setShowGameComplete(false);
    try {
      await startNewGame();
      addToast({
        type: "success",
        message: "New game started!",
        duration: 2000,
      });
    } catch (err) {
      addToast({
        type: "error",
        message: "Failed to start new game",
        duration: 3000,
      });
    }
  };

  const getGameCompleteMessage = () => {
    if (gameState.status === GameStatus.WON) {
      const messages = [
        "Genius!",
        "Magnificent!",
        "Impressive!",
        "Splendid!",
        "Great!",
        "Phew!",
      ];
      return messages[gameState.attempts - 1] || "Well done!";
    }
    return `The word was ${gameState.word}`;
  };

  const shareResult = () => {
    if (
      gameState.status !== GameStatus.WON &&
      gameState.status !== GameStatus.LOST
    ) {
      return;
    }

    const guessFeedback = gameState.rows
      .slice(0, gameState.attempts)
      .map((row) => row.tiles.map((tile) => tile.status));

    const shareText = generateShareText(
      gameState.rows
        .slice(0, gameState.attempts)
        .map((row) => row.tiles.map((tile) => tile.letter).join("")),
      guessFeedback,
      gameState.attempts,
      gameState.status === GameStatus.WON
    );

    if (navigator.share && navigator.canShare) {
      navigator
        .share({
          text: shareText,
          url: window.location.href,
        })
        .catch(() => {
          // Fallback to clipboard
          navigator.clipboard.writeText(shareText);
          addToast({
            type: "success",
            message: "Result copied to clipboard!",
            duration: 2000,
          });
        });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      addToast({
        type: "success",
        message: "Result copied to clipboard!",
        duration: 2000,
      });
    } else {
      addToast({
        type: "info",
        message: "Sharing not available on this device",
        duration: 3000,
      });
    }
  };

  return (
    <div className={styles.gamePage}>
      <GameHeader
        onShowStats={() => setShowStats(true)}
        onShowRules={() => setShowRules(true)}
        canStartNewGame={canStartNewGame}
        onNewGame={handleNewGame}
        isLoading={isLoading}
      />

      <main className={styles.gameContainer}>
        <GameBoard
          gameState={gameState}
          animateLastRow={animateLastRow}
          shakeCurrentRow={shakeCurrentRow}
        />

        <VirtualKeyboard
          onKeyPress={handleKeyPress}
          keyboardState={keyboardState}
          disabled={isLoading || gameState.status !== GameStatus.PLAYING}
        />
      </main>

      {/* Statistics Modal */}
      <Modal
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        title="Statistics"
        size="medium"
      >
        <GameStats userId={user?.id} showDetailed={true} />
      </Modal>

      {/* Rules Modal */}
      <Modal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="How to Play"
        size="medium"
      >
        <GameRules />
      </Modal>

      {/* Game Complete Modal */}
      <Modal
        isOpen={showGameComplete}
        onClose={() => setShowGameComplete(false)}
        title={
          gameState.status === GameStatus.WON ? "Congratulations!" : "Game Over"
        }
        size="small"
      >
        <div className={styles.gameComplete}>
          <div className={styles.gameCompleteMessage}>
            {getGameCompleteMessage()}
          </div>

          <div className={styles.gameCompleteStats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Attempts</span>
              <span className={styles.statValue}>
                {gameState.status === GameStatus.WON ? gameState.attempts : "X"}
                /6
              </span>
            </div>

            {gameState.startTime && gameState.endTime && (
              <div className={styles.stat}>
                <span className={styles.statLabel}>Time</span>
                <span className={styles.statValue}>
                  {Math.floor(
                    (gameState.endTime.getTime() -
                      gameState.startTime.getTime()) /
                      1000
                  )}
                  s
                </span>
              </div>
            )}
          </div>

          <div className={styles.gameCompleteActions}>
            <Button
              variant="outline"
              onClick={shareResult}
              className={styles.actionButton}
            >
              Share
            </Button>

            <Button
              variant="primary"
              onClick={handleNewGame}
              loading={isLoading}
              className={styles.actionButton}
            >
              New Game
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
