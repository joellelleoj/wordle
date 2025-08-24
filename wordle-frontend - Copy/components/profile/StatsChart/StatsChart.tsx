import React, { useEffect, useState } from "react";
import { userService } from "../../../services/api/userService";
import { useAuth } from "../../../contexts/AuthContext";
import { LoadingSpinner } from "../../ui/LoadingSpinner/LoadingSpinner";
import { GameStats } from "../../../types/game";
import styles from "./StatsChart.module.css";

interface StatsChartProps {
  userId?: string;
}

export const StatsChart: React.FC<StatsChartProps> = ({ userId }) => {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<GameStats | null>(null);
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
        <p>Failed to load chart data: {error}</p>
      </div>
    );
  }

  if (!stats || stats.totalGames === 0) {
    return (
      <div className={styles.noData}>
        <p>
          No data available for charts. Play some games to see your statistics!
        </p>
      </div>
    );
  }

  const maxCount = Math.max(...Object.values(stats.guessDistribution));

  return (
    <div className={styles.statsChart}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Guess Distribution</h3>
        <div className={styles.chart}>
          {Object.entries(stats.guessDistribution).map(([attempts, count]) => (
            <div key={attempts} className={styles.chartRow}>
              <span className={styles.attemptNumber}>{attempts}</span>
              <div className={styles.barContainer}>
                <div
                  className={styles.bar}
                  style={{
                    width: maxCount > 0 ? `${(count / maxCount) * 100}%` : "0%",
                    minWidth: count > 0 ? "20px" : "0px",
                  }}
                />
                <span className={styles.count}>{count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Performance Overview</h3>
        <div className={styles.performanceGrid}>
          <div className={styles.performanceCard}>
            <div className={styles.performanceValue}>{stats.winRate}%</div>
            <div className={styles.performanceLabel}>Success Rate</div>
          </div>

          <div className={styles.performanceCard}>
            <div className={styles.performanceValue}>
              {stats.averageAttempts.toFixed(1)}
            </div>
            <div className={styles.performanceLabel}>Avg Attempts</div>
          </div>

          <div className={styles.performanceCard}>
            <div className={styles.performanceValue}>{stats.currentStreak}</div>
            <div className={styles.performanceLabel}>Current Streak</div>
          </div>

          <div className={styles.performanceCard}>
            <div className={styles.performanceValue}>{stats.maxStreak}</div>
            <div className={styles.performanceLabel}>Best Streak</div>
          </div>
        </div>
      </div>

      {stats.fastestWin && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Records</h3>
          <div className={styles.records}>
            <div className={styles.record}>
              <span className={styles.recordLabel}>Fastest Win:</span>
              <span className={styles.recordValue}>{stats.fastestWin}s</span>
            </div>
            {stats.hardestWord && (
              <div className={styles.record}>
                <span className={styles.recordLabel}>Hardest Word:</span>
                <span className={styles.recordValue}>{stats.hardestWord}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
