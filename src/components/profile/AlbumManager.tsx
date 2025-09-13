// components/profile/AlbumManager.tsx - FIXED VERSION with proper functionality
import React, { useState, useCallback } from "react";
import { GameAlbum, GameRecord, AlbumFormData } from "../../types";
import { LoadingSpinner } from "../layout/LoadingSpinner";
import { AlbumForm } from "./AlbumForm";
import { AlbumViewer } from "./AlbumViewer";
import "./AlbumManager.css";

interface AlbumManagerProps {
  albums: GameAlbum[];
  gameHistory: GameRecord[];
  loading: boolean;
  onCreateAlbum: (data: AlbumFormData) => Promise<void>;
  onUpdateAlbum: (id: string, data: Partial<AlbumFormData>) => Promise<void>;
  onDeleteAlbum: (id: string) => Promise<void>;
  selectedAlbum?: GameAlbum | null;
  onSelectAlbum: (album: GameAlbum | null) => void;
}

export const AlbumManager: React.FC<AlbumManagerProps> = ({
  albums,
  gameHistory,
  loading,
  onCreateAlbum,
  onUpdateAlbum,
  onDeleteAlbum,
  selectedAlbum,
  onSelectAlbum,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<GameAlbum | null>(null);
  const [viewingAlbum, setViewingAlbum] = useState<GameAlbum | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FIXED: Proper create album handler
  const handleCreateAlbum = useCallback(
    async (data: AlbumFormData) => {
      try {
        setIsSubmitting(true);
        await onCreateAlbum(data);
        setShowCreateForm(false);
        setEditingAlbum(null);
      } catch (error) {
        console.error("Failed to create album:", error);
        throw error; // Let the form handle the error display
      } finally {
        setIsSubmitting(false);
      }
    },
    [onCreateAlbum]
  );

  // FIXED: Proper update album handler
  const handleUpdateAlbum = useCallback(
    async (data: Partial<AlbumFormData>) => {
      if (!editingAlbum) return;

      try {
        setIsSubmitting(true);
        await onUpdateAlbum(editingAlbum.id, data);
        setEditingAlbum(null);
        setShowCreateForm(false);
      } catch (error) {
        console.error("Failed to update album:", error);
        throw error; // Let the form handle the error display
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingAlbum, onUpdateAlbum]
  );

  // FIXED: Proper delete handler with confirmation
  const handleDeleteAlbum = useCallback(
    async (albumId: string) => {
      const album = albums.find((a) => a.id === albumId);
      if (!album) return;

      const confirmMessage = `Are you sure you want to delete "${album.title}"? This action cannot be undone.`;
      if (!window.confirm(confirmMessage)) return;

      try {
        await onDeleteAlbum(albumId);

        // Close viewer if viewing deleted album
        if (viewingAlbum?.id === albumId) {
          setViewingAlbum(null);
        }
        if (selectedAlbum?.id === albumId) {
          onSelectAlbum(null);
        }
      } catch (error) {
        console.error("Failed to delete album:", error);
        alert("Failed to delete album. Please try again.");
      }
    },
    [albums, onDeleteAlbum, viewingAlbum, selectedAlbum, onSelectAlbum]
  );

  // FIXED: Proper view album handler
  const handleViewAlbum = useCallback(
    (album: GameAlbum) => {
      setViewingAlbum(album);
      onSelectAlbum(album);
    },
    [onSelectAlbum]
  );

  const handleCloseViewer = useCallback(() => {
    setViewingAlbum(null);
    onSelectAlbum(null);
  }, [onSelectAlbum]);

  // FIXED: Proper edit album handler
  const handleEditAlbum = useCallback((album: GameAlbum) => {
    setEditingAlbum(album);
    setShowCreateForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowCreateForm(false);
    setEditingAlbum(null);
  }, []);

  // FIXED: Create new album handler
  const handleCreateNew = useCallback(() => {
    setEditingAlbum(null);
    setShowCreateForm(true);
  }, []);

  if (loading) {
    return <LoadingSpinner size="medium" message="Loading albums..." />;
  }

  return (
    <div className="album-manager">
      {/* Album Viewer Modal */}
      {viewingAlbum && (
        <AlbumViewer album={viewingAlbum} onClose={handleCloseViewer} />
      )}

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <AlbumForm
          album={editingAlbum}
          gameHistory={gameHistory}
          onSubmit={editingAlbum ? handleUpdateAlbum : handleCreateAlbum}
          onCancel={handleCloseForm}
        />
      )}

      {/* Header */}
      <div className="album-manager-header">
        <button
          className="create-album-button"
          onClick={handleCreateNew}
          disabled={gameHistory.length === 0 || isSubmitting}
        >
          Create Album
        </button>
      </div>

      {/* Albums Grid */}
      {albums.length === 0 ? (
        <div className="empty-state">
          <p>No albums yet. Create albums to organize your game screenshots!</p>
        </div>
      ) : (
        <div className="albums-grid">
          {albums.map((album) => (
            <div key={album.id} className="album-card">
              <div className="album-header">
                <h4 className="album-title">{album.title}</h4>
                <div className="album-actions">
                  <button
                    className="view-button"
                    onClick={() => handleViewAlbum(album)}
                    disabled={isSubmitting}
                    title="View album contents"
                  >
                    View
                  </button>
                  <button
                    className="edit-button"
                    onClick={() => handleEditAlbum(album)}
                    disabled={isSubmitting}
                    title="Edit album details"
                  >
                    Edit
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => handleDeleteAlbum(album.id)}
                    disabled={isSubmitting}
                    title="Delete album"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {album.description && (
                <p className="album-description">{album.description}</p>
              )}

              <div className="album-preview">
                {album.gameIds && album.gameIds.length > 0 ? (
                  <span className="preview-text">
                    {album.gameIds.length} game
                    {album.gameIds.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="preview-text empty">Empty album</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
