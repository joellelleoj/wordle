import { GameResult, GameStats } from "./game";

export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
  isVerified: boolean;
}

export interface UserProfile extends User {
  stats: GameStats;
  gameHistory: GameResult[];
  posts: GamePost[];
  following: string[];
  followers: string[];
}

export interface GamePost {
  id: string;
  userId: string;
  gameResult: GameResult;
  comment?: string;
  isPublic: boolean;
  likes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  comment: string;
  createdAt: Date;
}
