// profile-service/src/data/ProfileDataAccess.ts - Fixed gameId lookup and debugging
import { Pool, PoolClient } from "pg";

export interface GameRecord {
  id: string;
  userId: string;
  gameId: string;
  targetWord: string;
  guesses: string[];
  won: boolean;
  attempts: number;
  completedAt: Date;
  createdAt: Date;
}

export interface GameAlbum {
  id: string;
  userId: string;
  title: string;
  description: string;
  isPublic: boolean;
  gameIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStats {
  userId: string;
  totalGames: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  averageAttempts: number;
  guessDistribution: { [attempts: string]: number };
  lastPlayedAt: Date | null;
}

export interface GameVisualization {
  board: string[][];
  colors: string[][];
  metadata: {
    word: string;
    attempts: number;
    won: boolean;
    date: string;
  };
}

export class ProfileDataAccess {
  private pool: Pool;
  private static instance: ProfileDataAccess;

  private constructor() {
    const isDocker = process.env.DOCKER_ENV === "true";
    const defaultConnectionString = isDocker
      ? "postgresql://wordle_user:secure_password@postgres:5432/wordle_users"
      : "postgresql://wordle_user:secure_password@localhost:5433/wordle_users";

    const connectionString =
      process.env.DATABASE_URL || defaultConnectionString;

    console.log(
      `🔗 Connecting to database: ${connectionString.replace(
        /:[^:@]*@/,
        ":****@"
      )}`
    );

    this.pool = new Pool({
      connectionString,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on("connect", (client) => {
      client
        .query("SET search_path TO profile_schema, user_schema, public")
        .catch((err) => console.error("Failed to set search path:", err));
    });

    this.pool.on("error", (err) => {
      console.error("Profile service database error:", err);
    });

    console.log("Profile service database connection initialized");
  }

  public static getInstance(): ProfileDataAccess {
    if (!ProfileDataAccess.instance) {
      ProfileDataAccess.instance = new ProfileDataAccess();
    }
    return ProfileDataAccess.instance;
  }

  // === GAME RECORDS OPERATIONS ===
  async saveGameRecord(
    gameRecord: Omit<GameRecord, "id" | "createdAt">
  ): Promise<GameRecord> {
    const client = await this.pool.connect();
    try {
      console.log(`💾 Saving game record:`, {
        userId: gameRecord.userId,
        gameId: gameRecord.gameId,
        word: gameRecord.targetWord,
        won: gameRecord.won,
        attempts: gameRecord.attempts,
      });

      const result = await client.query(
        `
        INSERT INTO profile_schema.game_records (user_id, game_id, target_word, guesses, won, attempts, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, game_id)
        DO UPDATE SET
          target_word = EXCLUDED.target_word,
          guesses = EXCLUDED.guesses,
          won = EXCLUDED.won,
          attempts = EXCLUDED.attempts,
          completed_at = EXCLUDED.completed_at
        RETURNING *
        `,
        [
          gameRecord.userId,
          gameRecord.gameId,
          gameRecord.targetWord,
          gameRecord.guesses,
          gameRecord.won,
          gameRecord.attempts,
          gameRecord.completedAt,
        ]
      );

      const savedRecord = this.mapGameRecord(result.rows[0]);
      console.log(`✅ Game record saved with ID: ${savedRecord.id}`);
      return savedRecord;
    } finally {
      client.release();
    }
  }

  async getUserGameRecords(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<GameRecord[]> {
    console.log(
      `🎮 Fetching game records for user ${userId} (limit: ${limit}, offset: ${offset})`
    );

    const result = await this.pool.query(
      `
      SELECT * FROM profile_schema.game_records
      WHERE user_id = $1
      ORDER BY completed_at DESC
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset]
    );

    const games = result.rows.map(this.mapGameRecord);
    console.log(`📋 Found ${games.length} game records for user ${userId}`);

    // Log some game IDs for debugging
    if (games.length > 0) {
      console.log(
        `🔍 Sample game IDs:`,
        games.slice(0, 3).map((g) => ({ id: g.id, gameId: g.gameId }))
      );
    }

    return games;
  }

  async getGameRecord(
    userId: string,
    gameId: string
  ): Promise<GameRecord | null> {
    console.log(
      `🔍 Looking for game record: userId=${userId}, gameId=${gameId}`
    );

    // Try multiple approaches to find the game
    const client = await this.pool.connect();
    try {
      // First try: exact match on game_id
      let result = await client.query(
        `SELECT * FROM profile_schema.game_records WHERE user_id = $1 AND game_id = $2`,
        [userId, gameId]
      );

      if (result.rows.length > 0) {
        console.log(`✅ Found game by game_id: ${gameId}`);
        return this.mapGameRecord(result.rows[0]);
      }

      // Second try: match on UUID id field (in case frontend is passing the UUID instead of game_id)
      result = await client.query(
        `SELECT * FROM profile_schema.game_records WHERE user_id = $1 AND id::text = $2`,
        [userId, gameId]
      );

      if (result.rows.length > 0) {
        console.log(`✅ Found game by UUID id: ${gameId}`);
        return this.mapGameRecord(result.rows[0]);
      }

      // Third try: partial match on game_id (in case there's a prefix/suffix issue)
      result = await client.query(
        `SELECT * FROM profile_schema.game_records WHERE user_id = $1 AND (game_id LIKE $2 OR game_id LIKE $3)`,
        [userId, `%${gameId}%`, `${gameId}%`]
      );

      if (result.rows.length > 0) {
        console.log(`✅ Found game by partial match: ${gameId}`);
        return this.mapGameRecord(result.rows[0]);
      }

      // Debug: show all games for this user
      const allGamesResult = await client.query(
        `SELECT game_id, id, target_word, won FROM profile_schema.game_records WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 5`,
        [userId]
      );

      console.log(
        `❌ Game not found. Available games for user ${userId}:`,
        allGamesResult.rows.map((row) => ({
          id: row.id,
          gameId: row.game_id,
          word: row.target_word,
          won: row.won,
        }))
      );

      return null;
    } finally {
      client.release();
    }
  }

  // === ALBUM OPERATIONS ===
  async addGameToAlbum(
    albumId: string,
    gameId: string,
    userId: string
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      console.log(
        `📁 Adding game to album: albumId=${albumId}, gameId=${gameId}, userId=${userId}`
      );

      // First, verify the album exists and belongs to the user
      const albumCheck = await client.query(
        `SELECT id FROM profile_schema.game_albums WHERE id = $1 AND user_id = $2`,
        [albumId, userId]
      );

      if (albumCheck.rows.length === 0) {
        console.log(`❌ Album ${albumId} not found for user ${userId}`);
        return false;
      }

      // Check if game exists for this user (using flexible matching)
      const gameRecord = await this.getGameRecord(userId, gameId);
      if (!gameRecord) {
        console.log(`❌ Game ${gameId} not found for user ${userId}`);
        return false;
      }

      // Use the actual game_id from the found record
      const actualGameId = gameRecord.gameId;
      console.log(
        `🎯 Using actual game_id: ${actualGameId} (searched for: ${gameId})`
      );

      // Try to add the game to the album
      const result = await client.query(
        `
        INSERT INTO profile_schema.album_games (album_id, game_id)
        VALUES ($1, $2)
        ON CONFLICT (album_id, game_id) DO NOTHING
        RETURNING *
        `,
        [albumId, actualGameId]
      );

      if (result.rows.length > 0) {
        console.log(`✅ Game ${actualGameId} added to album ${albumId}`);
        return true;
      } else {
        console.log(`⚠️ Game ${actualGameId} already in album ${albumId}`);
        return true; // Still consider it success if already added
      }
    } catch (error) {
      console.error(`❌ Error adding game to album:`, error);
      return false;
    } finally {
      client.release();
    }
  }

  async removeGameFromAlbum(
    albumId: string,
    gameId: string,
    userId: string
  ): Promise<boolean> {
    try {
      console.log(
        `📁 Removing game from album: albumId=${albumId}, gameId=${gameId}, userId=${userId}`
      );

      const result = await this.pool.query(
        `
        DELETE FROM profile_schema.album_games
        WHERE album_id = $1 AND game_id = $2
        AND EXISTS (
          SELECT 1 FROM profile_schema.game_albums WHERE id = $1 AND user_id = $3
        )
        `,
        [albumId, gameId, userId]
      );

      const success = (result.rowCount ?? 0) > 0;
      console.log(
        success
          ? `✅ Game removed from album`
          : `❌ Failed to remove game from album`
      );
      return success;
    } catch (error) {
      console.error(`❌ Error removing game from album:`, error);
      return false;
    }
  }

  // === USER STATISTICS ===
  async getUserStats(userId: string): Promise<UserStats> {
    const client = await this.pool.connect();
    try {
      // Get basic stats
      const statsResult = await client.query(
        `
        SELECT
          COUNT(*) as total_games,
          COUNT(*) FILTER (WHERE won = true) as wins,
          AVG(attempts) FILTER (WHERE won = true) as avg_attempts,
          MAX(completed_at) as last_played_at
        FROM profile_schema.game_records
        WHERE user_id = $1
        `,
        [userId]
      );

      const basicStats = statsResult.rows[0];
      const totalGames = parseInt(basicStats.total_games || "0");
      const wins = parseInt(basicStats.wins || "0");

      // Calculate guess distribution
      const distributionResult = await client.query(
        `
        SELECT attempts, COUNT(*) as count
        FROM profile_schema.game_records
        WHERE user_id = $1 AND won = true
        GROUP BY attempts
        ORDER BY attempts
        `,
        [userId]
      );

      const guessDistribution: { [attempts: string]: number } = {
        "1": 0,
        "2": 0,
        "3": 0,
        "4": 0,
        "5": 0,
        "6": 0,
      };

      distributionResult.rows.forEach((row: any) => {
        const attempts = Math.min(parseInt(row.attempts), 6).toString();
        guessDistribution[attempts] = parseInt(row.count);
      });

      // Calculate streaks
      const { currentStreak, maxStreak } = await this.calculateStreaks(
        userId,
        client
      );

      return {
        userId,
        totalGames,
        wins,
        winRate:
          totalGames > 0 ? Math.round((wins / totalGames) * 100 * 10) / 10 : 0,
        currentStreak,
        maxStreak,
        averageAttempts:
          wins > 0
            ? Math.round(parseFloat(basicStats.avg_attempts || "0") * 10) / 10
            : 0,
        guessDistribution,
        lastPlayedAt: basicStats.last_played_at
          ? new Date(basicStats.last_played_at)
          : null,
      };
    } finally {
      client.release();
    }
  }

  private async calculateStreaks(
    userId: string,
    client: PoolClient
  ): Promise<{ currentStreak: number; maxStreak: number }> {
    const result = await client.query(
      `
      SELECT won, completed_at
      FROM profile_schema.game_records
      WHERE user_id = $1
      ORDER BY completed_at DESC
      `,
      [userId]
    );

    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    result.rows.forEach((row: any, index: number) => {
      if (row.won) {
        tempStreak++;
        if (index === 0) currentStreak = tempStreak;
        maxStreak = Math.max(maxStreak, tempStreak);
      } else {
        if (index === 0) currentStreak = 0;
        tempStreak = 0;
      }
    });

    return { currentStreak, maxStreak };
  }

  // === ALBUM OPERATIONS ===
  async createAlbum(
    album: Omit<GameAlbum, "id" | "gameIds" | "createdAt" | "updatedAt">
  ): Promise<GameAlbum> {
    console.log(`📁 Creating album for user ${album.userId}: ${album.title}`);

    const result = await this.pool.query(
      `
      INSERT INTO profile_schema.game_albums (user_id, title, description, is_public)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [album.userId, album.title, album.description, album.isPublic]
    );

    const createdAlbum = this.mapGameAlbum(result.rows[0]);
    console.log(`✅ Album created with ID: ${createdAlbum.id}`);
    return createdAlbum;
  }

  async getUserAlbums(userId: string): Promise<GameAlbum[]> {
    console.log(`📁 Fetching albums for user ${userId}`);

    const result = await this.pool.query(
      `
      SELECT
        a.*,
        COALESCE(array_agg(ag.game_id) FILTER (WHERE ag.game_id IS NOT NULL), '{}') as game_ids
      FROM profile_schema.game_albums a
      LEFT JOIN profile_schema.album_games ag ON a.id = ag.album_id
      WHERE a.user_id = $1
      GROUP BY a.id
      ORDER BY a.created_at DESC
      `,
      [userId]
    );

    const albums = result.rows.map(this.mapGameAlbum);
    console.log(`📋 Found ${albums.length} albums for user ${userId}`);
    return albums;
  }

  async getAlbumWithGames(
    albumId: string,
    userId: string
  ): Promise<(GameAlbum & { games?: GameRecord[] }) | null> {
    const client = await this.pool.connect();
    try {
      console.log(`📁 Fetching album ${albumId} with games for user ${userId}`);

      // Get album with game IDs
      const albumResult = await client.query(
        `
        SELECT
          a.*,
          COALESCE(array_agg(ag.game_id) FILTER (WHERE ag.game_id IS NOT NULL), '{}') as game_ids
        FROM profile_schema.game_albums a
        LEFT JOIN profile_schema.album_games ag ON a.id = ag.album_id
        WHERE a.id = $1 AND a.user_id = $2
        GROUP BY a.id
        `,
        [albumId, userId]
      );

      if (albumResult.rows.length === 0) {
        console.log(`❌ Album ${albumId} not found for user ${userId}`);
        return null;
      }

      const album = this.mapGameAlbum(albumResult.rows[0]);
      console.log(`📋 Album found with ${album.gameIds.length} games`);

      // Get game records for games in this album
      if (album.gameIds.length > 0) {
        const gamesResult = await client.query(
          `
          SELECT * FROM profile_schema.game_records
          WHERE user_id = $1 AND game_id = ANY($2)
          ORDER BY completed_at DESC
          `,
          [userId, album.gameIds]
        );

        const games = gamesResult.rows.map(this.mapGameRecord);
        console.log(`🎮 Found ${games.length} game records for album`);
        return { ...album, games };
      }

      return { ...album, games: [] };
    } finally {
      client.release();
    }
  }

  async updateAlbum(
    albumId: string,
    userId: string,
    updates: Partial<Pick<GameAlbum, "title" | "description" | "isPublic">>
  ): Promise<GameAlbum | null> {
    const setParts: string[] = [];
    const values: any[] = [albumId, userId];
    let paramIndex = 3;

    if (updates.title !== undefined) {
      setParts.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      setParts.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.isPublic !== undefined) {
      setParts.push(`is_public = $${paramIndex++}`);
      values.push(updates.isPublic);
    }

    if (setParts.length === 0) return null;

    setParts.push(`updated_at = NOW()`);

    const result = await this.pool.query(
      `
      UPDATE profile_schema.game_albums
      SET ${setParts.join(", ")}
      WHERE id = $1 AND user_id = $2
      RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) return null;

    // Get the updated album with game IDs
    const albumResult = await this.pool.query(
      `
      SELECT
        a.*,
        COALESCE(array_agg(ag.game_id) FILTER (WHERE ag.game_id IS NOT NULL), '{}') as game_ids
      FROM profile_schema.game_albums a
      LEFT JOIN profile_schema.album_games ag ON a.id = ag.album_id
      WHERE a.id = $1 AND a.user_id = $2
      GROUP BY a.id
      `,
      [albumId, userId]
    );

    return albumResult.rows.length > 0
      ? this.mapGameAlbum(albumResult.rows[0])
      : null;
  }

  async deleteAlbum(albumId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM profile_schema.game_albums WHERE id = $1 AND user_id = $2`,
      [albumId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // === GAME VISUALIZATION ===
  async generateGameVisualization(
    userId: string,
    gameId: string
  ): Promise<GameVisualization | null> {
    const gameRecord = await this.getGameRecord(userId, gameId);
    if (!gameRecord) return null;

    const word = gameRecord.targetWord.toUpperCase();
    const board: string[][] = Array(6)
      .fill(null)
      .map(() => Array(5).fill(""));
    const colors: string[][] = Array(6)
      .fill(null)
      .map(() => Array(5).fill(""));

    // Generate the game board visualization based on guesses
    if (gameRecord.guesses && Array.isArray(gameRecord.guesses)) {
      gameRecord.guesses.forEach((guess, rowIndex) => {
        if (rowIndex < 6 && guess && guess.length === 5) {
          for (let i = 0; i < 5; i++) {
            board[rowIndex][i] = guess[i].toUpperCase();
            // Determine color based on position
            if (word[i] === guess[i].toUpperCase()) {
              colors[rowIndex][i] = "correct";
            } else if (word.includes(guess[i].toUpperCase())) {
              colors[rowIndex][i] = "present";
            } else {
              colors[rowIndex][i] = "absent";
            }
          }
        }
      });
    }

    return {
      board,
      colors,
      metadata: {
        word,
        attempts: gameRecord.attempts,
        won: gameRecord.won,
        date: gameRecord.completedAt.toISOString(),
      },
    };
  }

  // === HEALTH CHECK ===
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      const result = await this.pool.query("SELECT NOW() as timestamp");
      return {
        status: "healthy",
        timestamp: result.rows[0].timestamp,
      };
    } catch (error) {
      console.error("Health check failed:", error);
      throw error;
    }
  }

  // === HELPER METHODS ===
  private mapGameRecord(row: any): GameRecord {
    return {
      id: row.id,
      userId: row.user_id,
      gameId: row.game_id,
      targetWord: row.target_word,
      guesses: row.guesses,
      won: row.won,
      attempts: row.attempts,
      completedAt: new Date(row.completed_at),
      createdAt: new Date(row.created_at),
    };
  }

  private mapGameAlbum(row: any): GameAlbum {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      isPublic: row.is_public,
      gameIds: row.game_ids || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
    console.log("Profile service database connection closed");
  }
}

// Singleton export
export const profileDataAccess = ProfileDataAccess.getInstance();

/*// profile-service/src/data/ProfileDataAccess.ts - Cleaned up for game albums only
import { Pool, PoolClient } from "pg";

export interface GameRecord {
  id: string;
  userId: string;
  gameId: string;
  targetWord: string;
  guesses: string[];
  won: boolean;
  attempts: number;
  completedAt: Date;
  createdAt: Date;
}

export interface GameAlbum {
  id: string;
  userId: string;
  title: string;
  description: string;
  isPublic: boolean;
  gameIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStats {
  userId: string;
  totalGames: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  averageAttempts: number;
  guessDistribution: { [attempts: string]: number };
  lastPlayedAt: Date | null;
}

export interface GameVisualization {
  board: string[][];
  colors: string[][];
  metadata: {
    word: string;
    attempts: number;
    won: boolean;
    date: string;
  };
}

export class ProfileDataAccess {
  private pool: Pool;
  private static instance: ProfileDataAccess;

  private constructor() {
    const isDocker = process.env.DOCKER_ENV === "true";
    const defaultConnectionString = isDocker
      ? "postgresql://wordle_user:secure_password@postgres:5432/wordle_users"
      : "postgresql://wordle_user:secure_password@localhost:5433/wordle_users";

    const connectionString =
      process.env.DATABASE_URL || defaultConnectionString;

    console.log(
      `🔗 Connecting to database: ${connectionString.replace(
        /:[^:@]*@/,
        ":****@"
      )}`
    );

    this.pool = new Pool({
      connectionString,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on("connect", (client) => {
      client
        .query("SET search_path TO profile_schema, user_schema, public")
        .catch((err) => console.error("Failed to set search path:", err));
    });

    this.pool.on("error", (err) => {
      console.error("Profile service database error:", err);
    });

    console.log("Profile service database connection initialized");
  }

  public static getInstance(): ProfileDataAccess {
    if (!ProfileDataAccess.instance) {
      ProfileDataAccess.instance = new ProfileDataAccess();
    }
    return ProfileDataAccess.instance;
  }

  // === GAME RECORDS OPERATIONS ===
  async saveGameRecord(
    gameRecord: Omit<GameRecord, "id" | "createdAt">
  ): Promise<GameRecord> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `
        INSERT INTO profile_schema.game_records (user_id, game_id, target_word, guesses, won, attempts, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, game_id)
        DO UPDATE SET
          target_word = EXCLUDED.target_word,
          guesses = EXCLUDED.guesses,
          won = EXCLUDED.won,
          attempts = EXCLUDED.attempts,
          completed_at = EXCLUDED.completed_at
        RETURNING *
        `,
        [
          gameRecord.userId,
          gameRecord.gameId,
          gameRecord.targetWord,
          gameRecord.guesses,
          gameRecord.won,
          gameRecord.attempts,
          gameRecord.completedAt,
        ]
      );
      return this.mapGameRecord(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getUserGameRecords(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<GameRecord[]> {
    const result = await this.pool.query(
      `
      SELECT * FROM profile_schema.game_records
      WHERE user_id = $1
      ORDER BY completed_at DESC
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset]
    );
    return result.rows.map(this.mapGameRecord);
  }

  async getGameRecord(
    userId: string,
    gameId: string
  ): Promise<GameRecord | null> {
    const result = await this.pool.query(
      `
      SELECT * FROM profile_schema.game_records
      WHERE user_id = $1 AND game_id = $2
      `,
      [userId, gameId]
    );
    return result.rows.length > 0 ? this.mapGameRecord(result.rows[0]) : null;
  }

  // === USER STATISTICS ===
  async getUserStats(userId: string): Promise<UserStats> {
    const client = await this.pool.connect();
    try {
      // Get basic stats
      const statsResult = await client.query(
        `
        SELECT
          COUNT(*) as total_games,
          COUNT(*) FILTER (WHERE won = true) as wins,
          AVG(attempts) FILTER (WHERE won = true) as avg_attempts,
          MAX(completed_at) as last_played_at
        FROM profile_schema.game_records
        WHERE user_id = $1
        `,
        [userId]
      );

      const basicStats = statsResult.rows[0];
      const totalGames = parseInt(basicStats.total_games || "0");
      const wins = parseInt(basicStats.wins || "0");

      // Calculate guess distribution
      const distributionResult = await client.query(
        `
        SELECT attempts, COUNT(*) as count
        FROM profile_schema.game_records
        WHERE user_id = $1 AND won = true
        GROUP BY attempts
        ORDER BY attempts
        `,
        [userId]
      );

      const guessDistribution: { [attempts: string]: number } = {
        "1": 0,
        "2": 0,
        "3": 0,
        "4": 0,
        "5": 0,
        "6": 0,
      };

      distributionResult.rows.forEach((row: any) => {
        const attempts = Math.min(parseInt(row.attempts), 6).toString();
        guessDistribution[attempts] = parseInt(row.count);
      });

      // Calculate streaks
      const { currentStreak, maxStreak } = await this.calculateStreaks(
        userId,
        client
      );

      return {
        userId,
        totalGames,
        wins,
        winRate:
          totalGames > 0 ? Math.round((wins / totalGames) * 100 * 10) / 10 : 0,
        currentStreak,
        maxStreak,
        averageAttempts:
          wins > 0
            ? Math.round(parseFloat(basicStats.avg_attempts || "0") * 10) / 10
            : 0,
        guessDistribution,
        lastPlayedAt: basicStats.last_played_at
          ? new Date(basicStats.last_played_at)
          : null,
      };
    } finally {
      client.release();
    }
  }

  private async calculateStreaks(
    userId: string,
    client: PoolClient
  ): Promise<{ currentStreak: number; maxStreak: number }> {
    const result = await client.query(
      `
      SELECT won, completed_at
      FROM profile_schema.game_records
      WHERE user_id = $1
      ORDER BY completed_at DESC
      `,
      [userId]
    );

    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    result.rows.forEach((row: any, index: number) => {
      if (row.won) {
        tempStreak++;
        if (index === 0) currentStreak = tempStreak;
        maxStreak = Math.max(maxStreak, tempStreak);
      } else {
        if (index === 0) currentStreak = 0;
        tempStreak = 0;
      }
    });

    return { currentStreak, maxStreak };
  }

  // === ALBUM OPERATIONS (Game picture albums) ===
  async createAlbum(
    album: Omit<GameAlbum, "id" | "gameIds" | "createdAt" | "updatedAt">
  ): Promise<GameAlbum> {
    const result = await this.pool.query(
      `
      INSERT INTO profile_schema.game_albums (user_id, title, description, is_public)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [album.userId, album.title, album.description, album.isPublic]
    );
    return this.mapGameAlbum(result.rows[0]);
  }

  async getUserAlbums(userId: string): Promise<GameAlbum[]> {
    const result = await this.pool.query(
      `
      SELECT
        a.*,
        COALESCE(array_agg(ag.game_id) FILTER (WHERE ag.game_id IS NOT NULL), '{}') as game_ids
      FROM profile_schema.game_albums a
      LEFT JOIN profile_schema.album_games ag ON a.id = ag.album_id
      WHERE a.user_id = $1
      GROUP BY a.id
      ORDER BY a.created_at DESC
      `,
      [userId]
    );
    return result.rows.map(this.mapGameAlbum);
  }

  async getAlbumWithGames(
    albumId: string,
    userId: string
  ): Promise<(GameAlbum & { games?: GameRecord[] }) | null> {
    const client = await this.pool.connect();
    try {
      // Get album with game IDs
      const albumResult = await client.query(
        `
        SELECT
          a.*,
          COALESCE(array_agg(ag.game_id) FILTER (WHERE ag.game_id IS NOT NULL), '{}') as game_ids
        FROM profile_schema.game_albums a
        LEFT JOIN profile_schema.album_games ag ON a.id = ag.album_id
        WHERE a.id = $1 AND a.user_id = $2
        GROUP BY a.id
        `,
        [albumId, userId]
      );

      if (albumResult.rows.length === 0) {
        return null;
      }

      const album = this.mapGameAlbum(albumResult.rows[0]);

      // Get game records for games in this album
      if (album.gameIds.length > 0) {
        const gamesResult = await client.query(
          `
          SELECT * FROM profile_schema.game_records
          WHERE user_id = $1 AND game_id = ANY($2)
          ORDER BY completed_at DESC
          `,
          [userId, album.gameIds]
        );

        const games = gamesResult.rows.map(this.mapGameRecord);
        return { ...album, games };
      }

      return { ...album, games: [] };
    } finally {
      client.release();
    }
  }

  async updateAlbum(
    albumId: string,
    userId: string,
    updates: Partial<Pick<GameAlbum, "title" | "description" | "isPublic">>
  ): Promise<GameAlbum | null> {
    const setParts: string[] = [];
    const values: any[] = [albumId, userId];
    let paramIndex = 3;

    if (updates.title !== undefined) {
      setParts.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      setParts.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.isPublic !== undefined) {
      setParts.push(`is_public = $${paramIndex++}`);
      values.push(updates.isPublic);
    }

    if (setParts.length === 0) return null;

    setParts.push(`updated_at = NOW()`);

    const result = await this.pool.query(
      `
      UPDATE profile_schema.game_albums
      SET ${setParts.join(", ")}
      WHERE id = $1 AND user_id = $2
      RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) return null;

    // Get the updated album with game IDs
    const albumResult = await this.pool.query(
      `
      SELECT
        a.*,
        COALESCE(array_agg(ag.game_id) FILTER (WHERE ag.game_id IS NOT NULL), '{}') as game_ids
      FROM profile_schema.game_albums a
      LEFT JOIN profile_schema.album_games ag ON a.id = ag.album_id
      WHERE a.id = $1 AND a.user_id = $2
      GROUP BY a.id
      `,
      [albumId, userId]
    );

    return albumResult.rows.length > 0
      ? this.mapGameAlbum(albumResult.rows[0])
      : null;
  }

  async deleteAlbum(albumId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM profile_schema.game_albums WHERE id = $1 AND user_id = $2`,
      [albumId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async addGameToAlbum(
    albumId: string,
    gameId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `
        INSERT INTO profile_schema.album_games (album_id, game_id)
        SELECT $1, $2
        WHERE EXISTS (
          SELECT 1 FROM profile_schema.game_albums WHERE id = $1 AND user_id = $3
        ) AND EXISTS (
          SELECT 1 FROM profile_schema.game_records WHERE game_id = $2 AND user_id = $3
        )
        ON CONFLICT (album_id, game_id) DO NOTHING
        `,
        [albumId, gameId, userId]
      );
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async removeGameFromAlbum(
    albumId: string,
    gameId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `
        DELETE FROM profile_schema.album_games
        WHERE album_id = $1 AND game_id = $2
        AND EXISTS (
          SELECT 1 FROM profile_schema.game_albums WHERE id = $1 AND user_id = $3
        )
        `,
        [albumId, gameId, userId]
      );
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  // === GAME VISUALIZATION ===
  async generateGameVisualization(
    userId: string,
    gameId: string
  ): Promise<GameVisualization | null> {
    const gameRecord = await this.getGameRecord(userId, gameId);
    if (!gameRecord) return null;

    const word = gameRecord.targetWord.toUpperCase();
    const board: string[][] = Array(6)
      .fill(null)
      .map(() => Array(5).fill(""));
    const colors: string[][] = Array(6)
      .fill(null)
      .map(() => Array(5).fill(""));

    // Generate the game board visualization based on guesses
    if (gameRecord.guesses && Array.isArray(gameRecord.guesses)) {
      gameRecord.guesses.forEach((guess, rowIndex) => {
        if (rowIndex < 6 && guess && guess.length === 5) {
          for (let i = 0; i < 5; i++) {
            board[rowIndex][i] = guess[i].toUpperCase();
            // Determine color based on position
            if (word[i] === guess[i].toUpperCase()) {
              colors[rowIndex][i] = "correct";
            } else if (word.includes(guess[i].toUpperCase())) {
              colors[rowIndex][i] = "present";
            } else {
              colors[rowIndex][i] = "absent";
            }
          }
        }
      });
    }

    return {
      board,
      colors,
      metadata: {
        word,
        attempts: gameRecord.attempts,
        won: gameRecord.won,
        date: gameRecord.completedAt.toISOString(),
      },
    };
  }

  // === HEALTH CHECK ===
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      const result = await this.pool.query("SELECT NOW() as timestamp");
      return {
        status: "healthy",
        timestamp: result.rows[0].timestamp,
      };
    } catch (error) {
      console.error("Health check failed:", error);
      throw error;
    }
  }

  // === HELPER METHODS ===
  private mapGameRecord(row: any): GameRecord {
    return {
      id: row.id,
      userId: row.user_id,
      gameId: row.game_id,
      targetWord: row.target_word,
      guesses: row.guesses,
      won: row.won,
      attempts: row.attempts,
      completedAt: new Date(row.completed_at),
      createdAt: new Date(row.created_at),
    };
  }

  private mapGameAlbum(row: any): GameAlbum {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      isPublic: row.is_public,
      gameIds: row.game_ids || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
    console.log("Profile service database connection closed");
  }
}

// Singleton export
export const profileDataAccess = ProfileDataAccess.getInstance();
*/
