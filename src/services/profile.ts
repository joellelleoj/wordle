// services/profile.ts - Fixed for browser compatibility
export interface GameRecord {
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

export interface CreatePostData {
  title: string;
  content: string;
  gameId?: string;
}

// API URL configuration for browser environment
const getApiUrl = (): string => {
  // In production (deployed), use relative paths
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost"
  ) {
    return "/api";
  }
  // In development, use specific ports
  return "http://localhost:8002/api";
};

export class ProfileService {
  private readonly API_BASE_URL: string;

  constructor() {
    this.API_BASE_URL = getApiUrl();
  }

  async getUserStats(userId: number | string): Promise<UserStats> {
    try {
      const response = await fetch(
        `${this.API_BASE_URL}/profile/stats/${userId.toString()}`
      );
      const result = await response.json();

      if (result.success) {
        return result.data;
      }

      return {
        wins: 0,
        losses: 0,
        streak: 0,
        averageGuesses: 0,
        gamesPlayed: 0,
        winRate: 0,
        currentStreak: 0,
        maxStreak: 0,
        guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      };
    } catch (error) {
      console.error("Failed to fetch user stats:", error);
      return {
        wins: 0,
        losses: 0,
        streak: 0,
        averageGuesses: 0,
        gamesPlayed: 0,
        winRate: 0,
        currentStreak: 0,
        maxStreak: 0,
        guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      };
    }
  }

  async getGameHistory(userId: number | string): Promise<GameRecord[]> {
    try {
      const response = await fetch(
        `${this.API_BASE_URL}/profile/games/${userId.toString()}`
      );
      const result = await response.json();

      if (result.success) {
        return result.data;
      }

      return [];
    } catch (error) {
      console.error("Failed to fetch game history:", error);
      return [];
    }
  }

  async createPost(postData: CreatePostData): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/profile/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        throw new Error("Failed to create post");
      }
    } catch (error) {
      console.error("Failed to create post:", error);
      throw error;
    }
  }
}

export const profileService = new ProfileService();
/*

const getApiUrl = (): string => {
  if (process.env.NODE_ENV === "production") {
    return "/api";
  }
  return "http://localhost:8082/api";
};

const API_URL = getApiUrl();

export interface UserStats {
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  averageGuesses: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: Record<string, number>;
}

export interface GameRecord {
  gameId: string;
  targetWord: string;
  attempts: number;
  won: boolean;
  guessPattern: string[][];
  completedAt: string;
}

export interface GamePost {
  id: string;
  userId: string;
  username: string;
  gameId: string;
  targetWord: string;
  attempts: number;
  won: boolean;
  guessPattern: string[][];
  comment: string;
  likes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostData {
  gameId: string;
  targetWord: string;
  attempts: number;
  won: boolean;
  guessPattern: string[][];
  comment: string;
}

class ProfileService {

  async getUserStats(userId: string): Promise<UserStats> {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_URL}/users/${userId}/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user stats");
    }

    const data = await response.json();
    return data.stats;
  }


  async getGameHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<GameRecord[]> {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(
      `${API_URL}/users/${userId}/games?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch game history");
    }

    const data = await response.json();
    return data.games;
  }


  async recordGame(
    userId: string,
    gameData: {
      gameId: string;
      targetWord: string;
      guesses: string[][];
      won: boolean;
      attempts: number;
    }
  ): Promise<void> {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_URL}/users/${userId}/games`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gameData),
    });

    if (!response.ok) {
      throw new Error("Failed to record game");
    }
  }


  async createPost(postData: CreatePostData): Promise<GamePost> {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_URL}/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      throw new Error("Failed to create post");
    }

    return response.json();
  }


  async togglePostLike(postId: string): Promise<GamePost> {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_URL}/posts/${postId}/like`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to toggle post like");
    }

    return response.json();
  }


  async getUserPosts(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<GamePost[]> {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(
      `${API_URL}/users/${userId}/posts?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch user posts");
    }

    const data = await response.json();
    return data.posts;
  }
}

export const profileService = new ProfileService();
*/
