import React from "react";
import { GameTile } from "../GameTile/GameTile";
import { TileStatus } from "../../../types/game";
import styles from "./GameRules.module.css";

export const GameRules: React.FC = () => {
  return (
    <div className={styles.rulesContainer}>
      <div className={styles.section}>
        <h3>How to Play</h3>
        <p>Guess the WORDLE in 6 tries.</p>
        <ul>
          <li>Each guess must be a valid 5-letter word.</li>
          <li>Hit the enter button to submit.</li>
          <li>
            After each guess, the color of the tiles will change to show how
            close your guess was to the word.
          </li>
        </ul>
      </div>

      <div className={styles.section}>
        <h3>Examples</h3>

        <div className={styles.example}>
          <div className={styles.exampleRow}>
            <GameTile letter="W" status={TileStatus.CORRECT} />
            <GameTile letter="E" status={TileStatus.EMPTY} />
            <GameTile letter="A" status={TileStatus.EMPTY} />
            <GameTile letter="R" status={TileStatus.EMPTY} />
            <GameTile letter="Y" status={TileStatus.EMPTY} />
          </div>
          <p>
            <strong>W</strong> is in the word and in the correct spot.
          </p>
        </div>

        <div className={styles.example}>
          <div className={styles.exampleRow}>
            <GameTile letter="P" status={TileStatus.EMPTY} />
            <GameTile letter="I" status={TileStatus.PRESENT} />
            <GameTile letter="L" status={TileStatus.EMPTY} />
            <GameTile letter="L" status={TileStatus.EMPTY} />
            <GameTile letter="S" status={TileStatus.EMPTY} />
          </div>
          <p>
            <strong>I</strong> is in the word but in the wrong spot.
          </p>
        </div>

        <div className={styles.example}>
          <div className={styles.exampleRow}>
            <GameTile letter="V" status={TileStatus.EMPTY} />
            <GameTile letter="A" status={TileStatus.EMPTY} />
            <GameTile letter="G" status={TileStatus.EMPTY} />
            <GameTile letter="U" status={TileStatus.ABSENT} />
            <GameTile letter="E" status={TileStatus.EMPTY} />
          </div>
          <p>
            <strong>U</strong> is not in the word in any spot.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Additional Features</h3>
        <ul>
          <li>Create an account to track your statistics</li>
          <li>Share your results with friends</li>
          <li>View other players' profiles</li>
          <li>Post your completed games with comments</li>
        </ul>
      </div>
    </div>
  );
};
