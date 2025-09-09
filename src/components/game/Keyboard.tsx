import React, { memo } from "react";

interface KeyboardProps {
  onKeyPress: (key: string) => void;
  usedLetters: Map<string, "correct" | "present" | "absent">;
  disabled?: boolean;
}

/**
 * Keyboard Component: Renders interactive keyboard
 *
 * - Provides touch/click interface for letter input
 * - Shows color feedback for letter states based on guesses
 * - Can be disabled during loading states or animations
 *
 * @param KeyboardProps containing event handler and keyboard state
 * @returns JSX.Element representing the keyboard
 */
export const Keyboard: React.FC<KeyboardProps> = memo(
  ({ onKeyPress, usedLetters, disabled = false }) => {
    const rows = [
      ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
      ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
      ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
    ];

    return (
      <div className="keyboard">
        {rows.map((row, i) => (
          <div key={i} className="keyboard-row">
            {row.map((key) => {
              const keyClass =
                key === "ENTER" || key === "⌫" ? "key wide" : "key";
              return (
                <button
                  key={key}
                  className={`${keyClass} ${usedLetters.get(key) || ""} ${
                    disabled ? "disabled" : ""
                  }`}
                  onClick={() =>
                    !disabled && onKeyPress(key === "⌫" ? "BACKSPACE" : key)
                  }
                  disabled={disabled}
                >
                  {key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    const usedLettersEqual =
      prevProps.usedLetters.size === nextProps.usedLetters.size &&
      [...prevProps.usedLetters.entries()].every(
        ([key, value]) => nextProps.usedLetters.get(key) === value
      );

    return (
      prevProps.onKeyPress === nextProps.onKeyPress &&
      usedLettersEqual &&
      prevProps.disabled === nextProps.disabled
    );
  }
);
