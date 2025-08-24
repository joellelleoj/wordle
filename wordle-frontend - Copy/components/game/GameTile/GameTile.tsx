import React from "react";
import { TileStatus } from "../../../types/game";
import styles from "./GameTile.module.css";

interface GameTileProps {
  letter: string;
  status: TileStatus;
  animate?: boolean;
  delay?: number;
}

/**
 * Individual Game Tile Component
 *
 * Implements:
 * - Single Responsibility: Renders a single game tile
 * - Separation of Concerns: Presentation logic only
 * - CSS Modules: Scoped styling
 *
 * @param letter - The letter to display
 * @param status - Current tile status for color coding
 * @param animate - Whether to animate tile flip
 * @param delay - Animation delay for staggered effects
 */
export const GameTile: React.FC<GameTileProps> = ({
  letter,
  status,
  animate = false,
  delay = 0,
}) => {
  const tileClasses = [styles.tile, styles[status], animate && styles.flip]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={tileClasses}
      style={{ animationDelay: `${delay}ms` }}
      data-testid={`game-tile-${letter}`}
      aria-label={`Letter ${letter}, status ${status}`}
    >
      <span className={styles.letter}>{letter}</span>
    </div>
  );
};
