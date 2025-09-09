// pages/ProfilePage.tsx - Updated with navigation props
import { useState, useEffect } from "react";
import { User, authService } from "../services/auth";

interface UserStats {
  totalGames: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  averageAttempts: number;
  guessDistribution: { [attempts: string]: number };
  lastPlayedAt: Date | null;
}

interface GameRecord {
  id?: string;
  gameId: string;
  targetWord?: string;
  word?: string;
  guesses: string[];
  won: boolean;
  attempts: number;
  completedAt?: string;
  date?: string;
  createdAt?: string;
}

interface GameAlbum {
  id: string;
  userId: string;
  title: string;
  description: string;
  isPublic: boolean;
  gameIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface GameVisualization {
  board: string[][];
  colors: string[][];
  metadata: {
    word: string;
    attempts: number;
    won: boolean;
    date: string;
  };
}

interface ProfilePageProps {
  user: User | null;
  selectedAlbumId?: string;
  onNavigate?: (
    page: "game" | "login" | "register" | "profile",
    options?: { albumId?: string }
  ) => void;
}

export function ProfilePage({
  user,
  selectedAlbumId,
  onNavigate,
}: ProfilePageProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);
  const [albums, setAlbums] = useState<GameAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<"stats" | "games" | "albums">(
    "stats"
  );
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<GameAlbum | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<GameAlbum | null>(null);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);

  // Form state
  const [albumForm, setAlbumForm] = useState({
    title: "",
    description: "",
    isPublic: false,
    selectedGameIds: [] as string[],
  });

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user || !authService.isAuthenticated()) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log("Fetching profile data for user:", user.username);

        const [statsResult, historyResult, albumsResult] = await Promise.all([
          authService.getUserStats(),
          authService.getGameHistory(50, 0),
          authService.getUserAlbums(),
        ]);

        console.log("Profile data loaded:", {
          stats: !!statsResult,
          history: historyResult.length,
          albums: albumsResult.length,
        });

        setStats(statsResult);
        setGameHistory(historyResult);
        setAlbums(albumsResult);

        // Handle selected album from URL
        if (selectedAlbumId) {
          const album = albumsResult.find((a) => a.id === selectedAlbumId);
          if (album) {
            setActiveTab("albums");
            viewAlbumDetails(album);
          }
        }
      } catch (error: any) {
        console.error("Failed to fetch profile data:", error);
        setError("Failed to load profile data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user, selectedAlbumId]);

  // Helper functions
  const getGameDate = (game: GameRecord): string => {
    const dateStr = game.completedAt || game.date || game.createdAt;
    if (!dateStr) return "Unknown date";
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? "Invalid date" : date.toLocaleDateString();
    } catch {
      return "Invalid date";
    }
  };

  const getGameWord = (game: GameRecord): string => {
    return (game.targetWord || game.word || "UNKNOWN").toUpperCase();
  };

  const getGameId = (game: GameRecord): string => {
    return game.gameId;
  };

  // Generate game visualization
  const generateGameVisualization = (game: GameRecord): GameVisualization => {
    const word = getGameWord(game);
    const board: string[][] = Array(6)
      .fill(null)
      .map(() => Array(5).fill(""));
    const colors: string[][] = Array(6)
      .fill(null)
      .map(() => Array(5).fill(""));

    if (game.guesses && Array.isArray(game.guesses)) {
      game.guesses.forEach((guess, rowIndex) => {
        if (rowIndex < 6 && guess && guess.length === 5) {
          for (let i = 0; i < 5; i++) {
            board[rowIndex][i] = guess[i].toUpperCase();
            if (word[i] === guess[i].toUpperCase()) {
              colors[rowIndex][i] = "correct";
            } else if (word.includes(guess[i].toUpperCase())) {
              colors[rowIndex][i] = "present";
            } else {
              colors[rowIndex][i] = "absent";
            }
          }
        }
      });
    }

    return {
      board,
      colors,
      metadata: {
        word,
        attempts: game.attempts,
        won: game.won,
        date: getGameDate(game),
      },
    };
  };

  // Album management with proper create vs update logic
  const handleAlbumSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!albumForm.title.trim()) {
      setError("Album title is required");
      return;
    }

    try {
      setIsCreatingAlbum(true);
      setError(null);

      if (editingAlbum) {
        // UPDATE EXISTING ALBUM
        console.log("Updating album:", editingAlbum.id, {
          title: albumForm.title,
          description: albumForm.description,
          isPublic: albumForm.isPublic,
        });

        const updatedAlbum = await authService.updateAlbum(editingAlbum.id, {
          title: albumForm.title,
          description: albumForm.description,
          isPublic: albumForm.isPublic,
        });

        console.log("Album updated successfully:", updatedAlbum.id);

        // Update albums list with the updated album
        setAlbums((prev) =>
          prev.map((album) =>
            album.id === editingAlbum.id ? updatedAlbum : album
          )
        );

        // Handle game selection updates for editing
        const currentGameIds = new Set(editingAlbum.gameIds || []);
        const selectedGameIds = new Set(albumForm.selectedGameIds);

        // Add new games
        for (const gameId of selectedGameIds) {
          if (!currentGameIds.has(gameId)) {
            try {
              await authService.addGameToAlbum(editingAlbum.id, gameId);
              console.log(`Game ${gameId} added to album`);
            } catch (error: any) {
              console.error(`Failed to add game ${gameId}:`, error);
            }
          }
        }

        // Remove games that were deselected
        for (const gameId of currentGameIds) {
          if (!selectedGameIds.has(gameId)) {
            try {
              await authService.removeGameFromAlbum(editingAlbum.id, gameId);
              console.log(`Game ${gameId} removed from album`);
            } catch (error: any) {
              console.error(`Failed to remove game ${gameId}:`, error);
            }
          }
        }

        // Refresh albums list to get updated game IDs
        const updatedAlbums = await authService.getUserAlbums();
        setAlbums(updatedAlbums);

        console.log("Album editing completed successfully");
      } else {
        // CREATE NEW ALBUM
        console.log("Creating new album:", {
          title: albumForm.title,
          description: albumForm.description,
          isPublic: albumForm.isPublic,
          selectedGames: albumForm.selectedGameIds.length,
        });

        const newAlbum = await authService.createAlbum({
          title: albumForm.title,
          description: albumForm.description,
          isPublic: albumForm.isPublic,
        });

        console.log("Album created successfully:", newAlbum.id);

        // Add selected games to the new album
        const failedGames: string[] = [];
        for (const selectedGameId of albumForm.selectedGameIds) {
          try {
            const gameRecord = gameHistory.find(
              (game) =>
                getGameId(game) === selectedGameId || game.id === selectedGameId
            );

            if (!gameRecord) {
              console.error(`Game record not found for ID: ${selectedGameId}`);
              failedGames.push(selectedGameId);
              continue;
            }

            const actualGameId = getGameId(gameRecord);
            console.log(`Adding game ${actualGameId} to album ${newAlbum.id}`);

            await authService.addGameToAlbum(newAlbum.id, actualGameId);
            console.log(`Game ${actualGameId} added successfully`);
          } catch (gameError: any) {
            console.error(`Failed to add game ${selectedGameId}:`, gameError);
            failedGames.push(selectedGameId);
          }
        }

        // Update albums list
        const updatedAlbums = await authService.getUserAlbums();
        setAlbums(updatedAlbums);

        if (failedGames.length > 0) {
          setError(
            `Album created, but failed to add ${failedGames.length} game(s). You can add them manually later.`
          );
        } else {
          console.log("Album creation completed successfully");
        }
      }

      // Reset form and close modal
      setShowCreateAlbum(false);
      setEditingAlbum(null);
      resetAlbumForm();
    } catch (error: any) {
      console.error("Failed to save album:", error);
      setError(`Failed to save album: ${error.message}`);
    } finally {
      setIsCreatingAlbum(false);
    }
  };

  const resetAlbumForm = () => {
    setAlbumForm({
      title: "",
      description: "",
      isPublic: false,
      selectedGameIds: [],
    });
  };

  const handleDeleteAlbum = async (albumId: string) => {
    if (!window.confirm("Are you sure you want to delete this album?")) return;

    try {
      console.log("Deleting album:", albumId);
      await authService.deleteAlbum(albumId);
      setAlbums((prev) => prev.filter((a) => a.id !== albumId));
      console.log("Album deleted successfully");
    } catch (error: any) {
      console.error("Failed to delete album:", error);
      setError("Failed to delete album. Please try again.");
    }
  };

  const viewAlbumDetails = async (album: GameAlbum) => {
    try {
      console.log("Loading album details:", album.id);
      const albumWithGames = await authService.getAlbumWithGames(album.id);
      setSelectedAlbum(albumWithGames);

      // Update URL to include album ID
      if (onNavigate) {
        onNavigate("profile", { albumId: album.id });
      }

      console.log("Album details loaded");
    } catch (error: any) {
      console.error("Failed to load album details:", error);
      setError("Failed to load album details.");
    }
  };

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-error">
          <h2>Not Logged In</h2>
          <p>Please log in to view your profile.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading">
          <h2>Loading Profile...</h2>
          <p>Fetching your game statistics and history...</p>
        </div>
      </div>
    );
  }

  // Fix: Ensure guessDistribution has proper numeric values
  const guessDistribution = stats?.guessDistribution || {};
  const distributionEntries = Object.entries(guessDistribution).map(
    ([key, value]): [string, number] => [
      key,
      typeof value === "number"
        ? value
        : parseInt((value as any)?.toString() || "0"),
    ]
  );
  const maxDistribution = Math.max(
    ...distributionEntries.map(([, count]) => count),
    1
  );

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h2>Your Wordle Profile</h2>

        {/* Error display */}
        {error && (
          <div className="error-message">
            {error}
            <button className="close-error" onClick={() => setError(null)}>
              ×
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === "stats" ? "active" : ""}`}
            onClick={() => setActiveTab("stats")}
          >
            Statistics
          </button>
          <button
            className={`tab-button ${activeTab === "games" ? "active" : ""}`}
            onClick={() => setActiveTab("games")}
          >
            Game History ({gameHistory.length})
          </button>
          <button
            className={`tab-button ${activeTab === "albums" ? "active" : ""}`}
            onClick={() => setActiveTab("albums")}
          >
            Game Albums ({albums.length})
          </button>
        </div>

        {/* Statistics Tab */}
        {activeTab === "stats" && (
          <div className="profile-info">
            <div className="info-section">
              <h3>Account Information</h3>
              <div className="info-item">
                <label>Username:</label>
                <span>{user.username}</span>
              </div>
              <div className="info-item">
                <label>Email:</label>
                <span>{user.email}</span>
              </div>
              <div className="info-item">
                <label>Account Type:</label>
                <span>
                  {user.gitlab_id ? "GitLab Account" : "Local Account"}
                </span>
              </div>
              <div className="info-item">
                <label>Member Since:</label>
                <span>
                  {new Date(user.created_at || "").toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="info-section">
              <h3>Game Statistics</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-value">{stats?.totalGames || 0}</span>
                  <span className="stat-label">Games Played</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stats?.wins || 0}</span>
                  <span className="stat-label">Games Won</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stats?.winRate || 0}%</span>
                  <span className="stat-label">Win Rate</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">
                    {stats?.currentStreak || 0}
                  </span>
                  <span className="stat-label">Current Streak</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stats?.maxStreak || 0}</span>
                  <span className="stat-label">Max Streak</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">
                    {stats?.averageAttempts?.toFixed(1) || "0.0"}
                  </span>
                  <span className="stat-label">Avg Attempts</span>
                </div>
              </div>

              {/* Guess Distribution Chart */}
              <div className="guess-distribution">
                <h4>Guess Distribution</h4>
                {distributionEntries.map(([attempts, count]) => {
                  const numCount = count as number;
                  const percentage =
                    maxDistribution > 0
                      ? (numCount / maxDistribution) * 100
                      : 0;
                  return (
                    <div key={attempts} className="distribution-row">
                      <div className="attempts-label">{attempts}</div>
                      <div className="distribution-bar">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${Math.max(
                              percentage,
                              numCount > 0 ? 8 : 0
                            )}%`,
                            backgroundColor:
                              numCount > 0 ? "#538d4e" : "#3a3a3c",
                          }}
                        >
                          <span className="count-label">{numCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Game History Tab */}
        {activeTab === "games" && (
          <div className="info-section">
            <div className="section-header">
              <h3>Game History</h3>
              <button
                className="action-button"
                onClick={() => setShowCreateAlbum(true)}
                disabled={gameHistory.length === 0}
              >
                Create Album from Games
              </button>
            </div>

            {gameHistory.length === 0 ? (
              <p>No games played yet. Start playing to see your history!</p>
            ) : (
              <div className="game-history">
                {gameHistory.map((game, index) => {
                  const visualization = generateGameVisualization(game);
                  const gameId = getGameId(game);
                  return (
                    <div key={gameId || index} className="game-history-item">
                      <div className="game-word">{getGameWord(game)}</div>
                      <div className="game-result">
                        <span
                          className={`result-badge ${
                            game.won ? "won" : "lost"
                          }`}
                        >
                          {game.won ? "Won" : "Lost"}
                        </span>
                        <span className="attempts-count">
                          {game.attempts}/6
                        </span>
                      </div>
                      <div className="game-date">{getGameDate(game)}</div>

                      <div className="game-visualization">
                        <GameBoardVisualization visualization={visualization} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Albums Tab */}
        {activeTab === "albums" && (
          <div className="info-section">
            <div className="section-header">
              <h3>Game Picture Albums</h3>
              <div className="action-buttons">
                <button
                  className="action-button"
                  onClick={() => setShowCreateAlbum(true)}
                >
                  Create Album
                </button>
              </div>
            </div>

            {albums.length === 0 ? (
              <p>
                No albums yet. Create albums to organize your game pictures!
              </p>
            ) : (
              <div className="albums-grid">
                {albums.map((album) => (
                  <div key={album.id} className="album-card">
                    <div className="album-header">
                      <h4 className="album-title">{album.title}</h4>
                      <div className="album-actions">
                        <button
                          className="view-btn"
                          onClick={() => viewAlbumDetails(album)}
                        >
                          View
                        </button>
                        <button
                          className="edit-btn"
                          onClick={() => {
                            setEditingAlbum(album);
                            setAlbumForm({
                              title: album.title,
                              description: album.description,
                              isPublic: album.isPublic,
                              selectedGameIds: album.gameIds || [],
                            });
                            setShowCreateAlbum(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteAlbum(album.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {album.description && (
                      <div className="album-description">
                        <p>{album.description}</p>
                      </div>
                    )}

                    <div className="album-meta">
                      <span className="game-count">
                        {album.gameIds?.length || 0} games
                      </span>
                      <span
                        className={`visibility-badge ${
                          album.isPublic ? "public" : "private"
                        }`}
                      >
                        {album.isPublic ? "Public" : "Private"}
                      </span>
                    </div>

                    <div className="album-date">
                      Created {new Date(album.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Album Modal */}
        {showCreateAlbum && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>{editingAlbum ? "Edit Album" : "Create Game Album"}</h3>
                <button
                  className="close-btn"
                  onClick={() => {
                    setShowCreateAlbum(false);
                    setEditingAlbum(null);
                    resetAlbumForm();
                  }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAlbumSubmit}>
                <div className="form-group">
                  <label>Album Title:</label>
                  <input
                    type="text"
                    value={albumForm.title}
                    onChange={(e) =>
                      setAlbumForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="My Best Games"
                    required
                    disabled={isCreatingAlbum}
                  />
                </div>

                <div className="form-group">
                  <label>Description:</label>
                  <textarea
                    value={albumForm.description}
                    onChange={(e) =>
                      setAlbumForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Collection of my favorite Wordle games..."
                    rows={3}
                    disabled={isCreatingAlbum}
                  />
                </div>

                <div className="form-group">
                  <label>Select Games to Include:</label>
                  <div className="game-selection">
                    {gameHistory.length === 0 ? (
                      <p>No games available. Play some games first!</p>
                    ) : (
                      gameHistory.map((game) => {
                        const gameId = getGameId(game);
                        const isSelected =
                          albumForm.selectedGameIds.includes(gameId);
                        return (
                          <div key={gameId} className="game-selection-item">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isCreatingAlbum}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAlbumForm((prev) => ({
                                    ...prev,
                                    selectedGameIds: [
                                      ...prev.selectedGameIds,
                                      gameId,
                                    ],
                                  }));
                                } else {
                                  setAlbumForm((prev) => ({
                                    ...prev,
                                    selectedGameIds:
                                      prev.selectedGameIds.filter(
                                        (id) => id !== gameId
                                      ),
                                  }));
                                }
                              }}
                            />
                            <span>
                              {getGameWord(game)} - {game.won ? "Won" : "Lost"}{" "}
                              in {game.attempts} attempts ({getGameDate(game)})
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={albumForm.isPublic}
                      disabled={isCreatingAlbum}
                      onChange={(e) =>
                        setAlbumForm((prev) => ({
                          ...prev,
                          isPublic: e.target.checked,
                        }))
                      }
                    />
                    Make album public
                  </label>
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={isCreatingAlbum}
                  >
                    {isCreatingAlbum
                      ? editingAlbum
                        ? "Updating..."
                        : "Creating..."
                      : editingAlbum
                      ? "Update Album"
                      : "Create Album"}
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    disabled={isCreatingAlbum}
                    onClick={() => {
                      setShowCreateAlbum(false);
                      setEditingAlbum(null);
                      resetAlbumForm();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Album Detail Modal */}
        {selectedAlbum && (
          <AlbumViewerModal
            album={selectedAlbum}
            onClose={() => {
              setSelectedAlbum(null);
              // Clear album from URL
              if (onNavigate) {
                onNavigate("profile");
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

// Game Board Visualization Component
function GameBoardVisualization({
  visualization,
}: {
  visualization: GameVisualization;
}) {
  return (
    <div className="game-board-visualization">
      <div className="game-board">
        {visualization.board.map((row, rowIndex) => (
          <div key={rowIndex} className="game-row">
            {row.map((letter, colIndex) => (
              <div
                key={colIndex}
                className={`game-tile ${
                  visualization.colors[rowIndex][colIndex] || ""
                }`}
              >
                {letter}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="game-metadata">
        <span className="game-word">Word: {visualization.metadata.word}</span>
        <span className="game-attempts">
          Attempts: {visualization.metadata.attempts}/6
        </span>
        <span
          className={`game-result ${
            visualization.metadata.won ? "won" : "lost"
          }`}
        >
          {visualization.metadata.won ? "Won" : "Lost"}
        </span>
      </div>
    </div>
  );
}

// Album Viewer Modal Component
function AlbumViewerModal({
  album,
  onClose,
}: {
  album: GameAlbum & { games?: GameRecord[] };
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const games = album.games || [];

  const nextGame = () => {
    setCurrentIndex((prev) => (prev + 1) % games.length);
  };

  const prevGame = () => {
    setCurrentIndex((prev) => (prev - 1 + games.length) % games.length);
  };

  if (games.length === 0) {
    return (
      <div className="modal-overlay">
        <div className="modal album-modal">
          <div className="modal-header">
            <h3>{album.title}</h3>
            <button className="close-btn" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="album-content">
            <p>No games in this album yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const currentGame = games[currentIndex];
  const visualization = generateGameVisualization(currentGame);

  return (
    <div className="modal-overlay">
      <div className="modal album-modal">
        <div className="modal-header">
          <h3>{album.title}</h3>
          <span className="album-counter">
            {currentIndex + 1} of {games.length}
          </span>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="album-viewer">
          <div className="album-controls">
            <button
              className="nav-btn prev-btn"
              onClick={prevGame}
              disabled={games.length <= 1}
            >
              ‹ Previous
            </button>
            <button
              className="nav-btn next-btn"
              onClick={nextGame}
              disabled={games.length <= 1}
            >
              Next ›
            </button>
          </div>

          <div className="album-game-display">
            <GameBoardVisualization visualization={visualization} />
          </div>

          <div className="album-thumbnails">
            {games.map((game, index) => (
              <div
                key={game.id || game.gameId}
                className={`thumbnail ${
                  index === currentIndex ? "active" : ""
                }`}
                onClick={() => setCurrentIndex(index)}
              >
                <div className="thumbnail-word">
                  {(game.targetWord || game.word || "?").toUpperCase()}
                </div>
                <div className="thumbnail-result">{game.won ? "✓" : "✗"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to generate game visualization
function generateGameVisualization(game: GameRecord): GameVisualization {
  const word = (game.targetWord || game.word || "UNKNOWN").toUpperCase();
  const board: string[][] = Array(6)
    .fill(null)
    .map(() => Array(5).fill(""));
  const colors: string[][] = Array(6)
    .fill(null)
    .map(() => Array(5).fill(""));

  if (game.guesses && Array.isArray(game.guesses)) {
    game.guesses.forEach((guess, rowIndex) => {
      if (rowIndex < 6 && guess && guess.length === 5) {
        for (let i = 0; i < 5; i++) {
          board[rowIndex][i] = guess[i].toUpperCase();
          if (word[i] === guess[i].toUpperCase()) {
            colors[rowIndex][i] = "correct";
          } else if (word.includes(guess[i].toUpperCase())) {
            colors[rowIndex][i] = "present";
          } else {
            colors[rowIndex][i] = "absent";
          }
        }
      }
    });
  }

  return {
    board,
    colors,
    metadata: {
      word,
      attempts: game.attempts,
      won: game.won,
      date: game.completedAt || game.date || "Unknown",
    },
  };
}

/*// pages/ProfilePage.tsx - Fixed album editing to update instead of create
import { useState, useEffect } from "react";
import { User, authService } from "../services/auth";

interface UserStats {
  totalGames: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  averageAttempts: number;
  guessDistribution: { [attempts: string]: number };
  lastPlayedAt: Date | null;
}

interface GameRecord {
  id?: string;
  gameId: string;
  targetWord?: string;
  word?: string;
  guesses: string[];
  won: boolean;
  attempts: number;
  completedAt?: string;
  date?: string;
  createdAt?: string;
}

interface GameAlbum {
  id: string;
  userId: string;
  title: string;
  description: string;
  isPublic: boolean;
  gameIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface GameVisualization {
  board: string[][];
  colors: string[][];
  metadata: {
    word: string;
    attempts: number;
    won: boolean;
    date: string;
  };
}

interface ProfilePageProps {
  user: User | null;
}

export function ProfilePage({ user }: ProfilePageProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);
  const [albums, setAlbums] = useState<GameAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<"stats" | "games" | "albums">(
    "stats"
  );
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<GameAlbum | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<GameAlbum | null>(null);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);

  // Form state
  const [albumForm, setAlbumForm] = useState({
    title: "",
    description: "",
    isPublic: false,
    selectedGameIds: [] as string[],
  });

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user || !authService.isAuthenticated()) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log("Fetching profile data for user:", user.username);

        const [statsResult, historyResult, albumsResult] = await Promise.all([
          authService.getUserStats(),
          authService.getGameHistory(50, 0),
          authService.getUserAlbums(),
        ]);

        console.log("Profile data loaded:", {
          stats: !!statsResult,
          history: historyResult.length,
          albums: albumsResult.length,
        });

        setStats(statsResult);
        setGameHistory(historyResult);
        setAlbums(albumsResult);
      } catch (error: any) {
        console.error("Failed to fetch profile data:", error);
        setError("Failed to load profile data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user]);

  // Helper functions
  const getGameDate = (game: GameRecord): string => {
    const dateStr = game.completedAt || game.date || game.createdAt;
    if (!dateStr) return "Unknown date";
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? "Invalid date" : date.toLocaleDateString();
    } catch {
      return "Invalid date";
    }
  };

  const getGameWord = (game: GameRecord): string => {
    return (game.targetWord || game.word || "UNKNOWN").toUpperCase();
  };

  const getGameId = (game: GameRecord): string => {
    return game.gameId;
  };

  // Generate game visualization
  const generateGameVisualization = (game: GameRecord): GameVisualization => {
    const word = getGameWord(game);
    const board: string[][] = Array(6)
      .fill(null)
      .map(() => Array(5).fill(""));
    const colors: string[][] = Array(6)
      .fill(null)
      .map(() => Array(5).fill(""));

    if (game.guesses && Array.isArray(game.guesses)) {
      game.guesses.forEach((guess, rowIndex) => {
        if (rowIndex < 6 && guess && guess.length === 5) {
          for (let i = 0; i < 5; i++) {
            board[rowIndex][i] = guess[i].toUpperCase();
            if (word[i] === guess[i].toUpperCase()) {
              colors[rowIndex][i] = "correct";
            } else if (word.includes(guess[i].toUpperCase())) {
              colors[rowIndex][i] = "present";
            } else {
              colors[rowIndex][i] = "absent";
            }
          }
        }
      });
    }

    return {
      board,
      colors,
      metadata: {
        word,
        attempts: game.attempts,
        won: game.won,
        date: getGameDate(game),
      },
    };
  };

  // FIXED: Album management with proper create vs update logic
  const handleAlbumSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!albumForm.title.trim()) {
      setError("Album title is required");
      return;
    }

    try {
      setIsCreatingAlbum(true);
      setError(null);

      if (editingAlbum) {
        // UPDATE EXISTING ALBUM
        console.log("Updating album:", editingAlbum.id, {
          title: albumForm.title,
          description: albumForm.description,
          isPublic: albumForm.isPublic,
        });

        const updatedAlbum = await authService.updateAlbum(editingAlbum.id, {
          title: albumForm.title,
          description: albumForm.description,
          isPublic: albumForm.isPublic,
        });

        console.log("Album updated successfully:", updatedAlbum.id);

        // Update albums list with the updated album
        setAlbums((prev) =>
          prev.map((album) =>
            album.id === editingAlbum.id ? updatedAlbum : album
          )
        );

        // Handle game selection updates for editing
        const currentGameIds = new Set(editingAlbum.gameIds || []);
        const selectedGameIds = new Set(albumForm.selectedGameIds);

        // Add new games
        for (const gameId of selectedGameIds) {
          if (!currentGameIds.has(gameId)) {
            try {
              await authService.addGameToAlbum(editingAlbum.id, gameId);
              console.log(`Game ${gameId} added to album`);
            } catch (error: any) {
              console.error(`Failed to add game ${gameId}:`, error);
            }
          }
        }

        // Remove games that were deselected
        for (const gameId of currentGameIds) {
          if (!selectedGameIds.has(gameId)) {
            try {
              await authService.removeGameFromAlbum(editingAlbum.id, gameId);
              console.log(`Game ${gameId} removed from album`);
            } catch (error: any) {
              console.error(`Failed to remove game ${gameId}:`, error);
            }
          }
        }

        // Refresh albums list to get updated game IDs
        const updatedAlbums = await authService.getUserAlbums();
        setAlbums(updatedAlbums);

        console.log("Album editing completed successfully");
      } else {
        // CREATE NEW ALBUM
        console.log("Creating new album:", {
          title: albumForm.title,
          description: albumForm.description,
          isPublic: albumForm.isPublic,
          selectedGames: albumForm.selectedGameIds.length,
        });

        const newAlbum = await authService.createAlbum({
          title: albumForm.title,
          description: albumForm.description,
          isPublic: albumForm.isPublic,
        });

        console.log("Album created successfully:", newAlbum.id);

        // Add selected games to the new album
        const failedGames: string[] = [];
        for (const selectedGameId of albumForm.selectedGameIds) {
          try {
            const gameRecord = gameHistory.find(
              (game) =>
                getGameId(game) === selectedGameId || game.id === selectedGameId
            );

            if (!gameRecord) {
              console.error(`Game record not found for ID: ${selectedGameId}`);
              failedGames.push(selectedGameId);
              continue;
            }

            const actualGameId = getGameId(gameRecord);
            console.log(`Adding game ${actualGameId} to album ${newAlbum.id}`);

            await authService.addGameToAlbum(newAlbum.id, actualGameId);
            console.log(`Game ${actualGameId} added successfully`);
          } catch (gameError: any) {
            console.error(`Failed to add game ${selectedGameId}:`, gameError);
            failedGames.push(selectedGameId);
          }
        }

        // Update albums list
        const updatedAlbums = await authService.getUserAlbums();
        setAlbums(updatedAlbums);

        if (failedGames.length > 0) {
          setError(
            `Album created, but failed to add ${failedGames.length} game(s). You can add them manually later.`
          );
        } else {
          console.log("Album creation completed successfully");
        }
      }

      // Reset form and close modal
      setShowCreateAlbum(false);
      setEditingAlbum(null);
      resetAlbumForm();
    } catch (error: any) {
      console.error("Failed to save album:", error);
      setError(`Failed to save album: ${error.message}`);
    } finally {
      setIsCreatingAlbum(false);
    }
  };

  const resetAlbumForm = () => {
    setAlbumForm({
      title: "",
      description: "",
      isPublic: false,
      selectedGameIds: [],
    });
  };

  const handleDeleteAlbum = async (albumId: string) => {
    if (!window.confirm("Are you sure you want to delete this album?")) return;

    try {
      console.log("Deleting album:", albumId);
      await authService.deleteAlbum(albumId);
      setAlbums((prev) => prev.filter((a) => a.id !== albumId));
      console.log("Album deleted successfully");
    } catch (error: any) {
      console.error("Failed to delete album:", error);
      setError("Failed to delete album. Please try again.");
    }
  };

  const viewAlbumDetails = async (album: GameAlbum) => {
    try {
      console.log("Loading album details:", album.id);
      const albumWithGames = await authService.getAlbumWithGames(album.id);
      setSelectedAlbum(albumWithGames);
      console.log("Album details loaded");
    } catch (error: any) {
      console.error("Failed to load album details:", error);
      setError("Failed to load album details.");
    }
  };

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-error">
          <h2>Not Logged In</h2>
          <p>Please log in to view your profile.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading">
          <h2>Loading Profile...</h2>
          <p>Fetching your game statistics and history...</p>
        </div>
      </div>
    );
  }

  // Fix: Ensure guessDistribution has proper numeric values
  const guessDistribution = stats?.guessDistribution || {};
  const distributionEntries = Object.entries(guessDistribution).map(
    ([key, value]): [string, number] => [
      key,
      typeof value === "number"
        ? value
        : parseInt((value as any)?.toString() || "0"),
    ]
  );
  const maxDistribution = Math.max(
    ...distributionEntries.map(([, count]) => count),
    1
  );

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h2>Your Wordle Profile</h2>

        {error && (
          <div className="error-message">
            {error}
            <button className="close-error" onClick={() => setError(null)}>
              ×
            </button>
          </div>
        )}

        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === "stats" ? "active" : ""}`}
            onClick={() => setActiveTab("stats")}
          >
            Statistics
          </button>
          <button
            className={`tab-button ${activeTab === "games" ? "active" : ""}`}
            onClick={() => setActiveTab("games")}
          >
            Game History ({gameHistory.length})
          </button>
          <button
            className={`tab-button ${activeTab === "albums" ? "active" : ""}`}
            onClick={() => setActiveTab("albums")}
          >
            Game Albums ({albums.length})
          </button>
        </div>

        {activeTab === "stats" && (
          <div className="profile-info">
            <div className="info-section">
              <h3>Account Information</h3>
              <div className="info-item">
                <label>Username:</label>
                <span>{user.username}</span>
              </div>
              <div className="info-item">
                <label>Email:</label>
                <span>{user.email}</span>
              </div>
              <div className="info-item">
                <label>Account Type:</label>
                <span>
                  {user.gitlab_id ? "GitLab Account" : "Local Account"}
                </span>
              </div>
              <div className="info-item">
                <label>Member Since:</label>
                <span>
                  {new Date(user.created_at || "").toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="info-section">
              <h3>Game Statistics</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-value">{stats?.totalGames || 0}</span>
                  <span className="stat-label">Games Played</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stats?.wins || 0}</span>
                  <span className="stat-label">Games Won</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stats?.winRate || 0}%</span>
                  <span className="stat-label">Win Rate</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">
                    {stats?.currentStreak || 0}
                  </span>
                  <span className="stat-label">Current Streak</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stats?.maxStreak || 0}</span>
                  <span className="stat-label">Max Streak</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">
                    {stats?.averageAttempts?.toFixed(1) || "0.0"}
                  </span>
                  <span className="stat-label">Avg Attempts</span>
                </div>
              </div>

              <div className="guess-distribution">
                <h4>Guess Distribution</h4>
                {distributionEntries.map(([attempts, count]) => {
                  const numCount = count as number;
                  const percentage =
                    maxDistribution > 0
                      ? (numCount / maxDistribution) * 100
                      : 0;
                  return (
                    <div key={attempts} className="distribution-row">
                      <div className="attempts-label">{attempts}</div>
                      <div className="distribution-bar">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${Math.max(
                              percentage,
                              numCount > 0 ? 8 : 0
                            )}%`,
                            backgroundColor:
                              numCount > 0 ? "#538d4e" : "#3a3a3c",
                          }}
                        >
                          <span className="count-label">{numCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "games" && (
          <div className="info-section">
            <div className="section-header">
              <h3>Game History</h3>
              <button
                className="action-button"
                onClick={() => setShowCreateAlbum(true)}
                disabled={gameHistory.length === 0}
              >
                Create Album from Games
              </button>
            </div>

            {gameHistory.length === 0 ? (
              <p>No games played yet. Start playing to see your history!</p>
            ) : (
              <div className="game-history">
                {gameHistory.map((game, index) => {
                  const visualization = generateGameVisualization(game);
                  const gameId = getGameId(game);
                  return (
                    <div key={gameId || index} className="game-history-item">
                      <div className="game-word">{getGameWord(game)}</div>
                      <div className="game-result">
                        <span
                          className={`result-badge ${
                            game.won ? "won" : "lost"
                          }`}
                        >
                          {game.won ? "Won" : "Lost"}
                        </span>
                        <span className="attempts-count">
                          {game.attempts}/6
                        </span>
                      </div>
                      <div className="game-date">{getGameDate(game)}</div>

                      <div className="game-visualization">
                        <GameBoardVisualization visualization={visualization} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "albums" && (
          <div className="info-section">
            <div className="section-header">
              <h3>Game Picture Albums</h3>
              <div className="action-buttons">
                <button
                  className="action-button"
                  onClick={() => setShowCreateAlbum(true)}
                >
                  Create Album
                </button>
              </div>
            </div>

            {albums.length === 0 ? (
              <p>
                No albums yet. Create albums to organize your game pictures!
              </p>
            ) : (
              <div className="albums-grid">
                {albums.map((album) => (
                  <div key={album.id} className="album-card">
                    <div className="album-header">
                      <h4 className="album-title">{album.title}</h4>
                      <div className="album-actions">
                        <button
                          className="view-btn"
                          onClick={() => viewAlbumDetails(album)}
                        >
                          View
                        </button>
                        <button
                          className="edit-btn"
                          onClick={() => {
                            setEditingAlbum(album);
                            setAlbumForm({
                              title: album.title,
                              description: album.description,
                              isPublic: album.isPublic,
                              selectedGameIds: album.gameIds || [],
                            });
                            setShowCreateAlbum(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteAlbum(album.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {album.description && (
                      <div className="album-description">
                        <p>{album.description}</p>
                      </div>
                    )}

                    <div className="album-meta">
                      <span className="game-count">
                        {album.gameIds?.length || 0} games
                      </span>
                      <span
                        className={`visibility-badge ${
                          album.isPublic ? "public" : "private"
                        }`}
                      >
                        {album.isPublic ? "Public" : "Private"}
                      </span>
                    </div>

                    <div className="album-date">
                      Created {new Date(album.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showCreateAlbum && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>{editingAlbum ? "Edit Album" : "Create Game Album"}</h3>
                <button
                  className="close-btn"
                  onClick={() => {
                    setShowCreateAlbum(false);
                    setEditingAlbum(null);
                    resetAlbumForm();
                  }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAlbumSubmit}>
                <div className="form-group">
                  <label>Album Title:</label>
                  <input
                    type="text"
                    value={albumForm.title}
                    onChange={(e) =>
                      setAlbumForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="My Best Games"
                    required
                    disabled={isCreatingAlbum}
                  />
                </div>

                <div className="form-group">
                  <label>Description:</label>
                  <textarea
                    value={albumForm.description}
                    onChange={(e) =>
                      setAlbumForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Collection of my favorite Wordle games..."
                    rows={3}
                    disabled={isCreatingAlbum}
                  />
                </div>

                <div className="form-group">
                  <label>Select Games to Include:</label>
                  <div className="game-selection">
                    {gameHistory.length === 0 ? (
                      <p>No games available. Play some games first!</p>
                    ) : (
                      gameHistory.map((game) => {
                        const gameId = getGameId(game);
                        const isSelected =
                          albumForm.selectedGameIds.includes(gameId);
                        return (
                          <div key={gameId} className="game-selection-item">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isCreatingAlbum}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAlbumForm((prev) => ({
                                    ...prev,
                                    selectedGameIds: [
                                      ...prev.selectedGameIds,
                                      gameId,
                                    ],
                                  }));
                                } else {
                                  setAlbumForm((prev) => ({
                                    ...prev,
                                    selectedGameIds:
                                      prev.selectedGameIds.filter(
                                        (id) => id !== gameId
                                      ),
                                  }));
                                }
                              }}
                            />
                            <span>
                              {getGameWord(game)} - {game.won ? "Won" : "Lost"}{" "}
                              in {game.attempts} attempts ({getGameDate(game)})
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={albumForm.isPublic}
                      disabled={isCreatingAlbum}
                      onChange={(e) =>
                        setAlbumForm((prev) => ({
                          ...prev,
                          isPublic: e.target.checked,
                        }))
                      }
                    />
                    Make album public
                  </label>
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={isCreatingAlbum}
                  >
                    {isCreatingAlbum
                      ? editingAlbum
                        ? "Updating..."
                        : "Creating..."
                      : editingAlbum
                      ? "Update Album"
                      : "Create Album"}
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    disabled={isCreatingAlbum}
                    onClick={() => {
                      setShowCreateAlbum(false);
                      setEditingAlbum(null);
                      resetAlbumForm();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {selectedAlbum && (
          <AlbumViewerModal
            album={selectedAlbum}
            onClose={() => setSelectedAlbum(null)}
          />
        )}
      </div>
    </div>
  );
}

// Game Board Visualization Component
function GameBoardVisualization({
  visualization,
}: {
  visualization: GameVisualization;
}) {
  return (
    <div className="game-board-visualization">
      <div className="game-board">
        {visualization.board.map((row, rowIndex) => (
          <div key={rowIndex} className="game-row">
            {row.map((letter, colIndex) => (
              <div
                key={colIndex}
                className={`game-tile ${
                  visualization.colors[rowIndex][colIndex] || ""
                }`}
              >
                {letter}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="game-metadata">
        <span className="game-word">Word: {visualization.metadata.word}</span>
        <span className="game-attempts">
          Attempts: {visualization.metadata.attempts}/6
        </span>
        <span
          className={`game-result ${
            visualization.metadata.won ? "won" : "lost"
          }`}
        >
          {visualization.metadata.won ? "Won" : "Lost"}
        </span>
      </div>
    </div>
  );
}

// Album Viewer Modal Component
function AlbumViewerModal({
  album,
  onClose,
}: {
  album: GameAlbum & { games?: GameRecord[] };
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const games = album.games || [];

  const nextGame = () => {
    setCurrentIndex((prev) => (prev + 1) % games.length);
  };

  const prevGame = () => {
    setCurrentIndex((prev) => (prev - 1 + games.length) % games.length);
  };

  if (games.length === 0) {
    return (
      <div className="modal-overlay">
        <div className="modal album-modal">
          <div className="modal-header">
            <h3>{album.title}</h3>
            <button className="close-btn" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="album-content">
            <p>No games in this album yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const currentGame = games[currentIndex];
  const visualization = generateGameVisualization(currentGame);

  return (
    <div className="modal-overlay">
      <div className="modal album-modal">
        <div className="modal-header">
          <h3>{album.title}</h3>
          <span className="album-counter">
            {currentIndex + 1} of {games.length}
          </span>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="album-viewer">
          <div className="album-controls">
            <button
              className="nav-btn prev-btn"
              onClick={prevGame}
              disabled={games.length <= 1}
            >
              ‹ Previous
            </button>
            <button
              className="nav-btn next-btn"
              onClick={nextGame}
              disabled={games.length <= 1}
            >
              Next ›
            </button>
          </div>

          <div className="album-game-display">
            <GameBoardVisualization visualization={visualization} />
          </div>

          <div className="album-thumbnails">
            {games.map((game, index) => (
              <div
                key={game.id || game.gameId}
                className={`thumbnail ${
                  index === currentIndex ? "active" : ""
                }`}
                onClick={() => setCurrentIndex(index)}
              >
                <div className="thumbnail-word">
                  {(game.targetWord || game.word || "?").toUpperCase()}
                </div>
                <div className="thumbnail-result">{game.won ? "✓" : "✗"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to generate game visualization
function generateGameVisualization(game: GameRecord): GameVisualization {
  const word = (game.targetWord || game.word || "UNKNOWN").toUpperCase();
  const board: string[][] = Array(6)
    .fill(null)
    .map(() => Array(5).fill(""));
  const colors: string[][] = Array(6)
    .fill(null)
    .map(() => Array(5).fill(""));

  if (game.guesses && Array.isArray(game.guesses)) {
    game.guesses.forEach((guess, rowIndex) => {
      if (rowIndex < 6 && guess && guess.length === 5) {
        for (let i = 0; i < 5; i++) {
          board[rowIndex][i] = guess[i].toUpperCase();
          if (word[i] === guess[i].toUpperCase()) {
            colors[rowIndex][i] = "correct";
          } else if (word.includes(guess[i].toUpperCase())) {
            colors[rowIndex][i] = "present";
          } else {
            colors[rowIndex][i] = "absent";
          }
        }
      }
    });
  }

  return {
    board,
    colors,
    metadata: {
      word,
      attempts: game.attempts,
      won: game.won,
      date: game.completedAt || game.date || "Unknown",
    },
  };
}

*/
