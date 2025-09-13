// components/profile/AlbumForm.tsx
import React, { useState, useEffect } from "react";
import { GameAlbum, GameRecord, AlbumFormData } from "../../types";
import { LoadingSpinner } from "../layout/LoadingSpinner";
import "./AlbumForm.css";

interface AlbumFormProps {
  album?: GameAlbum | null;
  gameHistory: GameRecord[];
  onSubmit: (data: AlbumFormData) => Promise<void>;
  onCancel: () => void;
}

export const AlbumForm: React.FC<AlbumFormProps> = ({
  album,
  gameHistory,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<AlbumFormData>({
    title: "",
    description: "",
    selectedGameIds: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with album data if editing
  useEffect(() => {
    if (album) {
      setFormData({
        title: album.title,
        description: album.description,
        selectedGameIds: album.gameIds || [],
      });
    }
  }, [album]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError("Album title is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(formData);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to save album");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGameToggle = (gameId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedGameIds: prev.selectedGameIds.includes(gameId)
        ? prev.selectedGameIds.filter((id) => id !== gameId)
        : [...prev.selectedGameIds, gameId],
    }));
  };

  const getGameWord = (game: GameRecord): string => {
    return game.targetWord.toUpperCase();
  };

  const formatGameDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return "Unknown date";
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal album-form-modal">
        <div className="modal-header">
          <h3>{album ? "Edit Album" : "Create Album"}</h3>
          <button
            className="close-button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="album-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="title">Album Title *</label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="My Best Games"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Collection of my favorite Wordle games..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label>Select Games to Include</label>
            {gameHistory.length === 0 ? (
              <div className="no-games-message">
                <p>No games available. Play some games first!</p>
              </div>
            ) : (
              <div className="game-selection">
                {gameHistory.map((game) => {
                  const isSelected = formData.selectedGameIds.includes(
                    game.gameId
                  );
                  return (
                    <div
                      key={game.gameId}
                      className={`game-selection-item ${
                        isSelected ? "selected" : ""
                      }`}
                      onClick={() => handleGameToggle(game.gameId)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleGameToggle(game.gameId)}
                        disabled={isSubmitting}
                      />
                      <div className="game-info">
                        <span className="game-word">{getGameWord(game)}</span>
                        <span className="game-result">
                          {game.won ? "Won" : "Lost"} in {game.attempts}{" "}
                          attempts
                        </span>
                        <span className="game-date">
                          {formatGameDate(game.completedAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting || !formData.title.trim()}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="small" />
                  {album ? "Updating..." : "Creating..."}
                </>
              ) : album ? (
                "Update Album"
              ) : (
                "Create Album"
              )}
            </button>
            <button
              type="button"
              className="cancel-button"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
