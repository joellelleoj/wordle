import {
  profileDataAccess,
  GameRecord,
  GameAlbum,
  UserStats,
} from "../data/ProfileDataAccess";

export interface UserStatistics {
  userId: string;
  totalGames: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  averageAttempts: number;
  guessDistribution: { [attempts: string]: number };
  lastPlayedAt: Date | null;
}

export interface CreateAlbumData {
  title: string;
  description: string;
  isPublic: boolean;
}

export interface AlbumWithGames extends GameAlbum {
  games: GameRecord[];
}

export class ProfileService {
  private dataAccess = profileDataAccess;

  async calculateUserStatistics(userId: string): Promise<UserStatistics> {
    const stats = await this.dataAccess.getUserStats(userId);
    return {
      userId: stats.userId,
      totalGames: stats.totalGames,
      wins: stats.wins,
      winRate: stats.winRate,
      currentStreak: stats.currentStreak,
      maxStreak: stats.maxStreak,
      averageAttempts: stats.averageAttempts,
      guessDistribution: stats.guessDistribution,
      lastPlayedAt: stats.lastPlayedAt,
    };
  }

  async createAlbum(
    userId: string,
    albumData: CreateAlbumData
  ): Promise<GameAlbum> {
    if (!albumData.title.trim()) {
      throw new Error("Album title is required");
    }

    return await this.dataAccess.createAlbum({
      userId,
      title: albumData.title.trim(),
      description: albumData.description.trim(),
      isPublic: albumData.isPublic,
    });
  }

  async getUserAlbums(userId: string): Promise<GameAlbum[]> {
    return await this.dataAccess.getUserAlbums(userId);
  }

  async getAlbumWithGames(
    userId: string,
    albumId: string
  ): Promise<AlbumWithGames | null> {
    try {
      const album = await this.dataAccess.getAlbumWithGames(albumId, userId);
      if (!album) return null;

      return {
        ...album,
        games: album.games || [],
      };
    } catch (error) {
      console.error("Error fetching album with games:", error);
      return null;
    }
  }

  async updateAlbum(
    userId: string,
    albumId: string,
    updates: Partial<CreateAlbumData>
  ): Promise<GameAlbum> {
    if (updates.title !== undefined && !updates.title.trim()) {
      throw new Error("Album title cannot be empty");
    }

    const updatedAlbum = await this.dataAccess.updateAlbum(
      albumId,
      userId,
      updates
    );
    if (!updatedAlbum) {
      throw new Error("Album not found or access denied");
    }
    return updatedAlbum;
  }

  async deleteAlbum(userId: string, albumId: string): Promise<void> {
    const deleted = await this.dataAccess.deleteAlbum(albumId, userId);
    if (!deleted) {
      throw new Error("Album not found or access denied");
    }
  }

  async addGameToAlbum(
    userId: string,
    albumId: string,
    gameId: string
  ): Promise<void> {
    const success = await this.dataAccess.addGameToAlbum(
      albumId,
      gameId,
      userId
    );
    if (!success) {
      throw new Error("Album or game not found, or access denied");
    }
  }

  async removeGameFromAlbum(
    userId: string,
    albumId: string,
    gameId: string
  ): Promise<void> {
    const success = await this.dataAccess.removeGameFromAlbum(
      albumId,
      gameId,
      userId
    );
    if (!success) {
      throw new Error("Album or game not found, or access denied");
    }
  }

  async generateGameVisualization(userId: string, gameId: string) {
    return await this.dataAccess.generateGameVisualization(userId, gameId);
  }
}
