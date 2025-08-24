import { Game, GameStatus, Guess } from "../models/Game";

export interface GameRepository {
  createGame(game: Omit<Game, "id">): Promise<Game>;
  getGameById(gameId: string): Promise<Game | null>;
  updateGame(gameId: string, updates: Partial<Game>): Promise<Game>;
  getActiveGameByUserId(userId: string): Promise<Game | null>;
  getUserGames(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<Game[]>;
  addGuessToGame(gameId: string, guess: Guess): Promise<Game>;
}

export class InMemoryGameRepository implements GameRepository {
  private games: Map<string, Game> = new Map();
  private userActiveGames: Map<string, string> = new Map(); // userId -> gameId

  async createGame(gameData: Omit<Game, "id">): Promise<Game> {
    const game: Game = {
      id: this.generateId(),
      ...gameData,
    };

    this.games.set(game.id, game);

    // Set as active game for user
    this.userActiveGames.set(game.userId, game.id);

    return game;
  }

  async getGameById(gameId: string): Promise<Game | null> {
    return this.games.get(gameId) || null;
  }

  async updateGame(gameId: string, updates: Partial<Game>): Promise<Game> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game with id ${gameId} not found`);
    }

    const updatedGame = { ...game, ...updates };
    this.games.set(gameId, updatedGame);

    // If game is finished, remove from active games
    if (updates.status && updates.status !== GameStatus.PLAYING) {
      this.userActiveGames.delete(game.userId);
    }

    return updatedGame;
  }

  async getActiveGameByUserId(userId: string): Promise<Game | null> {
    const activeGameId = this.userActiveGames.get(userId);
    if (!activeGameId) {
      return null;
    }

    const game = this.games.get(activeGameId);
    if (!game || game.status !== GameStatus.PLAYING) {
      this.userActiveGames.delete(userId);
      return null;
    }

    return game;
  }

  async getUserGames(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<Game[]> {
    const userGames = Array.from(this.games.values())
      .filter((game) => game.userId === userId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(offset, offset + limit);

    return userGames;
  }

  async addGuessToGame(gameId: string, guess: Guess): Promise<Game> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game with id ${gameId} not found`);
    }

    const updatedGame: Game = {
      ...game,
      guesses: [...game.guesses, guess],
      currentAttempt: game.currentAttempt + 1,
    };

    this.games.set(gameId, updatedGame);
    return updatedGame;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  // Utility methods for testing/debugging
  getAllGames(): Game[] {
    return Array.from(this.games.values());
  }

  clearGames(): void {
    this.games.clear();
    this.userActiveGames.clear();
  }
}
