import React from "react";
import { UserStats as UserStatsType } from "../../services/profile";

interface UserStatsProps {
  stats: UserStatsType;
}

export const UserStats: React.FC<UserStatsProps> = ({ stats }) => {
  // Fix: Ensure guessDistribution exists and get max safely
  const guessDistribution = stats.guessDistribution || {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  };
  const distributionValues = Object.values(guessDistribution);
  const maxDistribution =
    distributionValues.length > 0 ? Math.max(...distributionValues) : 1;

  return (
    <div className="user-stats">
      <h3>Statistics</h3>

      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-number">{stats.gamesPlayed}</div>
          <div className="stat-label">Played</div>
        </div>

        <div className="stat-item">
          <div className="stat-number">{stats.winRate}%</div>
          <div className="stat-label">Win %</div>
        </div>

        <div className="stat-item">
          <div className="stat-number">{stats.currentStreak}</div>
          <div className="stat-label">Current Streak</div>
        </div>

        <div className="stat-item">
          <div className="stat-number">{stats.maxStreak}</div>
          <div className="stat-label">Max Streak</div>
        </div>
      </div>

      <div className="guess-distribution">
        <h4>Guess Distribution</h4>
        {Object.entries(guessDistribution).map(([attempts, count]) => {
          // Fix: Ensure count is a number and handle type properly
          const numCount = typeof count === "number" ? count : 0;
          const percentage =
            maxDistribution > 0 ? (numCount / maxDistribution) * 100 : 0;

          return (
            <div key={attempts} className="distribution-row">
              <div className="attempts-label">{attempts}</div>
              <div className="distribution-bar">
                <div
                  className="bar-fill"
                  style={{
                    width: `${Math.max(percentage, 0)}%`,
                    backgroundColor: numCount > 0 ? "#538d4e" : "#3a3a3c",
                  }}
                >
                  <span className="count-label">{numCount}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
