import { GameSessionData } from "../types";
import { logger } from "../utils/logger";
import { storage } from "../utils/storage";

class GameSessionService {
  private readonly SESSION_KEY = "wordle_current_game";
  private readonly SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  // FIXED: Convert user ID to string for consistent storage keys
  private getUserKey(userId: string | number): string {
    return `${this.SESSION_KEY}_${userId.toString()}`;
  }

  // Save game session for authenticated user only
  saveGameSession(sessionData: GameSessionData, userId: string | number): void {
    try {
      if (!userId) {
        logger.warn("Cannot save session without user ID");
        return;
      }

      const userKey = this.getUserKey(userId);
      const enhancedSession: GameSessionData = {
        ...sessionData,
        userId: userId.toString(), // Convert to string for consistency
        timestamp: new Date().toISOString(),
        sessionType: "authenticated",
      };

      // Store with expiry
      storage.set(userKey, enhancedSession, this.SESSION_EXPIRY_MS);

      logger.debug("Game session saved", {
        gameId: enhancedSession.gameId,
        userId: userId.toString(),
      });
    } catch (error) {
      logger.error("Failed to save game session", {
        error,
        userId: userId.toString(),
      });
    }
  }

  // Load game session for authenticated user
  loadGameSession(userId: string | number): GameSessionData | null {
    try {
      if (!userId) {
        logger.warn("Cannot load session without user ID");
        return null;
      }

      const userKey = this.getUserKey(userId);
      const session = storage.get<GameSessionData>(userKey);

      if (session && this.isSessionValid(session, userId)) {
        logger.debug("Game session loaded", {
          gameId: session.gameId,
          userId: userId.toString(),
        });
        return session;
      }

      return null;
    } catch (error) {
      logger.error("Failed to load game session", {
        error,
        userId: userId.toString(),
      });
      return null;
    }
  }

  // Clear session for user
  clearGameSession(userId: string | number): void {
    try {
      if (!userId) {
        logger.warn("Cannot clear session without user ID");
        return;
      }

      const userKey = this.getUserKey(userId);
      storage.remove(userKey);
      logger.debug("Game session cleared", { userId: userId.toString() });
    } catch (error) {
      logger.error("Failed to clear game session", {
        error,
        userId: userId.toString(),
      });
    }
  }

  // FIXED: Check if session is valid with proper type handling
  private isSessionValid(
    session: GameSessionData,
    userId: string | number
  ): boolean {
    if (!session || !session.gameId) {
      return false;
    }

    // Convert both to strings for comparison
    const sessionUserId = session.userId?.toString();
    const currentUserId = userId.toString();

    if (sessionUserId && sessionUserId !== currentUserId) {
      logger.warn("Session belongs to different user", {
        sessionUserId,
        currentUserId,
      });
      return false;
    }

    // Check if game is completed
    if (session.gameState?.gameOver) {
      logger.debug("Session game is completed, removing", {
        gameId: session.gameId,
      });
      this.clearGameSession(userId);
      return false;
    }

    return true;
  }

  // Check if user has active session
  hasActiveSession(userId: string | number): boolean {
    return this.loadGameSession(userId) !== null;
  }

  // Clear all sessions (on logout)
  clearAllSessions(): void {
    try {
      // Clear all stored sessions
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.SESSION_KEY)) {
          storage.remove(key);
        }
      });
      logger.debug("All game sessions cleared");
    } catch (error) {
      logger.error("Failed to clear all sessions", { error });
    }
  }
}

export const gameSessionService = new GameSessionService();
