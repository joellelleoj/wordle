export interface GameRecord {
  id: string;
  userId: string;
  gameId: string;
  word: string;
  guesses: string[];
  won: boolean;
  attempts: number;
  date: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GamePost {
  id: string;
  gameRecordId: string;
  userId: string;
  title: string;
  comment: string;
  isPublic: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GameAlbum {
  id: string;
  userId: string;
  title: string;
  description: string;
  gamePostIds: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}
