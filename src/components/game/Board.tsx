import React, { memo } from "react";

interface BoardProps {
  board: string[][];
  evaluations: ("correct" | "present" | "absent" | null)[][];
  shakingRow: number | null;
  poppingTile: { row: number; col: number } | null;
  currentRow: number;
}

/**
 * Board Component: Renders the Wordle game grid
 *
 * - Displays the 6x5 game board with letters and their evaluation states
 * - Shows visual feedback through CSS animations (shake, pop, flip reveals)
 *
 * @param BoardProps containing game state and animation triggers
 * @returns JSX.Element representing the game board
 */
export const Board: React.FC<BoardProps> = memo(
  ({ board, evaluations, shakingRow, poppingTile, currentRow }) => {
    return (
      <div className="board">
        {board.map((row, i) => (
          <div key={i} className={`row ${shakingRow === i ? "shake" : ""}`}>
            {row.map((letter, j) => {
              const isPopping =
                poppingTile?.row === i && poppingTile?.col === j;
              const hasLetter = letter !== "";
              const isCurrentRow = i === currentRow;

              return (
                <div
                  key={j}
                  className={`tile ${evaluations[i][j] || ""} ${
                    isPopping ? "pop" : ""
                  } ${hasLetter && isCurrentRow ? "filled" : ""}`}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      JSON.stringify(prevProps.board) === JSON.stringify(nextProps.board) &&
      JSON.stringify(prevProps.evaluations) ===
        JSON.stringify(nextProps.evaluations) &&
      prevProps.shakingRow === nextProps.shakingRow &&
      JSON.stringify(prevProps.poppingTile) ===
        JSON.stringify(nextProps.poppingTile) &&
      prevProps.currentRow === nextProps.currentRow
    );
  }
);
