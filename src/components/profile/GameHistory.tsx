import React, { useEffect, useState } from "react";
import { profileService, GameRecord } from "../../services/profile";
import { authService, User } from "../../services/auth";

export const GameHistory: React.FC = () => {
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const loadGameHistory = async () => {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }

      setUser(currentUser);
      setLoading(true);

      try {
        // Fix: Convert number to string for API call
        const gameHistory = await profileService.getGameHistory(
          currentUser.id.toString()
        );
        setGameHistory(gameHistory);
      } catch (error) {
        console.error("Failed to load game history:", error);
      } finally {
        setLoading(false);
      }
    };

    loadGameHistory();
  }, []);

  if (loading) return <div>Loading game history...</div>;

  if (!user) return <div>Please log in to view game history.</div>;

  return (
    <div className="game-history">
      <h3>Game History</h3>
      {gameHistory.length === 0 ? (
        <p>No games played yet!</p>
      ) : (
        <div className="history-list">
          {gameHistory.map((game) => (
            <div key={game.id} className="history-item">
              <div className="game-word">{game.word}</div>
              <div className="game-result">
                <span className={`result-badge ${game.won ? "won" : "lost"}`}>
                  {game.won ? "Won" : "Lost"}
                </span>
                <span className="guess-count">{game.guesses} guesses</span>
              </div>
              <div className="game-date">
                {new Date(game.date).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
