import React, { createContext, useContext, ReactNode } from "react";
import { useGame } from "../hooks/useGame";
import { GameState, KeyboardState, TileStatus } from "../types/game";

interface GameContextType {
  gameState: GameState;
  keyboardState: KeyboardState;
  isLoading: boolean;
  error: string | null;
  animateLastRow: boolean;
  shakeCurrentRow: boolean;
  handleKeyPress: (key: string) => void;
  startNewGame: () => Promise<void>;
  canStartNewGame: boolean;
}

const GameContext = createContext<GameContextType | null>(null);

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const gameLogic = useGame();

  return (
    <GameContext.Provider value={gameLogic}>{children}</GameContext.Provider>
  );
};

export const useGameContext = (): GameContextType => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGameContext must be used within a GameProvider");
  }
  return context;
};
