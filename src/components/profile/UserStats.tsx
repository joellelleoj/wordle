import { memo } from "react";
import { UserStatsProps } from "../../types/index";
import { LoadingSpinner } from "../layout/LoadingSpinner";
import "./UserStats.css";

const UserStats = memo<UserStatsProps>(
  ({ stats, loading = false, size = "full" }) => {
    if (loading) {
      return (
        <div className={`userStats userStats--${size}`}>
          <LoadingSpinner size="medium" />
        </div>
      );
    }

    if (!stats) {
      return (
        <div className={`userStats userStats--${size}`}>
          <p className="noStats">No statistics available</p>
        </div>
      );
    }

    const distributionEntries = Object.entries(stats.guessDistribution);
    const maxDistribution = Math.max(
      ...distributionEntries.map(([, count]) => count),
      1
    );

    return (
      <div className={`userStats userStats--${size}`}>
        <h3 className="title">Statistics</h3>
        <div className="statsGrid">
          <div className="statItem">
            <span className="statValue">{stats.totalGames}</span>
            <span className="statLabel">Played</span>
          </div>
          <div className="statItem">
            <span className="statValue">{stats.wins}</span>
            <span className="statLabel">Won</span>
          </div>

          <div className="statItem">
            <span className="statValue">{stats.winRate}%</span>
            <span className="statLabel">Win Rate</span>
          </div>

          {size === "full" && (
            <>
              <div className="statItem">
                <span className="statValue">
                  {stats.averageAttempts.toFixed(1)}
                </span>
                <span className="statLabel">Avg Attempts</span>
              </div>
            </>
          )}
        </div>
        {size === "full" && (
          <div className="guessDistribution">
            <h4 className="distributionTitle">Guess Distribution</h4>
            {distributionEntries.map(([attempts, count]) => {
              const percentage =
                maxDistribution > 0 ? (count / maxDistribution) * 100 : 0;
              return (
                <div key={attempts} className="distributionRow">
                  <div className="attemptsLabel">{attempts}</div>
                  <div className="distributionBar">
                    <div
                      className="barFill"
                      style={{
                        width: `${Math.max(percentage, count > 0 ? 8 : 0)}%`,
                      }}
                    >
                      <span className="countLabel">{count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

export { UserStats };
