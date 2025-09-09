// frontend/src/services/gameSession.ts - Enhanced session management with authentication handling
export interface GameSessionData {
  gameId: string;
  gameState: {
    board: string[][];
    evaluations: ("correct" | "present" | "absent" | null)[][];
    currentRow: number;
    gameOver: boolean;
    won: boolean;
    attempts: number;
    guesses: string[];
  };
  timestamp: string;
  userId?: string | number;
  sessionType?: "authenticated" | "anonymous" | "oauth";
}

class GameSessionService {
  private readonly SESSION_KEY = "wordle_current_game";
  private readonly ANONYMOUS_SESSIONS_KEY = "wordle_anonymous_games";
  private readonly USER_SESSIONS_KEY = "wordle_user_sessions";

  // Save current game session with user context
  saveGameSession(sessionData: GameSessionData): void {
    try {
      // Determine session type
      const enhancedSession: GameSessionData = {
        ...sessionData,
        sessionType: sessionData.userId
          ? ("authenticated" as const)
          : ("anonymous" as const),
        timestamp: new Date().toISOString(),
      };

      // Check if session actually changed to avoid unnecessary saves
      const existingSession = this.getCurrentSessionFromStorage();
      if (
        existingSession &&
        existingSession.gameId === enhancedSession.gameId &&
        existingSession.gameState.currentRow ===
          enhancedSession.gameState.currentRow &&
        existingSession.gameState.gameOver ===
          enhancedSession.gameState.gameOver
      ) {
        return; // No meaningful change, skip save
      }

      // Save to main session storage
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(enhancedSession));

      // If authenticated, also save to user-specific storage for cross-session persistence
      if (sessionData.userId) {
        this.saveUserSession(sessionData.userId, enhancedSession);
      }

      console.log(
        "Game session saved:",
        enhancedSession.gameId,
        "Type:",
        enhancedSession.sessionType
      );
    } catch (error) {
      console.error("Failed to save game session:", error);
    }
  }

  // Get current session from storage without processing
  private getCurrentSessionFromStorage(): GameSessionData | null {
    try {
      const sessionStr = localStorage.getItem(this.SESSION_KEY);
      return sessionStr ? JSON.parse(sessionStr) : null;
    } catch (error) {
      return null;
    }
  }

  // Save session for specific user (for restoration after re-login)
  private saveUserSession(
    userId: string | number,
    sessionData: GameSessionData
  ): void {
    try {
      const userSessions = this.getUserSessions();
      userSessions[userId.toString()] = sessionData;

      // Keep only the last 3 sessions per user to prevent storage bloat
      const userIds = Object.keys(userSessions);
      if (userIds.length > 10) {
        const oldestUserId = userIds[0];
        delete userSessions[oldestUserId];
      }

      localStorage.setItem(
        this.USER_SESSIONS_KEY,
        JSON.stringify(userSessions)
      );
      console.log("User session saved for user:", userId);
    } catch (error) {
      console.error("Failed to save user session:", error);
    }
  }

  // Get all user sessions
  private getUserSessions(): Record<string, GameSessionData> {
    try {
      const sessionsStr = localStorage.getItem(this.USER_SESSIONS_KEY);
      return sessionsStr ? JSON.parse(sessionsStr) : {};
    } catch (error) {
      console.error("Failed to load user sessions:", error);
      return {};
    }
  }

  // Load current game session with authentication context
  loadGameSession(userId?: string | number): GameSessionData | null {
    try {
      console.log("Loading game session for user:", userId || "anonymous");

      // First try to load from main session storage
      const sessionStr = localStorage.getItem(this.SESSION_KEY);
      if (sessionStr) {
        const session = JSON.parse(sessionStr) as GameSessionData;

        // Check if session is still valid (not older than 24 hours)
        const sessionTime = new Date(session.timestamp).getTime();
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (now - sessionTime > maxAge) {
          console.log("Session expired, clearing...");
          this.clearGameSession();

          // Try to load user-specific session as fallback
          if (userId) {
            return this.loadUserSession(userId);
          }
          return null;
        }

        // Validate session ownership for authenticated users
        if (userId && session.userId && session.userId !== userId) {
          console.log(
            "Session belongs to different user, checking user sessions..."
          );
          return this.loadUserSession(userId);
        }

        // For anonymous users, accept any session without userId
        // For authenticated users, accept sessions with matching userId or no userId (which we'll update)
        if (!userId || !session.userId || session.userId === userId) {
          console.log(
            "Game session loaded:",
            session.gameId,
            "Type:",
            session.sessionType || "legacy"
          );
          return session;
        }
      }

      // If no main session, try to load user-specific session
      if (userId) {
        console.log(
          "No main session found, checking user-specific sessions..."
        );
        return this.loadUserSession(userId);
      }

      console.log("No game session found");
      return null;
    } catch (error) {
      console.error("Failed to load game session:", error);
      this.clearGameSession();
      return null;
    }
  }

  // Load session for specific user
  private loadUserSession(userId: string | number): GameSessionData | null {
    try {
      const userSessions = this.getUserSessions();
      const userSession = userSessions[userId.toString()];

      if (userSession) {
        // Check if user session is still valid
        const sessionTime = new Date(userSession.timestamp).getTime();
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (now - sessionTime <= maxAge) {
          console.log("User session restored for user:", userId);

          // Restore to main session storage
          this.saveGameSession(userSession);
          return userSession;
        } else {
          console.log("User session expired");
          delete userSessions[userId.toString()];
          localStorage.setItem(
            this.USER_SESSIONS_KEY,
            JSON.stringify(userSessions)
          );
        }
      }

      return null;
    } catch (error) {
      console.error("Failed to load user session:", error);
      return null;
    }
  }

  // Clear current game session
  clearGameSession(): void {
    try {
      localStorage.removeItem(this.SESSION_KEY);
      console.log("Game session cleared");
    } catch (error) {
      console.error("Failed to clear game session:", error);
    }
  }

  // Clear all sessions for a specific user (called on logout)
  clearUserSessions(userId: string | number): void {
    try {
      const userSessions = this.getUserSessions();
      delete userSessions[userId.toString()];
      localStorage.setItem(
        this.USER_SESSIONS_KEY,
        JSON.stringify(userSessions)
      );
      console.log("User sessions cleared for user:", userId);
    } catch (error) {
      console.error("Failed to clear user sessions:", error);
    }
  }

  // Check if there's an active session
  hasActiveSession(userId?: string | number): boolean {
    return this.loadGameSession(userId) !== null;
  }

  // Save completed anonymous games for later sync when user logs in
  saveAnonymousGame(gameData: {
    gameId: string;
    word: string;
    guesses: string[];
    won: boolean;
    attempts: number;
    date: string;
  }): void {
    try {
      const existingGames = this.getAnonymousGames();
      existingGames.push({
        ...gameData,
        timestamp: new Date().toISOString(),
      });

      // Keep only last 10 anonymous games to avoid storage bloat
      const recentGames = existingGames.slice(-10);

      localStorage.setItem(
        this.ANONYMOUS_SESSIONS_KEY,
        JSON.stringify(recentGames)
      );
      console.log("Anonymous game saved:", gameData.gameId);
    } catch (error) {
      console.error("Failed to save anonymous game:", error);
    }
  }

  // Get anonymous games for potential sync
  getAnonymousGames(): any[] {
    try {
      const gamesStr = localStorage.getItem(this.ANONYMOUS_SESSIONS_KEY);
      return gamesStr ? JSON.parse(gamesStr) : [];
    } catch (error) {
      console.error("Failed to load anonymous games:", error);
      return [];
    }
  }

  // Clear anonymous games after sync
  clearAnonymousGames(): void {
    try {
      localStorage.removeItem(this.ANONYMOUS_SESSIONS_KEY);
      console.log("Anonymous games cleared");
    } catch (error) {
      console.error("Failed to clear anonymous games:", error);
    }
  }

  // Enhanced sync method that handles different authentication types
  async syncAnonymousGames(authService: any): Promise<void> {
    const anonymousGames = this.getAnonymousGames();

    if (anonymousGames.length === 0) return;

    console.log(`Syncing ${anonymousGames.length} anonymous games...`);

    let syncedCount = 0;
    for (const game of anonymousGames) {
      try {
        await authService.recordGame({
          gameId: game.gameId,
          word: game.word,
          guesses: game.guesses,
          won: game.won,
          attempts: game.attempts,
          date: game.date,
        });
        syncedCount++;
        console.log("Synced anonymous game:", game.gameId);
      } catch (error) {
        console.error("Failed to sync game:", game.gameId, error);
        // Continue syncing other games even if one fails
      }
    }

    if (syncedCount > 0) {
      // Clear anonymous games after successful sync
      this.clearAnonymousGames();
      console.log(
        `Anonymous game sync completed: ${syncedCount}/${anonymousGames.length} games synced`
      );
    }
  }

  // Transfer session ownership when user logs in
  transferSessionToUser(userId: string | number): void {
    try {
      const currentSession = this.loadGameSession();
      if (currentSession && !currentSession.userId) {
        // Update session with user ID
        const updatedSession = {
          ...currentSession,
          userId: userId,
          sessionType: "authenticated" as const,
          timestamp: new Date().toISOString(),
        };

        this.saveGameSession(updatedSession);
        console.log("Session ownership transferred to user:", userId);
      }
    } catch (error) {
      console.error("Failed to transfer session ownership:", error);
    }
  }

  // Handle OAuth login completion - restore appropriate session
  handleOAuthLogin(userId: string | number): GameSessionData | null {
    try {
      // First check if there's a current anonymous session to transfer
      const currentSession = this.loadGameSession();
      if (currentSession && !currentSession.userId) {
        this.transferSessionToUser(userId);
        return currentSession;
      }

      // Otherwise try to restore user's previous session
      return this.loadUserSession(userId);
    } catch (error) {
      console.error("Failed to handle OAuth login session:", error);
      return null;
    }
  }

  // Clean up old sessions (call periodically or on app start)
  cleanupOldSessions(): void {
    try {
      const userSessions = this.getUserSessions();
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      let cleanedCount = 0;

      Object.keys(userSessions).forEach((userId) => {
        const session = userSessions[userId];
        const sessionTime = new Date(session.timestamp).getTime();

        if (now - sessionTime > maxAge) {
          delete userSessions[userId];
          cleanedCount++;
        }
      });

      if (cleanedCount > 0) {
        localStorage.setItem(
          this.USER_SESSIONS_KEY,
          JSON.stringify(userSessions)
        );
        console.log(`Cleaned up ${cleanedCount} old user sessions`);
      }

      // Also clean up old anonymous games
      const anonymousGames = this.getAnonymousGames();
      const recentGames = anonymousGames.filter((game) => {
        const gameTime = new Date(game.timestamp).getTime();
        return now - gameTime <= maxAge;
      });

      if (recentGames.length !== anonymousGames.length) {
        localStorage.setItem(
          this.ANONYMOUS_SESSIONS_KEY,
          JSON.stringify(recentGames)
        );
        console.log(
          `Cleaned up ${
            anonymousGames.length - recentGames.length
          } old anonymous games`
        );
      }
    } catch (error) {
      console.error("Failed to cleanup old sessions:", error);
    }
  }
}

export const gameSessionService = new GameSessionService();
