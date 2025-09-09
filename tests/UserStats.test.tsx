import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UserStats } from "../src/components/profile/UserStats";

/**
 * Test Suite for User Statistics Component
 * Validates proper display of user statistics
 */
describe("UserStats Component", () => {
  const mockStats = {
    gamesPlayed: 10,
    gamesWon: 7,
    winRate: 70,
    averageGuesses: 4.2,
    currentStreak: 3,
    maxStreak: 5,
    guessDistribution: { "1": 1, "2": 2, "3": 3, "4": 1, "5": 0, "6": 0 },
  };

  test("displays user statistics correctly", () => {
    render(<UserStats stats={mockStats} />);

    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("Played")).toBeInTheDocument();
    expect(screen.getByText("Win %")).toBeInTheDocument();
  });

  test("shows loading state when stats are null", () => {
    render(<UserStats stats={null} />);
    expect(screen.getByText("Loading statistics...")).toBeInTheDocument();
  });

  test("displays guess distribution chart", () => {
    render(<UserStats stats={mockStats} />);
    expect(screen.getByText("Guess Distribution")).toBeInTheDocument();

    // Check for attempt numbers
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
