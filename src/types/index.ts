export interface GameState {
  gameId: string;
  board: string[][];
  currentAttempt: number;
  currentPosition: number;
  gameOver: boolean;
  won: boolean;
}

export interface GuessResponse {
  valid: boolean;
  result?: ("correct" | "present" | "absent")[];
  gameOver?: boolean;
  won?: boolean;
  solution?: string;
}
