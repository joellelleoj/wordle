import { renderHook, act, waitFor } from "@testing-library/react";
import { useGameLogic } from "../src/hooks/useGameLogic";
import { gameService } from "../src/services/game";
import { authService } from "../src/services/auth";

jest.mock("../src/services/game");
jest.mock("../src/services/auth");
jest.mock("../src/services/profile");

const mockGameService = gameService as jest.Mocked<typeof gameService>;
const mockAuthService = authService as jest.Mocked<typeof authService>;

describe("useGameLogic Hook", () => {
  beforeEach(() => {
    mockAuthService.getCurrentUser.mockReturnValue({
      id: "1",
      username: "testuser",
      email: "test@example.com",
    });

    mockGameService.createGame.mockResolvedValue({
      gameId: "test-game-id",
      board: Array(6)
        .fill(null)
        .map(() => Array(5).fill("")),
      evaluations: Array(6)
        .fill(null)
        .map(() => Array(5).fill(null)),
      currentRow: 0,
      gameOver: false,
      won: false,
      attempts: 0,
      guesses: [],
    });
  });

  test("initializes with loading state", async () => {
    const { result } = renderHook(() => useGameLogic());

    expect(result.current.loading).toBe(true);
    expect(result.current.gameState).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  test("creates new game on initialization", async () => {
    const { result } = renderHook(() => useGameLogic());

    await waitFor(() => {
      expect(mockGameService.createGame).toHaveBeenCalled();
      expect(result.current.gameState).not.toBe(null);
    });
  });

  test("handles letter key press correctly", async () => {
    const { result } = renderHook(() => useGameLogic());

    await waitFor(() => {
      expect(result.current.gameState).not.toBe(null);
    });

    await act(async () => {
      await result.current.handleKeyPress("A");
    });

    expect(result.current.gameState?.board[0][0]).toBe("A");
  });

  test("starts new game correctly", async () => {
    const { result } = renderHook(() => useGameLogic());

    await waitFor(() => {
      expect(result.current.gameState).not.toBe(null);
    });

    // Mock new game creation with proper array structure
    mockGameService.createGame.mockResolvedValueOnce({
      gameId: "new-game-id",
      board: Array(6)
        .fill(null)
        .map(() => Array(5).fill("")),
      evaluations: Array(6)
        .fill(null)
        .map(() => Array(5).fill(null)),
      currentRow: 0,
      gameOver: false,
      won: false,
      attempts: 0,
      guesses: [],
    });

    await act(async () => {
      await result.current.startNewGame();
    });

    expect(mockGameService.createGame).toHaveBeenCalledTimes(2);
    expect(result.current.gameState?.gameId).toBe("new-game-id");
  });
});
