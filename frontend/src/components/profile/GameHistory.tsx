import { memo, useCallback } from "react";
import { GameHistoryProps } from "../../types/index";
import { GameVisualization } from "./GameVisualization";
import {
  generateGameVisualization,
  formatGameDate,
} from "../../utils/gameUtils";
import { LoadingSpinner } from "../layout/LoadingSpinner";
import "./GameHistory.css";

const GameHistory = memo<GameHistoryProps>(
  ({ games, loading = false, onGameSelect, showPagination = false }) => {
    const handleGameClick = useCallback(
      (gameId: string) => {
        onGameSelect?.(gameId);
      },
      [onGameSelect]
    );

    if (loading) {
      return (
        <div className="gameHistory">
          <LoadingSpinner size="large" />
        </div>
      );
    }

    if (games.length === 0) {
      return (
        <div className="gameHistory">
          <div className="emptyState">
            <h3>No games played yet</h3>
            <p>Start playing to see your game history!</p>
          </div>
        </div>
      );
    }

    return (
      <div className="gameHistory">
        <div className="gameList">
          {games.map((game) => {
            const visualization = generateGameVisualization(game);
            return (
              <div
                key={game.gameId}
                className="gameItem"
                onClick={() => handleGameClick(game.gameId)}
                role={onGameSelect ? "button" : undefined}
                tabIndex={onGameSelect ? 0 : undefined}
              >
                <div className="gameHeader">
                  <div className="gameDate">
                    {formatGameDate(game.completedAt)}
                  </div>
                </div>
                <GameVisualization
                  visualization={visualization}
                  size="small"
                  interactive={false}
                />
              </div>
            );
          })}
        </div>
        {showPagination && (
          <div className="pagination">
            {/* Pagination controls would go here */}
            <p className="gameCount">Showing {games.length} games</p>
          </div>
        )}
      </div>
    );
  }
);

export { GameHistory };
