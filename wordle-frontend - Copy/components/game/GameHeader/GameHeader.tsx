import React from "react";
import { Button } from "../../ui/Button/Button";
import styles from "./GameHeader.module.css";

interface GameHeaderProps {
  onShowStats: () => void;
  onShowRules: () => void;
  canStartNewGame: boolean;
  onNewGame: () => void;
  isLoading: boolean;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  onShowStats,
  onShowRules,
  canStartNewGame,
  onNewGame,
  isLoading,
}) => {
  return (
    <div className={styles.gameHeader}>
      <div className={styles.title}>
        <h1>Wordle</h1>
      </div>

      <div className={styles.actions}>
        <Button
          variant="ghost"
          size="small"
          onClick={onShowRules}
          aria-label="Show game rules"
        >
          ?
        </Button>

        <Button
          variant="ghost"
          size="small"
          onClick={onShowStats}
          aria-label="Show statistics"
        >
          📊
        </Button>

        {canStartNewGame && (
          <Button
            variant="outline"
            size="small"
            onClick={onNewGame}
            loading={isLoading}
          >
            New Game
          </Button>
        )}
      </div>
    </div>
  );
};
