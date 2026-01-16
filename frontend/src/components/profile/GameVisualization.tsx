import { memo } from "react";
import { GameVisualization as GameVisualizationType } from "../../types/index";
import { GameBoard } from "./GameBoard";
import "./GameVisualization.css";

interface GameVisualizationProps {
  visualization: GameVisualizationType;
  size?: "small" | "medium" | "large";
  interactive?: boolean;
  showMetadata?: boolean;
}

const GameVisualization = memo<GameVisualizationProps>(
  ({
    visualization,
    size = "medium",
    interactive = false,
    showMetadata = true,
  }) => {
    return (
      <div className={`gameVisualization gameVisualization--${size}`}>
        <GameBoard
          board={visualization.board}
          evaluations={visualization.colors}
          size={size}
          interactive={interactive}
        />
        {showMetadata && (
          <div className="gameMetadata">
            <span className="gameWord">
              Word: {visualization.metadata.word}
            </span>
            <span className="gameAttempts">
              Attempts: {visualization.metadata.attempts}/6
            </span>
            <span
              className={`gameResult ${
                visualization.metadata.won ? "won" : "lost"
              }`}
            >
              {visualization.metadata.won ? "Won" : "Lost"}
            </span>
          </div>
        )}
      </div>
    );
  }
);

export { GameVisualization };
