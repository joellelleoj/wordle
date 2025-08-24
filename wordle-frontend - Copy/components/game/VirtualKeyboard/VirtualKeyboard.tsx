import React from "react";
import { TileStatus, KeyboardState } from "../../../types/game";
import { GAME_CONFIG } from "../../../services/utils/constants";
import styles from "./VirtualKeyboard.module.css";

interface VirtualKeyboardProps {
  onKeyPress: (key: string) => void;
  keyboardState: KeyboardState; // Use KeyboardState instead of keyStatuses
  disabled?: boolean;
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  onKeyPress,
  keyboardState,
  disabled = false,
}) => {
  const getKeyStatus = (key: string): TileStatus => {
    return keyboardState[key] || TileStatus.EMPTY;
  };

  const renderKey = (key: string, index: number) => {
    const isSpecial = key === "ENTER" || key === "BACKSPACE";
    const status = getKeyStatus(key);

    const keyClasses = [
      styles.key,
      isSpecial && styles.special,
      styles[status], // This maps to CSS classes: .correct, .present, .absent, .empty
      disabled && styles.disabled,
    ]
      .filter(Boolean)
      .join(" ");

    const keyLabel =
      key === "BACKSPACE" ? "⌫" : key === "ENTER" ? "ENTER" : key;

    return (
      <button
        key={`${key}-${index}`} // More specific key to avoid conflicts
        className={keyClasses}
        onClick={() => !disabled && onKeyPress(key)}
        disabled={disabled}
        data-testid={`keyboard-key-${key}`}
        aria-label={`Key ${key}${
          status !== TileStatus.EMPTY ? ` (${status})` : ""
        }`}
      >
        {keyLabel}
      </button>
    );
  };

  return (
    <div
      className={styles.keyboard}
      data-testid="virtual-keyboard"
      role="group"
      aria-label="Virtual keyboard"
    >
      {GAME_CONFIG.KEYBOARD_LAYOUTS.QWERTY.map((row, rowIndex) => (
        <div key={`row-${rowIndex}`} className={styles.row}>
          {row.map((key, keyIndex) => renderKey(key, keyIndex))}
        </div>
      ))}
    </div>
  );
};
