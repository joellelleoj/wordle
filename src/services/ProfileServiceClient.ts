export class ProfileServiceClient {
  private profileServiceUrl: string;

  constructor() {
    this.profileServiceUrl =
      process.env.PROFILE_SERVICE_URL || "http://localhost:3004";
  }

  async recordCompletedGame(
    userId: string,
    gameData: {
      gameId: string;
      targetWord: string;
      guesses: string[];
      won: boolean;
      attempts: number;
      completedAt: Date;
    },
    authToken: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.profileServiceUrl}/api/games`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          gameId: gameData.gameId,
          word: gameData.targetWord,
          guesses: gameData.guesses,
          won: gameData.won,
          attempts: gameData.attempts,
          date: gameData.completedAt.toISOString(),
        }),
      });

      if (response.ok) {
        console.log(
          `Game ${gameData.gameId} recorded to profile service for user ${userId}`
        );
        return true;
      } else {
        console.warn(
          `Failed to record game to profile service: ${response.status}`
        );
        return false;
      }
    } catch (error) {
      console.error("Error recording game to profile service:", error);
      return false;
    }
  }
}
