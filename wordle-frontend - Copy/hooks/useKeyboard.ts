import { useEffect, useCallback } from "react";

interface UseKeyboardProps {
  onKeyPress: (key: string) => void;
  disabled?: boolean;
}

/**
 * Keyboard Hook - Handles physical keyboard input
 *
 * Maps physical keyboard events to game key presses
 */
export const useKeyboard = ({
  onKeyPress,
  disabled = false,
}: UseKeyboardProps) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) return;

      const key = event.key.toUpperCase();

      // Prevent default for game keys
      if (/^[A-Z]$/.test(key) || key === "ENTER" || key === "BACKSPACE") {
        event.preventDefault();
        onKeyPress(key);
      }
    },
    [onKeyPress, disabled]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
};
