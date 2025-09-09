import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "../src/App";

// Mock services
jest.mock("../services/authService", () => ({
  authService: {
    getCurrentUser: jest.fn(),
    verifyToken: jest.fn(),
    logout: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
  },
}));

jest.mock("../services/gameService");
jest.mock("../services/profileService");

/**
 * Test Suite for Main Application Component
 * Ensures proper rendering and navigation functionality
 */
describe("App Component", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  test("renders application header", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("WORDLE")).toBeInTheDocument();
    });
  });

  test("renders game page by default", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Loading game...")).toBeInTheDocument();
    });
  });

  test("displays loading overlay during initialization", () => {
    render(<App />);
    expect(screen.getByText("Loading application...")).toBeInTheDocument();
  });
});
