import { GameRecord, GamePost, GameAlbum } from "../models/GameRecord";

export class GameRecordService {
  private records: Map<string, GameRecord> = new Map();
  private posts: Map<string, GamePost> = new Map();
  private albums: Map<string, GameAlbum> = new Map();

  // Save completed game
  async saveGame(
    userId: string,
    gameData: {
      gameId: string;
      word: string;
      guesses: string[];
      won: boolean;
      attempts: number;
      date: string;
    }
  ): Promise<GameRecord> {
    const record: GameRecord = {
      id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      gameId: gameData.gameId,
      word: gameData.word,
      guesses: gameData.guesses,
      won: gameData.won,
      attempts: gameData.attempts,
      date: gameData.date,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.records.set(record.id, record);
    return record;
  }

  // Get user's game history
  async getUserGames(userId: string): Promise<GameRecord[]> {
    return Array.from(this.records.values())
      .filter((record) => record.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Create post from game
  async createGamePost(
    userId: string,
    gameRecordId: string,
    postData: {
      title: string;
      comment: string;
      isPublic: boolean;
      tags: string[];
    }
  ): Promise<GamePost> {
    const record = this.records.get(gameRecordId);
    if (!record || record.userId !== userId) {
      throw new Error("Game record not found or unauthorized");
    }

    const post: GamePost = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      gameRecordId,
      userId,
      title: postData.title,
      comment: postData.comment,
      isPublic: postData.isPublic,
      tags: postData.tags,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.posts.set(post.id, post);
    return post;
  }

  // Get user's posts
  async getUserPosts(
    userId: string
  ): Promise<(GamePost & { gameRecord: GameRecord })[]> {
    const userPosts = Array.from(this.posts.values()).filter(
      (post) => post.userId === userId
    );

    return userPosts
      .map((post) => ({
        ...post,
        gameRecord: this.records.get(post.gameRecordId)!,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Create album
  async createAlbum(
    userId: string,
    albumData: {
      title: string;
      description: string;
      isPublic: boolean;
    }
  ): Promise<GameAlbum> {
    const album: GameAlbum = {
      id: `album_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      title: albumData.title,
      description: albumData.description,
      gamePostIds: [],
      isPublic: albumData.isPublic,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.albums.set(album.id, album);
    return album;
  }

  // Add post to album
  async addPostToAlbum(
    userId: string,
    albumId: string,
    postId: string
  ): Promise<void> {
    const album = this.albums.get(albumId);
    const post = this.posts.get(postId);

    if (!album || album.userId !== userId) {
      throw new Error("Album not found or unauthorized");
    }
    if (!post || post.userId !== userId) {
      throw new Error("Post not found or unauthorized");
    }

    if (!album.gamePostIds.includes(postId)) {
      album.gamePostIds.push(postId);
      album.updatedAt = new Date();
    }
  }

  // Get user statistics
  async getUserStats(userId: string): Promise<{
    totalGames: number;
    wins: number;
    winRate: number;
    averageAttempts: number;
    currentStreak: number;
    maxStreak: number;
    gamesPerDay: { [date: string]: number };
  }> {
    const games = await this.getUserGames(userId);
    const wins = games.filter((g) => g.won);

    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    // Calculate streaks (most recent first)
    for (let i = 0; i < games.length; i++) {
      if (games[i].won) {
        tempStreak++;
        if (i === 0) currentStreak = tempStreak;
        maxStreak = Math.max(maxStreak, tempStreak);
      } else {
        if (i === 0) currentStreak = 0;
        tempStreak = 0;
      }
    }

    // Games per day
    const gamesPerDay: { [date: string]: number } = {};
    games.forEach((game) => {
      gamesPerDay[game.date] = (gamesPerDay[game.date] || 0) + 1;
    });

    return {
      totalGames: games.length,
      wins: wins.length,
      winRate:
        games.length > 0 ? Math.round((wins.length / games.length) * 100) : 0,
      averageAttempts:
        wins.length > 0
          ? Math.round(
              (wins.reduce((sum, g) => sum + g.attempts, 0) / wins.length) * 10
            ) / 10
          : 0,
      currentStreak,
      maxStreak,
      gamesPerDay,
    };
  }

  // Update post
  async updatePost(
    userId: string,
    postId: string,
    updates: {
      title?: string;
      comment?: string;
      isPublic?: boolean;
      tags?: string[];
    }
  ): Promise<GamePost> {
    const post = this.posts.get(postId);
    if (!post || post.userId !== userId) {
      throw new Error("Post not found or unauthorized");
    }

    Object.assign(post, updates, { updatedAt: new Date() });
    return post;
  }

  // Delete post
  async deletePost(userId: string, postId: string): Promise<void> {
    const post = this.posts.get(postId);
    if (!post || post.userId !== userId) {
      throw new Error("Post not found or unauthorized");
    }

    // Remove from albums
    this.albums.forEach((album) => {
      const index = album.gamePostIds.indexOf(postId);
      if (index > -1) {
        album.gamePostIds.splice(index, 1);
        album.updatedAt = new Date();
      }
    });

    this.posts.delete(postId);
  }

  // Search public posts
  async searchPublicPosts(
    query?: string,
    tags?: string[]
  ): Promise<
    (GamePost & {
      gameRecord: GameRecord;
      userName: string;
    })[]
  > {
    let posts = Array.from(this.posts.values()).filter((post) => post.isPublic);

    if (query) {
      posts = posts.filter(
        (post) =>
          post.title.toLowerCase().includes(query.toLowerCase()) ||
          post.comment.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (tags && tags.length > 0) {
      posts = posts.filter((post) =>
        tags.some((tag) => post.tags.includes(tag))
      );
    }

    return posts
      .map((post) => ({
        ...post,
        gameRecord: this.records.get(post.gameRecordId)!,
        userName: `User_${post.userId}`, // In real implementation, fetch from user service
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
