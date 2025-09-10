import { memo } from "react";
import { BoardProps } from "../../types/game";
import "./Board.css";

/**
 * Board Component
 *
 * Renders the main Wordle game board as a 6x5 grid of tiles.
 * Each tile displays a letter and its evaluation state (correct/present/absent).
 * Supports animations for user feedback.
 *
 * @param board - 6x5 array representing letter positions
 * @param evaluations - 6x5 array of tile states (correct/present/absent)
 * @param shakingRow - Row index for shake animation (invalid word feedback)
 * @param poppingTile - Tile coordinates for pop animation (letter entry)
 * @param currentRow - Currently active row for styling
 *
 */
const Board = memo<BoardProps>(
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
              const evaluation = evaluations[i]?.[j];

              const tileClasses = [
                "tile",
                evaluation && evaluation,
                isPopping && "pop",
                hasLetter && isCurrentRow && "filled",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div
                  key={j}
                  className={tileClasses}
                  data-testid={`tile-${i}-${j}`}
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

Board.displayName = "Board";
export { Board };
