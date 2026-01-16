import renderer from "react-test-renderer";
import { GameResult } from "../src/components/game/GameResult";

describe("GameResult Component Snapshots", () => {
  const mockOnNewGame = jest.fn();

  jest.mock("react-dom", () => ({
    ...jest.requireActual("react-dom"),
    createPortal: (element: any) => element,
  }));

  test("win result matches snapshot", () => {
    const tree = renderer
      .create(
        <GameResult
          gameOver={true}
          won={true}
          onNewGame={mockOnNewGame}
          loading={false}
        />
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  test("loss result with solution matches snapshot", () => {
    const tree = renderer
      .create(
        <GameResult
          gameOver={true}
          won={false}
          solution="WORLD"
          onNewGame={mockOnNewGame}
          loading={false}
        />
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  test("loading state matches snapshot", () => {
    const tree = renderer
      .create(
        <GameResult
          gameOver={true}
          won={true}
          onNewGame={mockOnNewGame}
          loading={true}
        />
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
