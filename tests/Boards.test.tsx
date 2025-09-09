import React from "react";
import { render } from "@testing-library/react";
import { Board } from "../src/components/game/Board";

/**
 * Snapshot Test for Board Component
 * Ensures UI consistency and prevents regressions
 */
describe("Board Component", () => {
  const defaultProps = {
    board: Array(6)
      .fill(null)
      .map(() => Array(5).fill("")),
    evaluations: Array(6)
      .fill(null)
      .map(() => Array(5).fill(null)),
    shakingRow: null,
    poppingTile: null,
    currentRow: 0,
  };

  test("renders board with empty tiles", () => {
    const { container } = render(<Board {...defaultProps} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  test("renders board with filled tiles", () => {
    const props = {
      ...defaultProps,
      board: [
        ["H", "E", "L", "L", "O"],
        ...Array(5)
          .fill(null)
          .map(() => Array(5).fill("")),
      ],
      evaluations: [
        ["correct", "present", "absent", "present", "correct"],
        ...Array(5)
          .fill(null)
          .map(() => Array(5).fill(null)),
      ],
    };

    const { container } = render(<Board {...props} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
