import React from "react";
import "./GameBoard.css";

interface GameBoardProps {
  board: string[][];
  evaluations: string[][];
  size?: "small" | "medium" | "large";
  interactive?: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  board,
  evaluations,
  size = "medium",
  interactive = false,
}) => {
  return (
    <div
      className={`game-board game-board--${size} ${
        interactive ? "interactive" : ""
      }`}
    >
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="game-row">
          {row.map((letter, colIndex) => {
            const evaluation = evaluations[rowIndex]?.[colIndex] || "";
            return (
              <div
                key={colIndex}
                className={`game-tile ${
                  evaluation ? `game-tile--${evaluation}` : ""
                } ${letter ? "game-tile--filled" : ""}`}
              >
                {letter}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
