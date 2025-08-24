import React from "react";
import styles from "./Footer.module.css";

export const Footer: React.FC = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.content}>
          <p className={styles.text}>© 2025 Wordle - Web Engineering Project</p>
          <div className={styles.links}>
            <a
              href="https://gitlab.dit.htwk-leipzig.de/Web-Engineering-2025-Wordle"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              Source Code
            </a>
            <span className={styles.separator}>•</span>
            <a
              href="https://www.htwk-leipzig.de"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              HTWK Leipzig
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
