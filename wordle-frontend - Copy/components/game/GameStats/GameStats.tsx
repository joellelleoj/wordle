import React, { useEffect, useState } from "react";
import { userService } from "../../../services/api/userService";
import { useAuth } from "../../../contexts/AuthContext";
import { LoadingSpinner } from "../../ui/LoadingSpinner/LoadingSpinner";
import { GameStats as GameStatsType } from "../../../types/game";
import styles from "./GameStats.module.css";

interface GameStatsProps {
  userId?: string;
  showDetailed?: boolean;
}

export const GameStats: React.FC<GameStatsProps> = ({
  userId,
  showDetailed = false,
}) => {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<GameStatsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      loadStats();
    }
  }, [targetUserId]);

  const loadStats = async () => {
    if (!targetUserId) return;

    setIsLoading(true);
    setError(null);

    try {
      const userStats = await userService.getUserStats(
        targetUserId,
        token || undefined
      );
      setStats(userStats);
    } catch (err: any) {
      setError(err.message || "Failed to load statistics");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>Failed to load statistics: {error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={styles.noData}>
        <p>No statistics available yet. Play some games to see your stats!</p>
      </div>
    );
  }

  return (
    <div className={styles.statsContainer}>
      <div className={styles.overview}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.totalGames}</span>
          <span className={styles.statLabel}>Played</span>
        </div>

        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.winRate}%</span>
          <span className={styles.statLabel}>Win %</span>
        </div>

        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.currentStreak}</span>
          <span className={styles.statLabel}>Current Streak</span>
        </div>

        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.maxStreak}</span>
          <span className={styles.statLabel}>Max Streak</span>
        </div>
      </div>

      {showDetailed && (
        <div className={styles.distribution}>
          <h3 className={styles.distributionTitle}>Guess Distribution</h3>
          <div className={styles.distributionChart}>
            {Object.entries(stats.guessDistribution).map(
              ([attempts, count]) => (
                <div key={attempts} className={styles.distributionRow}>
                  <span className={styles.distributionNumber}>{attempts}</span>
                  <div className={styles.distributionBar}>
                    <div
                      className={styles.distributionFill}
                      style={{
                        width:
                          stats.totalWins > 0
                            ? `${(count / stats.totalWins) * 100}%`
                            : "0%",
                      }}
                    />
                    <span className={styles.distributionCount}>{count}</span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {stats.averageAttempts > 0 && (
        <div className={styles.additional}>
          <div className={styles.additionalStat}>
            <span className={styles.additionalLabel}>Average Attempts:</span>
            <span className={styles.additionalValue}>
              {stats.averageAttempts.toFixed(1)}
            </span>
          </div>

          {stats.fastestWin && (
            <div className={styles.additionalStat}>
              <span className={styles.additionalLabel}>Fastest Win:</span>
              <span className={styles.additionalValue}>
                {stats.fastestWin}s
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
