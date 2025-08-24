import React from "react";
import { ProfileStats } from "../../components/profile/ProfileStats/ProfileStats";
import { StatsChart } from "../../components/profile/StatsChart/StatsChart";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./StatisticsPage.module.css";

/**
 * Statistics Page Component
 *
 * Dedicated statistics page showing:
 * - Detailed game statistics
 * - Performance charts and graphs
 * - Historical data visualization
 */
export const StatisticsPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className={styles.statisticsPage}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Your Statistics</h1>
          <p className={styles.subtitle}>
            Track your Wordle performance and progress over time
          </p>
        </header>

        <div className={styles.content}>
          <section className={styles.statsSection}>
            <h2 className={styles.sectionTitle}>Overview</h2>
            <ProfileStats userId={user?.id} showDetailed={true} />
          </section>

          <section className={styles.chartsSection}>
            <h2 className={styles.sectionTitle}>Performance Charts</h2>
            <StatsChart userId={user?.id} />
          </section>
        </div>
      </div>
    </div>
  );
};
