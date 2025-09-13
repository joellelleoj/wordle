export interface GameRecord {
  gameId(arg0: string, gameId: any): unknown;
  id: string;
  word: string;
  guesses: number;
  won: boolean;
  date: string;
  userId: string;
}

export interface UserStats {
  wins: number;
  losses: number;
  streak: number;
  averageGuesses: number;
  gamesPlayed: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: { [key: number]: number };
}
