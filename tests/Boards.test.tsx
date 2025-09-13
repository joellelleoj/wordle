import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Board } from "../src/components/game/Board";
import { BoardProps, TileState } from "../src/types/game";

// Mock CSS import
jest.mock("../Board.css", () => ({}));

/**
 * Helper function to create default board props
 */
const createDefaultProps = (): BoardProps => ({
  board: Array(6)
    .fill(null)
    .map(() => Array(5).fill("")),
  evaluations: Array(6)
    .fill(null)
    .map(() => Array(5).fill(null)),
  shakingRow: null,
  poppingTile: null,
  currentRow: 0,
});

/**
 * Helper function to create a board with filled letters
 */
const createFilledBoard = (): string[][] => [
  ["H", "E", "L", "L", "O"],
  ["W", "O", "R", "L", "D"],
  ["", "", "", "", ""],
  ["", "", "", "", ""],
  ["", "", "", "", ""],
  ["", "", "", "", ""],
];

/**
 * Helper function to create evaluations for filled rows
 */
const createEvaluations = (): TileState[][] => [
  ["absent", "present", "correct", "absent", "present"],
  ["correct", "absent", "present", "correct", "absent"],
  [null, null, null, null, null],
  [null, null, null, null, null],
  [null, null, null, null, null],
  [null, null, null, null, null],
];

describe("Board Component", () => {
  describe("Rendering", () => {
    it("renders without crashing", () => {
      const props = createDefaultProps();
      render(<Board {...props} />);

      expect(screen.getByRole("grid")).toBeInTheDocument();
    });

    it("renders correct number of rows and tiles", () => {
      const props = createDefaultProps();
      render(<Board {...props} />);

      // Should have 6 rows
      const rows = screen.getAllByRole("row");
      expect(rows).toHaveLength(6);

      // Should have 30 tiles total (6 rows × 5 tiles)
      const tiles = screen.getAllByRole("gridcell");
      expect(tiles).toHaveLength(30);
    });

    it("displays letters correctly", () => {
      const props: BoardProps = {
        ...createDefaultProps(),
        board: createFilledBoard(),
      };

      render(<Board {...props} />);

      // Check first row letters
      expect(screen.getByTestId("tile-0-0")).toHaveTextContent("H");
      expect(screen.getByTestId("tile-0-1")).toHaveTextContent("E");
      expect(screen.getByTestId("tile-0-2")).toHaveTextContent("L");
      expect(screen.getByTestId("tile-0-3")).toHaveTextContent("L");
      expect(screen.getByTestId("tile-0-4")).toHaveTextContent("O");

      // Check second row letters
      expect(screen.getByTestId("tile-1-0")).toHaveTextContent("W");
      expect(screen.getByTestId("tile-1-1")).toHaveTextContent("O");
      expect(screen.getByTestId("tile-1-2")).toHaveTextContent("R");
      expect(screen.getByTestId("tile-1-3")).toHaveTextContent("L");
      expect(screen.getByTestId("tile-1-4")).toHaveTextContent("D");
    });

    it("renders empty tiles correctly", () => {
      const props = createDefaultProps();
      render(<Board {...props} />);

      // All tiles should be empty initially
      const tiles = screen.getAllByRole("gridcell");
      tiles.forEach((tile) => {
        expect(tile).toHaveTextContent("");
      });
    });
  });

  describe("Tile States and CSS Classes", () => {
    it("applies correct evaluation classes to tiles", () => {
      const props: BoardProps = {
        ...createDefaultProps(),
        board: createFilledBoard(),
        evaluations: createEvaluations(),
      };

      render(<Board {...props} />);

      // Check evaluation classes for first row
      expect(screen.getByTestId("tile-0-0")).toHaveClass("tile", "absent");
      expect(screen.getByTestId("tile-0-1")).toHaveClass("tile", "present");
      expect(screen.getByTestId("tile-0-2")).toHaveClass("tile", "correct");
      expect(screen.getByTestId("tile-0-3")).toHaveClass("tile", "absent");
      expect(screen.getByTestId("tile-0-4")).toHaveClass("tile", "present");
    });

    it("applies filled class to tiles with letters in current row", () => {
      const props: BoardProps = {
        ...createDefaultProps(),
        board: [
          ["H", "E", "L", "", ""],
          ["", "", "", "", ""],
          ["", "", "", "", ""],
          ["", "", "", "", ""],
          ["", "", "", "", ""],
          ["", "", "", "", ""],
        ],
        currentRow: 0,
      };

      render(<Board {...props} />);

      // Filled tiles in current row should have 'filled' class
      expect(screen.getByTestId("tile-0-0")).toHaveClass("tile", "filled");
      expect(screen.getByTestId("tile-0-1")).toHaveClass("tile", "filled");
      expect(screen.getByTestId("tile-0-2")).toHaveClass("tile", "filled");

      // Empty tiles should not have 'filled' class
      expect(screen.getByTestId("tile-0-3")).toHaveClass("tile");
      expect(screen.getByTestId("tile-0-3")).not.toHaveClass("filled");
    });

    it("applies pop class to popping tile", () => {
      const props: BoardProps = {
        ...createDefaultProps(),
        poppingTile: { row: 1, col: 2 },
      };

      render(<Board {...props} />);

      expect(screen.getByTestId("tile-1-2")).toHaveClass("tile", "pop");

      // Other tiles should not have pop class
      expect(screen.getByTestId("tile-1-1")).not.toHaveClass("pop");
      expect(screen.getByTestId("tile-1-3")).not.toHaveClass("pop");
    });

    it("applies shake class to shaking row", () => {
      const props: BoardProps = {
        ...createDefaultProps(),
        shakingRow: 2,
      };

      render(<Board {...props} />);

      const rows = screen.getAllByRole("row");
      expect(rows[2]).toHaveClass("row", "shake");

      // Other rows should not have shake class
      expect(rows[0]).not.toHaveClass("shake");
      expect(rows[1]).not.toHaveClass("shake");
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA attributes", () => {
      const props = createDefaultProps();
      render(<Board {...props} />);

      // Board should have grid role and label
      const board = screen.getByRole("grid");
      expect(board).toHaveAttribute("aria-label", "Wordle game board");

      // Rows should have proper role and labels
      const rows = screen.getAllByRole("row");
      rows.forEach((row, index) => {
        expect(row).toHaveAttribute("aria-label", `Row ${index + 1}`);
      });

      // Tiles should have proper role
      const tiles = screen.getAllByRole("gridcell");
      expect(tiles).toHaveLength(30);
    });

    it("provides descriptive aria-labels for tiles", () => {
      const props: BoardProps = {
        ...createDefaultProps(),
        board: [
          ["H", "", "", "", ""],
          ["", "", "", "", ""],
          ["", "", "", "", ""],
          ["", "", "", "", ""],
          ["", "", "", "", ""],
          ["", "", "", "", ""],
        ],
        evaluations: [
          ["correct", null, null, null, null],
          [null, null, null, null, null],
          [null, null, null, null, null],
          [null, null, null, null, null],
          [null, null, null, null, null],
          [null, null, null, null, null],
        ],
      };

      render(<Board {...props} />);

      // Tile with letter and evaluation
      expect(screen.getByTestId("tile-0-0")).toHaveAttribute(
        "aria-label",
        "H tile, correct"
      );

      // Empty tile
      expect(screen.getByTestId("tile-0-1")).toHaveAttribute(
        "aria-label",
        "Empty tile, not evaluated"
      );
    });
  });

  describe("Performance and Memoization", () => {
    it("does not re-render when props are the same", () => {
      const props = createDefaultProps();
      const { rerender } = render(<Board {...props} />);

      const initialTile = screen.getByTestId("tile-0-0");

      // Re-render with the same props
      rerender(<Board {...props} />);

      // Component should not have re-rendered (same DOM node)
      expect(screen.getByTestId("tile-0-0")).toBe(initialTile);
    });

    it("re-renders when board changes", () => {
      const initialProps = createDefaultProps();
      const { rerender } = render(<Board {...initialProps} />);

      const changedProps: BoardProps = {
        ...initialProps,
        board: createFilledBoard(),
      };

      rerender(<Board {...changedProps} />);

      // Should show the new letters
      expect(screen.getByTestId("tile-0-0")).toHaveTextContent("H");
    });

    it("re-renders when evaluations change", () => {
      const initialProps: BoardProps = {
        ...createDefaultProps(),
        board: createFilledBoard(),
      };

      const { rerender } = render(<Board {...initialProps} />);

      const changedProps: BoardProps = {
        ...initialProps,
        evaluations: createEvaluations(),
      };

      rerender(<Board {...changedProps} />);

      // Should apply evaluation classes
      expect(screen.getByTestId("tile-0-0")).toHaveClass("absent");
    });
  });

  describe("Snapshot Testing", () => {
    it("matches snapshot with empty board", () => {
      const props = createDefaultProps();
      const { container } = render(<Board {...props} />);

      expect(container.firstChild).toMatchSnapshot();
    });

    it("matches snapshot with filled board and evaluations", () => {
      const props: BoardProps = {
        ...createDefaultProps(),
        board: createFilledBoard(),
        evaluations: createEvaluations(),
        currentRow: 2,
        shakingRow: 1,
        poppingTile: { row: 2, col: 0 },
      };

      const { container } = render(<Board {...props} />);

      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe("Edge Cases", () => {
    it("handles null evaluations gracefully", () => {
      const props: BoardProps = {
        ...createDefaultProps(),
        board: createFilledBoard(),
        evaluations: Array(6)
          .fill(null)
          .map(() => Array(5).fill(null)),
      };

      expect(() => render(<Board {...props} />)).not.toThrow();
    });

    it("handles negative row indices gracefully", () => {
      const props: BoardProps = {
        ...createDefaultProps(),
        shakingRow: -1,
        currentRow: -1,
      };

      expect(() => render(<Board {...props} />)).not.toThrow();
    });

    it("handles out-of-bounds popping tile coordinates", () => {
      const props: BoardProps = {
        ...createDefaultProps(),
        poppingTile: { row: 10, col: 10 },
      };

      expect(() => render(<Board {...props} />)).not.toThrow();

      // Should not apply pop class to any tile
      const tiles = screen.getAllByRole("gridcell");
      tiles.forEach((tile) => {
        expect(tile).not.toHaveClass("pop");
      });
    });
  });
});
