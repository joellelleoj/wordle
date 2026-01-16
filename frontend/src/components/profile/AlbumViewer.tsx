// components/profile/AlbumViewer.tsx - FIXED VERSION with proper navigation
import React, { useState, useEffect, useCallback } from "react";
import { GameAlbum, GameRecord } from "../../types";
import { GameVisualization } from "./GameVisualization";
import { LoadingSpinner } from "../layout/LoadingSpinner";
import { profileService } from "../../services/profile";
import { generateGameVisualization } from "../../utils/gameUtils";
import "./AlbumViewer.css";

interface AlbumViewerProps {
  album: GameAlbum;
  onClose: () => void;
}

export const AlbumViewer: React.FC<AlbumViewerProps> = ({ album, onClose }) => {
  const [games, setGames] = useState<GameRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAlbumGames = async () => {
      try {
        setLoading(true);
        setError(null);

        const albumWithGames = await profileService.getAlbumWithGames(album.id);

        if (albumWithGames.games && albumWithGames.games.length > 0) {
          setGames(albumWithGames.games);
        } else {
          setGames([]);
        }
      } catch (error) {
        setError("Failed to load album games");
        console.error("Failed to load album games:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAlbumGames();
  }, [album.id]);

  const nextGame = useCallback(() => {
    if (games.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % games.length);
    }
  }, [games.length]);

  const prevGame = useCallback(() => {
    if (games.length > 1) {
      setCurrentIndex((prev) => (prev - 1 + games.length) % games.length);
    }
  }, [games.length]);

  /*const goToGame = useCallback(
    (index: number) => {
      if (index >= 0 && index < games.length) {
        setCurrentIndex(index);
      }
    },
    [games.length]
  );*/

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          prevGame();
          break;
        case "ArrowRight":
          e.preventDefault();
          nextGame();
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [nextGame, prevGame, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal album-viewer-modal">
          <div className="modal-header">
            <h3>{album.title}</h3>
            <button className="close-button" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="album-viewer-content">
            <LoadingSpinner size="large" message="Loading album..." />
          </div>
        </div>
      </div>
    );
  }

  if (error || games.length === 0) {
    return (
      <div className="modal-overlay">
        <div className="modal album-viewer-modal">
          <div className="modal-header">
            <h3>{album.title}</h3>
            <button className="close-button" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="album-empty">
            <p>{error || "No games in this album yet."}</p>
            <button className="retry-button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentGame = games[currentIndex];
  const visualization = generateGameVisualization(currentGame);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal album-viewer-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{album.title}</h3>
          <div className="album-counter">
            {currentIndex + 1} of {games.length}
          </div>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="album-viewer-content">
          {/* Navigation Controls */}
          <div className="album-controls">
            <button
              className="nav-button prev-button"
              onClick={prevGame}
              disabled={games.length <= 1}
              title="Previous game (←)"
            >
              ← Previous
            </button>

            <button
              className="nav-button next-button"
              onClick={nextGame}
              disabled={games.length <= 1}
              title="Next game (→)"
            >
              Next →
            </button>
          </div>

          {/* Game Display */}
          <div className="album-game-display">
            <GameVisualization
              visualization={visualization}
              size="large"
              interactive={false}
              showMetadata={true}
            />
          </div>

          {/* Album Description */}
          {album.description && (
            <div className="album-description">
              <p>{album.description}</p>
            </div>
          )}

          {/* Navigation Instructions */}
          <div className="album-instructions">
            <p>Use arrow keys ← → to navigate • Press ESC to close</p>
          </div>
        </div>
      </div>
    </div>
  );
};
