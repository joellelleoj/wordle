import { memo, useCallback } from "react";
import { KeyboardProps } from "../../types/game";
import "./Keyboard.css";

const rows = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
];

/**
 * Keyboard Component
 *
 * Renders a keyboard interface for the Wordle game
 * Displays letter keys with their evaluation states (correct/present/absent)
 * and action keys (ENTER, BACKSPACE) for game interaction.
 *
 * @param onKeyPress - Callback function called when any key is pressed
 * @param usedLetters - Map of letters to their evaluation states
 * @param disabled - Whether the keyboard should be disabled
 *
 */
const Keyboard = memo<KeyboardProps>(
  ({ onKeyPress, usedLetters, disabled = false }) => {
    const handleKeyClick = useCallback(
      (key: string) => {
        if (!disabled) {
          onKeyPress(key);
        }
      },
      [onKeyPress, disabled]
    );

    return (
      <div className="keyboard">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="keyboardRow">
            {row.map((key) => {
              const keyState = usedLetters.get(key);
              const isWideKey = key === "ENTER" || key === "BACKSPACE";

              const keyClasses = [
                "key",
                isWideKey && "keyWide",
                keyState && `key--${keyState}`,
                disabled && "disabled",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={key}
                  className={keyClasses}
                  onClick={() => handleKeyClick(key)}
                  disabled={disabled}
                  data-testid={`key-${key}`}
                >
                  {key === "BACKSPACE" ? "⌫" : key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
  areKeyboardPropsEqual
);

function areKeyboardPropsEqual(
  prevProps: KeyboardProps,
  nextProps: KeyboardProps
): boolean {
  if (prevProps.usedLetters.size !== nextProps.usedLetters.size) {
    return false;
  }

  for (const [key, value] of prevProps.usedLetters.entries()) {
    if (nextProps.usedLetters.get(key) !== value) {
      return false;
    }
  }

  return (
    prevProps.onKeyPress === nextProps.onKeyPress &&
    prevProps.disabled === nextProps.disabled
  );
}
Keyboard.displayName = "Keyboard";
export { Keyboard };
