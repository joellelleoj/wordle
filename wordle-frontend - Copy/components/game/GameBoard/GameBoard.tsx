import React from "react";
import { GameRow } from "../GameRow/GameRow";
import { GameState } from "../../../types/game";
import styles from "./GameBoard.module.css";

interface GameBoardProps {
  gameState: GameState;
  animateLastRow?: boolean;
  shakeCurrentRow?: boolean;
}

/**
 * Game Board Component
 *
 * Main game board that displays all rows of tiles
 * Manages animations for tile flips and row shaking
 */
export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  animateLastRow = false,
  shakeCurrentRow = false,
}) => {
  return (
    <div
      className={styles.board}
      data-testid="game-board"
      role="main"
      aria-label="Wordle game board"
    >
      {gameState.rows.map((row, index) => {
        const isCurrentRow = index === gameState.currentRow;
        const shouldAnimate =
          animateLastRow && index === gameState.currentRow - 1;
        const shouldShake = shakeCurrentRow && isCurrentRow;

        return (
          <GameRow
            key={index}
            row={row}
            animate={shouldAnimate}
            isCurrentRow={isCurrentRow}
            shake={shouldShake}
          />
        );
      })}
    </div>
  );
};
