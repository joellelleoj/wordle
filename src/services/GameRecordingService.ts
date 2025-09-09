// profile-service/src/services/GameRecordingService.ts - Fixed implementation
import { ProfileDataAccess } from "../data/ProfileDataAccess";

export interface GameRecordData {
  gameId: string;
  targetWord: string;
  guesses: string[];
  won: boolean;
  attempts: number;
  completedAt: Date;
}

export class GameRecordingService {
  private dataAccess: ProfileDataAccess;

  constructor() {
    this.dataAccess = ProfileDataAccess.getInstance();
  }

  async recordGame(userId: string, gameData: GameRecordData): Promise<any> {
    // Validate game data
    this.validateGameData(gameData);

    // Check for duplicate game records
    const existingGame = await this.dataAccess.getGameRecord(
      userId,
      gameData.gameId
    );
    if (existingGame) {
      console.log(
        `Game ${gameData.gameId} already recorded for user ${userId}`
      );
      return existingGame;
    }

    // Record the game
    const gameRecord = await this.dataAccess.saveGameRecord({
      userId,
      gameId: gameData.gameId,
      targetWord: gameData.targetWord.toUpperCase(),
      guesses: gameData.guesses.map((g) => g.toUpperCase()),
      won: gameData.won,
      attempts: gameData.attempts,
      completedAt: gameData.completedAt,
    });

    console.log(
      `Game ${gameData.gameId} recorded successfully for user ${userId}`
    );
    return gameRecord;
  }

  async getUserGameHistory(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<any[]> {
    return await this.dataAccess.getUserGameRecords(userId, limit, offset);
  }

  private validateGameData(gameData: GameRecordData): void {
    if (!gameData.gameId) {
      throw new Error("Game ID is required");
    }

    if (!gameData.targetWord || gameData.targetWord.length !== 5) {
      throw new Error("Target word must be exactly 5 characters");
    }

    if (!Array.isArray(gameData.guesses)) {
      throw new Error("Guesses must be an array");
    }

    if (gameData.attempts < 1 || gameData.attempts > 6) {
      throw new Error("Attempts must be between 1 and 6");
    }

    if (typeof gameData.won !== "boolean") {
      throw new Error("Won status must be a boolean");
    }

    // Validate guesses
    for (const guess of gameData.guesses) {
      if (typeof guess !== "string" || guess.length !== 5) {
        throw new Error("Each guess must be exactly 5 characters");
      }
    }

    // Validate consistency
    if (gameData.won && gameData.guesses.length !== gameData.attempts) {
      throw new Error("Number of guesses must match attempts count");
    }

    if (
      gameData.won &&
      !gameData.guesses.some(
        (g) => g.toUpperCase() === gameData.targetWord.toUpperCase()
      )
    ) {
      throw new Error("If won is true, one guess must match the target word");
    }
  }
}
