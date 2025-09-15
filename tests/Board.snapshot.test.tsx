import { render, screen } from "@testing-library/react";
import React from "react";

interface BoardProps {
  board: string[][];
  evaluations: (string | null)[][];
  shakingRow: number | null;
  poppingTile: { row: number; col: number } | null;
  currentRow: number;
}

export const Board: React.FC<BoardProps> = ({
  board,
  evaluations,
  shakingRow,
  poppingTile,
  currentRow,
}) => {
  return (
    <div className="board">
      {board.map((row, i) => (
        <div
          key={i}
          className={`row ${shakingRow === i ? "shake" : ""}`}
          role="row"
        >
          {row.map((letter, j) => {
            const isPopping = poppingTile?.row === i && poppingTile?.col === j;
            const hasLetter = letter !== "";
            const isCurrentRow = i === currentRow;
            const evaluation = evaluations[i]?.[j];

            return (
              <div
                key={j}
                className={`tile ${evaluation || ""} ${
                  isPopping ? "pop" : ""
                } ${hasLetter && isCurrentRow ? "filled" : ""}`}
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
};

describe("Board Component", () => {
  const mockProps = {
    board: [
      ["W", "O", "R", "L", "D"],
      ["", "", "", "", ""],
      ["", "", "", "", ""],
      ["", "", "", "", ""],
      ["", "", "", "", ""],
      ["", "", "", "", ""],
    ],
    evaluations: [
      ["correct", "absent", "present", "absent", "correct"],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    shakingRow: null,
    poppingTile: null,
    currentRow: 1,
  };

  test("renders 6x5 grid correctly", () => {
    render(<Board {...mockProps} />);
    const tiles = screen.getAllByTestId(/tile-\d+-\d+/);
    expect(tiles).toHaveLength(30); // 6 rows × 5 columns
  });

  test("displays letters correctly", () => {
    render(<Board {...mockProps} />);
    expect(screen.getByTestId("tile-0-0")).toHaveTextContent("W");
    expect(screen.getByTestId("tile-0-1")).toHaveTextContent("O");
  });

  test("applies correct evaluation classes", () => {
    render(<Board {...mockProps} />);
    expect(screen.getByTestId("tile-0-0")).toHaveClass("correct");
    expect(screen.getByTestId("tile-0-1")).toHaveClass("absent");
    expect(screen.getByTestId("tile-0-2")).toHaveClass("present");
  });
});
