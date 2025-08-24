import React, { useState } from "react";
import { Button } from "../../ui/Button/Button";
import { Modal } from "../../ui/Modal/Modal";
import { GameResult, GamePost } from "../../../types/user";
import { generateShareText } from "../../../services/utils/gameLogic";
import styles from "./GameHistory.module.css";

interface GameHistoryProps {
  gameHistory: GameResult[];
  posts: GamePost[];
  isOwnProfile: boolean;
  onRefresh: () => void;
}

export const GameHistory: React.FC<GameHistoryProps> = ({
  gameHistory,
  posts,
  isOwnProfile,
  onRefresh,
}) => {
  const [selectedGame, setSelectedGame] = useState<GameResult | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [postComment, setPostComment] = useState("");

  const handleShareGame = (game: GameResult) => {
    const shareText = generateShareText(
      game.guesses,
      game.guessFeedback,
      game.attempts,
      game.won
    );

    if (navigator.share) {
      navigator.share({
        text: shareText,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(shareText);
      // Show toast notification
    }
  };

  const handleCreatePost = async (game: GameResult) => {
    setSelectedGame(game);
    setShowPostModal(true);
  };

  const submitPost = async () => {
    if (!selectedGame) return;

    try {
      // Call API to create post
      // await userService.createGamePost({
      //   gameResultId: selectedGame.id,
      //   comment: postComment.trim() || undefined,
      //   isPublic: true
      // }, token);

      setShowPostModal(false);
      setPostComment("");
      setSelectedGame(null);
      onRefresh();
    } catch (error) {
      console.error("Failed to create post:", error);
    }
  };

  return (
    <div className={styles.gameHistory}>
      <div className={styles.header}>
        <h2 className={styles.title}>Game History</h2>
      </div>

      {gameHistory.length === 0 ? (
        <div className={styles.empty}>
          <p>No games played yet.</p>
        </div>
      ) : (
        <div className={styles.gameList}>
          {gameHistory.map((game) => (
            <div key={game.id} className={styles.gameCard}>
              <div className={styles.gameInfo}>
                <div className={styles.gameResult}>
                  <span
                    className={`${styles.resultBadge} ${
                      game.won ? styles.won : styles.lost
                    }`}
                  >
                    {game.won ? `${game.attempts}/6` : "X/6"}
                  </span>
                  <span className={styles.word}>{game.word}</span>
                </div>

                <div className={styles.gameMeta}>
                  <span className={styles.date}>
                    {new Date(game.createdAt).toLocaleDateString()}
                  </span>
                  <span className={styles.duration}>{game.duration}s</span>
                </div>
              </div>

              <div className={styles.gamePattern}>
                {game.guessFeedback.map((guess, rowIndex) => (
                  <div key={rowIndex} className={styles.patternRow}>
                    {guess.map((feedback, tileIndex) => (
                      <div
                        key={tileIndex}
                        className={`${styles.patternTile} ${
                          styles[feedback.status]
                        }`}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <div className={styles.gameActions}>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => handleShareGame(game)}
                >
                  Share
                </Button>

                {isOwnProfile && (
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => handleCreatePost(game)}
                  >
                    Post
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Modal */}
      <Modal
        isOpen={showPostModal}
        onClose={() => setShowPostModal(false)}
        title="Share Game"
        size="medium"
      >
        <div className={styles.postModal}>
          <div className={styles.gamePreview}>
            {selectedGame && (
              <div className={styles.previewPattern}>
                {selectedGame.guessFeedback.map((guess, rowIndex) => (
                  <div key={rowIndex} className={styles.previewRow}>
                    {guess.map((feedback, tileIndex) => (
                      <div
                        key={tileIndex}
                        className={`${styles.previewTile} ${
                          styles[feedback.status]
                        }`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.commentSection}>
            <label htmlFor="postComment" className={styles.commentLabel}>
              Add a comment (optional):
            </label>
            <textarea
              id="postComment"
              value={postComment}
              onChange={(e) => setPostComment(e.target.value)}
              placeholder="Share your thoughts about this game..."
              className={styles.commentInput}
              rows={3}
              maxLength={500}
            />
          </div>

          <div className={styles.postActions}>
            <Button variant="outline" onClick={() => setShowPostModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitPost}>
              Post to Profile
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
