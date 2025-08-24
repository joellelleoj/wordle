import React from "react";
import { GameTile } from "../GameTile/GameTile";
import { GameRow as GameRowType } from "../../../types/game";
import { GAME_CONFIG } from "../../../services/utils/constants";
import styles from "./GameRow.module.css";

interface GameRowProps {
  row: GameRowType;
  animate?: boolean;
  isCurrentRow?: boolean;
  shake?: boolean;
}

/**
 * Game Row Component
 *
 * Renders a row of 5 game tiles with animations
 * Implements staggered flip animation for submitted rows
 */
export const GameRow: React.FC<GameRowProps> = ({
  row,
  animate = false,
  isCurrentRow = false,
  shake = false,
}) => {
  const rowClasses = [
    styles.row,
    isCurrentRow && styles.current,
    shake && styles.shake,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rowClasses}
      data-testid="game-row"
      role="group"
      aria-label={isCurrentRow ? "Current guess" : "Previous guess"}
    >
      {row.tiles.map((tile, index) => (
        <GameTile
          key={index}
          letter={tile.letter}
          status={tile.status}
          animate={animate && row.submitted}
          delay={animate ? index * GAME_CONFIG.ANIMATIONS.TILE_REVEAL_DELAY : 0}
        />
      ))}
    </div>
  );
};
