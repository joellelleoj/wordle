import renderer from "react-test-renderer";
interface KeyboardProps {
  onKeyPress: (key: string) => void;
  usedLetters: Map<string, string>;
  disabled?: boolean;
}

const rows = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
];

export const Keyboard: React.FC<KeyboardProps> = ({
  onKeyPress,
  usedLetters,
  disabled = false,
}) => {
  return (
    <div className="keyboard">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="keyboardRow">
          {row.map((key) => {
            const keyState = usedLetters.get(key);
            const isWideKey = key === "ENTER" || key === "BACKSPACE";

            return (
              <button
                key={key}
                className={`key ${isWideKey ? "keyWide" : ""} ${
                  keyState ? `key--${keyState}` : ""
                } ${disabled ? "disabled" : ""}`}
                onClick={() => !disabled && onKeyPress(key)}
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
};
describe("Keyboard Component Snapshots", () => {
  const mockOnKeyPress = jest.fn();

  test("clean keyboard matches snapshot", () => {
    const props = {
      onKeyPress: mockOnKeyPress,
      usedLetters: new Map(),
      disabled: false,
    };

    const tree = renderer.create(<Keyboard {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test("keyboard with letter states matches snapshot", () => {
    const usedLetters = new Map([
      ["W", "correct"],
      ["O", "absent"],
      ["R", "present"],
      ["L", "absent"],
      ["D", "correct"],
      ["A", "absent"],
      ["S", "present"],
    ]);

    const props = {
      onKeyPress: mockOnKeyPress,
      usedLetters,
      disabled: false,
    };

    const tree = renderer.create(<Keyboard {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test("disabled keyboard matches snapshot", () => {
    const props = {
      onKeyPress: mockOnKeyPress,
      usedLetters: new Map(),
      disabled: true,
    };

    const tree = renderer.create(<Keyboard {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
