import { Request, Response } from "express";
import { ProfileService } from "../services/profileService";
import { GameRecordingService } from "../services/GameRecordingService";
import { profileDataAccess } from "../data/ProfileDataAccess";
interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  gitlab_id?: number;
}

interface AuthContext {
  isAuthenticated: boolean;
  user?: AuthenticatedUser;
  token?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export class ProfileController {
  private profileService: ProfileService;
  private gameRecordingService: GameRecordingService;
  public readonly dataAccess = profileDataAccess;

  constructor() {
    this.profileService = new ProfileService();
    this.gameRecordingService = new GameRecordingService();
  }

  private getAuthenticatedUser(req: Request): AuthenticatedUser | null {
    return req.auth?.user || null;
  }

  saveGame = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({
          success: false,
          error: "User authentication required",
        });
        return;
      }

      console.log(`🎮 Saving game for user ${user.id}:`, req.body);
      const { gameId, word, guesses, won, attempts, date } = req.body;

      if (!gameId || !word || typeof won !== "boolean" || !attempts) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: gameId, word, won, attempts",
        });
        return;
      }

      const gameRecord = await this.gameRecordingService.recordGame(user.id, {
        gameId,
        targetWord: word.toUpperCase(),
        guesses: Array.isArray(guesses) ? guesses : [],
        won,
        attempts: parseInt(attempts.toString()),
        completedAt: date ? new Date(date) : new Date(),
      });

      console.log(`Game ${gameId} saved successfully for user ${user.id}`);
      res.status(201).json({
        success: true,
        data: gameRecord,
        message: "Game recorded successfully",
      });
    } catch (error: any) {
      console.error("Save game error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to save game",
        message: error.message,
      });
    }
  };

  getUserGames = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({
          success: false,
          error: "User authentication required",
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      console.log(
        `🎮 Fetching games for user ${user.id} (limit: ${limit}, offset: ${offset})`
      );

      const games = await profileDataAccess.getUserGameRecords(
        user.id,
        limit,
        offset
      );

      console.log(`Found ${games.length} games for user ${user.id}`);
      res.json({
        success: true,
        data: games,
        pagination: { limit, offset, total: games.length },
      });
    } catch (error: any) {
      console.error("Get user games error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get game history",
        message: error.message,
      });
    }
  };

  getUserStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({
          success: false,
          error: "User authentication required",
        });
        return;
      }

      console.log(`Calculating stats for user ${user.id}`);
      const stats = await profileDataAccess.getUserStats(user.id);
      console.log(`✅ Stats calculated for user ${user.id}:`, stats);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error("Get user stats error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user statistics",
        message: error.message,
      });
    }
  };

  // === ALBUM ENDPOINTS ===
  createAlbum = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const { title, description, isPublic = false } = req.body;

      if (!title?.trim()) {
        res.status(400).json({
          success: false,
          error: "Album title is required",
        });
        return;
      }

      console.log(`Creating album for user ${user.id}:`, {
        title,
        description,
        isPublic,
      });

      const album = await profileDataAccess.createAlbum({
        userId: user.id,
        title: title.trim(),
        description: description?.trim() || "",
        isPublic: Boolean(isPublic),
      });

      console.log(`Album created successfully: ${album.id}`);
      res.status(201).json({
        success: true,
        data: album,
        message: "Album created successfully",
      });
    } catch (error: any) {
      console.error("Create album error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create album",
        message: error.message,
      });
    }
  };

  getUserAlbums = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      console.log(`📁 Fetching albums for user ${user.id}`);
      const albums = await profileDataAccess.getUserAlbums(user.id);

      console.log(`Found ${albums.length} albums for user ${user.id}`);
      res.json({
        success: true,
        data: albums,
      });
    } catch (error: any) {
      console.error("Get user albums error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get albums",
      });
    }
  };

  getAlbumById = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const { albumId } = req.params;
      console.log(`📁 Fetching album ${albumId} for user ${user.id}`);

      const album = await profileDataAccess.getAlbumWithGames(albumId, user.id);

      if (!album) {
        console.log(`Album ${albumId} not found for user ${user.id}`);
        res.status(404).json({
          success: false,
          error: "Album not found",
        });
        return;
      }

      console.log(
        `Album ${albumId} found with ${album.games?.length || 0} games`
      );
      res.json({
        success: true,
        data: album,
      });
    } catch (error: any) {
      console.error("Get album error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get album",
      });
    }
  };

  updateAlbum = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const { albumId } = req.params;
      const { title, description, isPublic } = req.body;

      console.log(`Updating album ${albumId} for user ${user.id}:`, {
        title,
        description,
        isPublic,
      });

      const updatedAlbum = await profileDataAccess.updateAlbum(
        albumId,
        user.id,
        {
          title: title?.trim(),
          description: description?.trim(),
          isPublic: isPublic !== undefined ? Boolean(isPublic) : undefined,
        }
      );

      if (!updatedAlbum) {
        console.log(`Album ${albumId} not found for user ${user.id}`);
        res.status(404).json({
          success: false,
          error: "Album not found",
        });
        return;
      }

      console.log(`Album ${albumId} updated successfully`);
      res.json({
        success: true,
        data: updatedAlbum,
        message: "Album updated successfully",
      });
    } catch (error: any) {
      console.error("Update album error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update album",
        message: error.message,
      });
    }
  };

  deleteAlbum = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const { albumId } = req.params;
      console.log(`📁 Deleting album ${albumId} for user ${user.id}`);

      const deleted = await profileDataAccess.deleteAlbum(albumId, user.id);

      if (!deleted) {
        console.log(`❌ Album ${albumId} not found for user ${user.id}`);
        res.status(404).json({
          success: false,
          error: "Album not found",
        });
        return;
      }

      console.log(`✅ Album ${albumId} deleted successfully`);
      res.json({
        success: true,
        message: "Album deleted successfully",
      });
    } catch (error: any) {
      console.error("❌ Delete album error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete album",
        message: error.message,
      });
    }
  };

  addGameToAlbum = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const { albumId, gameId } = req.params;

      console.log(
        `📁 Adding game ${gameId} to album ${albumId} for user ${user.id}`
      );

      // First, let's check if the album exists and belongs to the user
      const album = await profileDataAccess.getAlbumWithGames(albumId, user.id);
      if (!album) {
        console.log(`❌ Album ${albumId} not found for user ${user.id}`);
        res.status(404).json({
          success: false,
          error: "Album not found or access denied",
        });
        return;
      }

      // Check if the game exists and belongs to the user
      const game = await profileDataAccess.getGameRecord(user.id, gameId);
      if (!game) {
        console.log(`❌ Game ${gameId} not found for user ${user.id}`);
        res.status(404).json({
          success: false,
          error: "Game not found or access denied",
        });
        return;
      }

      console.log(`✅ Both album and game exist, proceeding with addition`);

      const added = await profileDataAccess.addGameToAlbum(
        albumId,
        gameId,
        user.id
      );

      if (!added) {
        console.log(
          `❌ Failed to add game ${gameId} to album ${albumId} - already exists or other error`
        );
        res.status(400).json({
          success: false,
          error: "Failed to add game to album. Game may already be in album.",
        });
        return;
      }

      console.log(`✅ Game ${gameId} added to album ${albumId} successfully`);
      res.json({
        success: true,
        message: "Game added to album successfully",
      });
    } catch (error: any) {
      console.error("❌ Add game to album error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to add game to album",
        message: error.message,
      });
    }
  };

  removeGameFromAlbum = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const { albumId, gameId } = req.params;

      console.log(
        `📁 Removing game ${gameId} from album ${albumId} for user ${user.id}`
      );

      const removed = await profileDataAccess.removeGameFromAlbum(
        albumId,
        gameId,
        user.id
      );

      if (!removed) {
        console.log(`❌ Failed to remove game ${gameId} from album ${albumId}`);
        res.status(400).json({
          success: false,
          error: "Failed to remove game from album",
        });
        return;
      }

      console.log(
        `✅ Game ${gameId} removed from album ${albumId} successfully`
      );
      res.json({
        success: true,
        message: "Game removed from album successfully",
      });
    } catch (error: any) {
      console.error("❌ Remove game from album error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to remove game from album",
        message: error.message,
      });
    }
  };

  // === GAME VISUALIZATION ENDPOINT ===
  getGameVisualization = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const { gameId } = req.params;
      console.log(
        `🎨 Generating visualization for game ${gameId} for user ${user.id}`
      );

      const visualization = await profileDataAccess.generateGameVisualization(
        user.id,
        gameId
      );

      if (!visualization) {
        console.log(`❌ Game ${gameId} not found for user ${user.id}`);
        res.status(404).json({
          success: false,
          error: "Game not found or visualization could not be generated",
        });
        return;
      }

      console.log(`✅ Visualization generated for game ${gameId}`);
      res.json({
        success: true,
        data: { visualization },
      });
    } catch (error: any) {
      console.error("❌ Get game visualization error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate game visualization",
        message: error.message,
      });
    }
  };
}

export default ProfileController;
