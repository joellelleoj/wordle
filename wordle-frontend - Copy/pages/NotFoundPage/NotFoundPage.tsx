import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button/Button";
import styles from "./NotFoundPage.module.css";

export const NotFoundPage: React.FC = () => {
  return (
    <div className={styles.notFoundPage}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.error}>404</div>
          <h1 className={styles.title}>Page Not Found</h1>
          <p className={styles.description}>
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className={styles.actions}>
            <Link to="/">
              <Button variant="primary" size="large">
                Play Wordle
              </Button>
            </Link>
            <Link to="/search">
              <Button variant="outline" size="large">
                Search Players
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
