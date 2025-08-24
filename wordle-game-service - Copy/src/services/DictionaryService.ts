import { createClient, RedisClientType } from "redis";

export interface DictionaryRepository {
  validateWord(word: string): Promise<boolean>;
  getRandomWord(): Promise<string>;
  getWordCount(): Promise<number>;
  refreshDictionary(): Promise<void>;
}

export class HybridDictionaryService implements DictionaryRepository {
  private memoryCache: Set<string> = new Set();
  private isInitialized = false;
  private redisClient: RedisClientType | null = null;
  private readonly GITHUB_URL =
    "https://raw.githubusercontent.com/tabatkins/wordle-list/main/words";
  private readonly CACHE_KEY = "wordle:dictionary:v1";
  private readonly CACHE_TTL = 86400; // 24 hours

  // Curated fallback list of 200+ common 5-letter words
  private readonly FALLBACK_WORDS = [
    "ABOUT",
    "ABOVE",
    "ABUSE",
    "ACTOR",
    "ACUTE",
    "ADMIT",
    "ADOPT",
    "ADULT",
    "AFTER",
    "AGAIN",
    "AGENT",
    "AGREE",
    "AHEAD",
    "ALARM",
    "ALBUM",
    "ALERT",
    "ALIEN",
    "ALIGN",
    "ALIKE",
    "ALIVE",
    "ALLOW",
    "ALONE",
    "ALONG",
    "ALTER",
    "AMONG",
    "ANGER",
    "ANGLE",
    "ANGRY",
    "APART",
    "APPLE",
    "APPLY",
    "ARENA",
    "ARGUE",
    "ARISE",
    "ARRAY",
    "ARROW",
    "ASIDE",
    "ASSET",
    "AVOID",
    "AWAKE",
    "AWARE",
    "BADLY",
    "BAKER",
    "BASES",
    "BASIC",
    "BEACH",
    "BEGAN",
    "BEGIN",
    "BEING",
    "BELOW",
    "BENCH",
    "BILLY",
    "BIRTH",
    "BLACK",
    "BLAME",
    "BLANK",
    "BLIND",
    "BLOCK",
    "BLOOD",
    "BOARD",
    "BOAST",
    "BOOST",
    "BOOTH",
    "BOUND",
    "BRAIN",
    "BRAND",
    "BRAVE",
    "BREAD",
    "BREAK",
    "BREED",
    "BRIEF",
    "BRING",
    "BROAD",
    "BROKE",
    "BROWN",
    "BUILD",
    "BUILT",
    "BUYER",
    "CABLE",
    "CHAIR",
    "CHAOS",
    "CHARM",
    "CHART",
    "CHASE",
    "CHEAP",
    "CHECK",
    "CHESS",
    "CHEST",
    "CHILD",
    "CHINA",
    "CHOSE",
    "CIVIL",
    "CLAIM",
    "CLASS",
    "CLEAN",
    "CLEAR",
    "CLICK",
    "CLIMB",
    "CLOCK",
    "CLOSE",
    "CLOUD",
    "COACH",
    "COAST",
    "COULD",
    "COUNT",
    "COURT",
    "COVER",
    "CRAFT",
    "CRASH",
    "CRAZY",
    "CREAM",
    "CRIME",
    "CROSS",
    "CROWD",
    "CROWN",
    "CRUDE",
    "CURVE",
    "CYCLE",
    "DAILY",
    "DANCE",
    "DATED",
    "DEALT",
    "DEATH",
    "DEBUT",
    "DELAY",
    "DEPTH",
    "DOING",
    "DOUBT",
    "DOZEN",
    "DRAFT",
    "DRAMA",
    "DRANK",
    "DREAM",
    "DRESS",
    "DRILL",
    "DRINK",
    "DRIVE",
    "DROVE",
    "DYING",
    "EAGER",
    "EAGLE",
    "EARLY",
    "EARTH",
    "EIGHT",
    "ELITE",
    "EMPTY",
    "ENEMY",
    "ENJOY",
    "ENTER",
    "ENTRY",
    "EQUAL",
    "ERROR",
    "EVENT",
    "EVERY",
    "EXACT",
    "EXIST",
    "EXTRA",
    "FAITH",
    "FALSE",
    "FAULT",
    "FIBER",
    "FIELD",
    "FIFTH",
    "FIFTY",
    "FIGHT",
    "FINAL",
    "FIRST",
    "FIXED",
    "FLASH",
    "FLEET",
    "FLOOR",
    "FLUID",
    "FOCUS",
    "FORCE",
    "FORTH",
    "FORTY",
    "FORUM",
    "FOUND",
    "FRAME",
    "FRANK",
    "FRAUD",
    "FRESH",
    "FRONT",
    "FRUIT",
    "FULLY",
    "FUNNY",
    "GIANT",
    "GIVEN",
    "GLASS",
    "GLOBE",
    "GOING",
    "GRACE",
    "GRADE",
    "GRAND",
    "GRANT",
    "GRASS",
    "GRAVE",
    "GREAT",
    "GREEN",
    "GROSS",
    "GROUP",
    "GROWN",
    "GUARD",
    "GUESS",
    "GUEST",
    "GUIDE",
    "HAPPY",
    "HARRY",
    "HEART",
    "HEAVY",
    "HENCE",
    "HENRY",
    "HORSE",
    "HOTEL",
    "HOUSE",
    "HUMAN",
    "IDEAL",
    "IMAGE",
    "INDEX",
    "INNER",
    "INPUT",
    "ISSUE",
    "JAPAN",
    "JIMMY",
    "JOINT",
    "JONES",
    "JUDGE",
    "KNIFE",
    "KNOCK",
    "KNOWN",
    "LABEL",
    "LARGE",
    "LASER",
    "LATER",
    "LAUGH",
    "LAYER",
    "LEARN",
    "LEASE",
    "LEAST",
    "LEAVE",
    "LEGAL",
    "LEVEL",
    "LEWIS",
    "LIGHT",
    "LIMIT",
    "LINKS",
    "LIVES",
    "LOCAL",
    "LOOSE",
    "LOWER",
    "LUCKY",
    "LUNCH",
    "LYING",
    "MAGIC",
    "MAJOR",
    "MAKER",
    "MARCH",
    "MARIA",
    "MATCH",
    "MAYBE",
    "MAYOR",
    "MEANT",
    "MEDIA",
    "METAL",
    "MIGHT",
    "MINOR",
    "MINUS",
    "MIXED",
    "MODEL",
    "MONEY",
    "MONTH",
    "MORAL",
    "MOTOR",
    "MOUNT",
    "MOUSE",
    "MOUTH",
    "MOVED",
    "MOVIE",
    "MUSIC",
    "NEEDS",
    "NEVER",
    "NEWLY",
    "NIGHT",
    "NOISE",
    "NORTH",
    "NOTED",
    "NOVEL",
    "NURSE",
    "OCCUR",
    "OCEAN",
    "OFFER",
    "OFTEN",
    "ORDER",
    "OTHER",
    "OUGHT",
    "PAINT",
    "PANEL",
    "PAPER",
    "PARTY",
    "PEACE",
    "PETER",
    "PHASE",
    "PHONE",
    "PHOTO",
    "PIANO",
    "PIECE",
    "PILOT",
    "PITCH",
    "PLACE",
    "PLAIN",
    "PLANE",
    "PLANT",
    "PLATE",
    "POINT",
    "POUND",
    "POWER",
    "PRESS",
    "PRICE",
    "PRIDE",
    "PRIME",
    "PRINT",
    "PRIOR",
    "PRIZE",
    "PROOF",
    "PROUD",
    "PROVE",
    "QUEEN",
    "QUICK",
    "QUIET",
    "QUITE",
    "RADIO",
    "RAISE",
    "RANGE",
    "RAPID",
    "RATIO",
    "REACH",
    "READY",
    "REALM",
    "REBEL",
    "REFER",
    "RELAX",
    "REPLY",
    "RIGHT",
    "RIGID",
    "RIVAL",
    "RIVER",
    "ROBOT",
    "ROGER",
    "ROMAN",
    "ROUGH",
    "ROUND",
    "ROUTE",
    "ROYAL",
    "RURAL",
    "SCALE",
    "SCENE",
    "SCOPE",
    "SCORE",
    "SENSE",
    "SERVE",
    "SETUP",
    "SEVEN",
    "SHALL",
    "SHAPE",
    "SHARE",
    "SHARP",
    "SHEET",
    "SHELF",
    "SHELL",
    "SHIFT",
    "SHINE",
    "SHIRT",
    "SHOCK",
    "SHOOT",
    "SHORT",
    "SHOWN",
    "SIGHT",
    "SILLY",
    "SINCE",
    "SIXTH",
    "SIXTY",
    "SIZED",
    "SKILL",
    "SLEEP",
    "SLIDE",
    "SMALL",
    "SMART",
    "SMILE",
    "SMITH",
    "SMOKE",
    "SNAKE",
    "SNOW",
    "SOLID",
    "SOLVE",
    "SORRY",
    "SOUND",
    "SOUTH",
    "SPACE",
    "SPARE",
    "SPEAK",
    "SPEED",
    "SPEND",
    "SPENT",
    "SPLIT",
    "SPOKE",
    "SPORT",
    "STAFF",
    "STAGE",
    "STAKE",
    "STAND",
    "START",
    "STATE",
    "STEAM",
    "STEEL",
    "STEEP",
    "STICK",
    "STILL",
    "STOCK",
    "STONE",
    "STOOD",
    "STORE",
    "STORM",
    "STORY",
    "STRIP",
    "STUCK",
    "STUDY",
    "STUFF",
    "STYLE",
    "SUGAR",
    "SUITE",
    "SUPER",
    "SWEET",
    "TABLE",
    "TAKEN",
    "TASTE",
    "TAXES",
    "TEACH",
    "TEAMS",
    "TEENS",
    "TEETH",
    "TERRY",
    "TEXAS",
    "THANK",
    "THEFT",
    "THEIR",
    "THEME",
    "THERE",
    "THESE",
    "THICK",
    "THING",
    "THINK",
    "THIRD",
    "THOSE",
    "THREE",
    "THREW",
    "THROW",
    "THUMB",
    "TIGHT",
    "TIRED",
    "TITLE",
    "TODAY",
    "TOPIC",
    "TOTAL",
    "TOUCH",
    "TOUGH",
    "TOWER",
    "TRACK",
    "TRADE",
    "TRAIN",
    "TREAT",
    "TREND",
    "TRIAL",
    "TRIBE",
    "TRICK",
    "TRIED",
    "TRIES",
    "TRIP",
    "TRUCK",
    "TRULY",
    "TRUNK",
    "TRUST",
    "TRUTH",
    "TWICE",
    "UNCLE",
    "UNDUE",
    "UNION",
    "UNITY",
    "UNTIL",
    "UPPER",
    "UPSET",
    "URBAN",
    "USAGE",
    "USUAL",
    "VALID",
    "VALUE",
    "VIDEO",
    "VIRUS",
    "VISIT",
    "VITAL",
    "VOCAL",
    "VOICE",
    "WASTE",
    "WATCH",
    "WATER",
    "WHEEL",
    "WHERE",
    "WHICH",
    "WHILE",
    "WHITE",
    "WHOLE",
    "WHOSE",
    "WOMAN",
    "WOMEN",
    "WORLD",
    "WORRY",
    "WORSE",
    "WORST",
    "WORTH",
    "WOULD",
    "WRITE",
    "WRONG",
    "WROTE",
    "YOUNG",
    "YOUTH",
  ];

  constructor() {
    this.initializeRedis();
    this.initializeDictionary();
  }

  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
      this.redisClient = createClient({ url: redisUrl });

      this.redisClient.on("error", (err) => {
        console.warn("⚠️ Redis Client Error:", err);
        this.redisClient = null;
      });

      this.redisClient.on("connect", () => {
        console.log("✅ Redis connected successfully");
      });

      await this.redisClient.connect();
    } catch (error) {
      console.warn("⚠️ Redis initialization failed:", error);
      this.redisClient = null;
    }
  }

  private async initializeDictionary(): Promise<void> {
    const strategies = [
      { name: "GitHub API", fn: this.loadFromGitHub.bind(this) },
      { name: "Redis Cache", fn: this.loadFromRedis.bind(this) },
      { name: "Fallback Words", fn: this.loadFromFallback.bind(this) },
    ];

    for (const strategy of strategies) {
      try {
        console.log(`🔄 Trying to load dictionary from ${strategy.name}...`);
        const words = await strategy.fn();

        if (words && words.length > 0) {
          this.memoryCache = new Set(words.map((w) => w.toUpperCase().trim()));
          console.log(
            `✅ Dictionary loaded from ${strategy.name}: ${this.memoryCache.size} words`
          );
          this.isInitialized = true;
          return;
        }
      } catch (error) {
        console.warn(`⚠️ ${strategy.name} failed:`, error.message);
        continue;
      }
    }

    throw new Error("❌ All dictionary loading strategies failed");
  }

  private async loadFromGitHub(): Promise<string[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(this.GITHUB_URL, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Wordle-Game-Service/1.0",
          Accept: "text/plain",
        },
      });

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`
        );
      }

      const text = await response.text();
      const words = text
        .split("\n")
        .map((w) => w.trim().toUpperCase())
        .filter((w) => w.length === 5 && /^[A-Z]+$/.test(w));

      if (words.length === 0) {
        throw new Error("No valid words found in GitHub response");
      }

      // Cache in Redis for future use
      if (this.redisClient && words.length > 0) {
        try {
          await this.redisClient.setEx(
            this.CACHE_KEY,
            this.CACHE_TTL,
            JSON.stringify(words)
          );
          console.log("📦 Words cached in Redis");
        } catch (redisError) {
          console.warn("⚠️ Failed to cache in Redis:", redisError);
        }
      }

      return words;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async loadFromRedis(): Promise<string[]> {
    if (!this.redisClient) {
      throw new Error("Redis client not available");
    }

    const cached = await this.redisClient.get(this.CACHE_KEY);
    if (!cached) {
      throw new Error("No Redis cache found");
    }

    const words = JSON.parse(cached) as string[];
    if (!Array.isArray(words) || words.length === 0) {
      throw new Error("Invalid cached data");
    }

    return words;
  }

  private async loadFromFallback(): Promise<string[]> {
    return this.FALLBACK_WORDS;
  }

  async validateWord(word: string): Promise<boolean> {
    await this.ensureInitialized();
    const normalizedWord = word.toUpperCase().trim();

    if (normalizedWord.length !== 5 || !/^[A-Z]+$/.test(normalizedWord)) {
      return false;
    }

    return this.memoryCache.has(normalizedWord);
  }

  async getRandomWord(): Promise<string> {
    await this.ensureInitialized();
    const words = Array.from(this.memoryCache);
    const randomIndex = Math.floor(Math.random() * words.length);
    return words[randomIndex];
  }

  async getWordCount(): Promise<number> {
    await this.ensureInitialized();
    return this.memoryCache.size;
  }

  async refreshDictionary(): Promise<void> {
    console.log("🔄 Refreshing dictionary...");
    this.isInitialized = false;
    this.memoryCache.clear();

    // Clear Redis cache
    if (this.redisClient) {
      try {
        await this.redisClient.del(this.CACHE_KEY);
      } catch (error) {
        console.warn("⚠️ Failed to clear Redis cache:", error);
      }
    }

    await this.initializeDictionary();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeDictionary();
    }
  }

  // Graceful shutdown
  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

// Singleton instance
export const dictionaryService = new HybridDictionaryService();

// Graceful shutdown handler
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...");
  await dictionaryService.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received, shutting down gracefully...");
  await dictionaryService.close();
  process.exit(0);
});

// game-service/src/services/DictionaryService.ts
import { createClient, RedisClientType } from "redis";

export interface DictionaryService {
  validateWord(word: string): Promise<boolean>;
  getRandomWord(): Promise<string>;
  getDictionarySize(): number;
  refreshDictionary(): Promise<void>;
}

export class HybridDictionaryService implements DictionaryService {
  private memoryCache: Set<string> = new Set();
  private isInitialized = false;
  private redisClient: RedisClientType | null = null;

  private readonly GITHUB_URL =
    "https://raw.githubusercontent.com/tabatkins/wordle-list/main/words";
  private readonly REDIS_KEY = "wordle:dictionary";
  private readonly CACHE_TTL = 86400; // 24 hours

  // Fallback words (curated list of 200+ common 5-letter words)
  private readonly FALLBACK_WORDS = [
    "ABOUT",
    "ABOVE",
    "ABUSE",
    "ACTOR",
    "ACUTE",
    "ADMIT",
    "ADOPT",
    "ADULT",
    "AFTER",
    "AGAIN",
    "AGENT",
    "AGREE",
    "AHEAD",
    "ALARM",
    "ALBUM",
    "ALERT",
    "ALIEN",
    "ALIGN",
    "ALIKE",
    "ALIVE",
    "ALLOW",
    "ALONE",
    "ALONG",
    "ALTER",
    "ANGEL",
    "ANGER",
    "ANGLE",
    "ANGRY",
    "APART",
    "APPLE",
    "APPLY",
    "ARENA",
    "ARGUE",
    "ARISE",
    "ARRAY",
    "ASIDE",
    "ASSET",
    "AVOID",
    "AWAKE",
    "AWARD",
    "AWARE",
    "BADLY",
    "BAKER",
    "BASES",
    "BASIC",
    "BEACH",
    "BEGAN",
    "BEGIN",
    "BEING",
    "BELLY",
    "BELOW",
    "BENCH",
    "BILLY",
    "BIRTH",
    "BLACK",
    "BLAME",
    "BLANK",
    "BLAST",
    "BLIND",
    "BLOCK",
    "BLOOD",
    "BLOOM",
    "BOARD",
    "BOOST",
    "BOOTH",
    "BOUND",
    "BRAIN",
    "BRAND",
    "BRASS",
    "BRAVE",
    "BREAD",
    "BREAK",
    "BREED",
    "BRIEF",
    "BRING",
    "BROAD",
    "BROKE",
    "BROWN",
    "BUILD",
    "BUYER",
    "CABLE",
    "CALIF",
    "CARRY",
    "CATCH",
    "CAUSE",
    "CHAIN",
    "CHAIR",
    "CHAOS",
    "CHARM",
    "CHART",
    "CHASE",
    "CHEAP",
    "CHECK",
    "CHEST",
    "CHIEF",
    "CHILD",
    "CHINA",
    "CHOSE",
    "CIVIL",
    "CLAIM",
    "CLASS",
    "CLEAN",
    "CLEAR",
    "CLICK",
    "CLIMB",
    "CLOCK",
    "CLOSE",
    "CLOUD",
    "COACH",
    "COAST",
    "COULD",
    "COUNT",
    "COURT",
    "COVER",
    "CRAFT",
    "CRASH",
    "CRAZY",
    "CREAM",
    "CRIME",
    "CROSS",
    "CROWD",
    "CROWN",
    "CRUDE",
    "CURVE",
    "CYCLE",
    "DAILY",
    "DANCE",
    "DATED",
    "DEALT",
    "DEATH",
    "DEBUT",
    "DELAY",
    "DEPTH",
    "DOING",
    "DOUBT",
    "DOZEN",
    "DRAFT",
    "DRAMA",
    "DRANK",
    "DRAWN",
    "DREAM",
    "DRESS",
    "DRILL",
    "DRINK",
    "DRIVE",
    "DROVE",
    "DYING",
    "EAGER",
    "EARLY",
    "EARTH",
    "EIGHT",
    "ELITE",
    "EMPTY",
    "ENEMY",
    "ENJOY",
    "ENTER",
    "ENTRY",
    "EQUAL",
    "ERROR",
    "EVENT",
    "EVERY",
    "EXACT",
    "EXIST",
    "EXTRA",
    "FAITH",
    "FALSE",
    "FAULT",
    "FIBER",
    "FIELD",
    "FIFTH",
    "FIFTY",
    "FIGHT",
    "FINAL",
    "FIRST",
    "FIXED",
    "FLASH",
    "FLEET",
    "FLOOR",
    "FLUID",
    "FOCUS",
    "FORCE",
    "FORTH",
    "FORTY",
    "FORUM",
    "FOUND",
    "FRAME",
    "FRANK",
    "FRAUD",
    "FRESH",
    "FRONT",
    "FRUIT",
    "FULLY",
    "FUNNY",
    "GIANT",
    "GIVEN",
    "GLASS",
    "GLOBE",
    "GOING",
    "GRACE",
    "GRADE",
    "GRAND",
    "GRANT",
    "GRASS",
    "GRAVE",
    "GREAT",
    "GREEN",
    "GROSS",
    "GROUP",
    "GROWN",
    "GUARD",
    "GUESS",
    "GUEST",
    "GUIDE",
    "HAPPY",
    "HARRY",
    "HEART",
    "HEAVY",
    "HENRY",
    "HORSE",
    "HOTEL",
    "HOUSE",
    "HUMAN",
    "IDEAL",
    "IMAGE",
    "INDEX",
    "INNER",
    "INPUT",
    "ISSUE",
    "JAPAN",
    "JIMMY",
    "JOINT",
    "JONES",
    "JUDGE",
    "KNOWN",
    "LABEL",
    "LARGE",
    "LASER",
    "LATER",
    "LAUGH",
    "LAYER",
    "LEARN",
    "LEASE",
    "LEAST",
    "LEAVE",
    "LEGAL",
    "LEVEL",
    "LEWIS",
    "LIGHT",
    "LIMIT",
    "LINKS",
    "LIVES",
    "LOCAL",
    "LOGIC",
    "LOOSE",
    "LOWER",
    "LUCKY",
    "LUNCH",
    "LYING",
    "MAGIC",
    "MAJOR",
    "MAKER",
    "MARCH",
    "MARIA",
    "MATCH",
    "MAYBE",
    "MAYOR",
    "MEANT",
    "MEDIA",
    "METAL",
    "MIGHT",
    "MINOR",
    "MINUS",
    "MIXED",
    "MODEL",
    "MONEY",
    "MONTH",
    "MORAL",
    "MOTOR",
    "MOUNT",
    "MOUSE",
    "MOUTH",
    "MOVED",
    "MOVIE",
    "MUSIC",
    "NEEDS",
    "NEVER",
    "NEWLY",
    "NIGHT",
    "NOISE",
    "NORTH",
    "NOTED",
    "NOVEL",
    "NURSE",
    "OCEAN",
    "OFFER",
    "OFTEN",
    "ORDER",
    "OTHER",
    "OUGHT",
    "PAINT",
    "PANEL",
    "PAPER",
    "PARTY",
    "PEACE",
    "PETER",
    "PHASE",
    "PHONE",
    "PHOTO",
    "PIANO",
    "PIECE",
    "PILOT",
    "PITCH",
    "PLACE",
    "PLAIN",
    "PLANE",
    "PLANT",
    "PLATE",
    "POINT",
    "POUND",
    "POWER",
    "PRESS",
    "PRICE",
    "PRIDE",
    "PRIME",
    "PRINT",
    "PRIOR",
    "PRIZE",
    "PROOF",
    "PROUD",
    "PROVE",
    "QUEEN",
    "QUICK",
    "QUIET",
    "QUITE",
    "RADIO",
    "RAISE",
    "RANGE",
    "RAPID",
    "RATIO",
    "REACH",
    "READY",
    "REALM",
    "REBEL",
    "REFER",
    "RELAX",
    "REPLY",
    "RIGHT",
    "RIGID",
    "RIVER",
    "ROBIN",
    "ROGER",
    "ROMAN",
    "ROUGH",
    "ROUND",
    "ROUTE",
    "ROYAL",
    "RURAL",
    "SCALE",
    "SCENE",
    "SCOPE",
    "SCORE",
    "SENSE",
    "SERVE",
    "SETUP",
    "SEVEN",
    "SHALL",
    "SHAPE",
    "SHARE",
    "SHARP",
    "SHEET",
    "SHELF",
    "SHELL",
    "SHIFT",
    "SHINE",
    "SHIRT",
    "SHOCK",
    "SHOOT",
    "SHORT",
    "SHOWN",
    "SIGHT",
    "SINCE",
    "SIXTH",
    "SIXTY",
    "SIZED",
    "SKILL",
    "SLEEP",
    "SLIDE",
    "SMALL",
    "SMART",
    "SMILE",
    "SMITH",
    "SMOKE",
    "SOLID",
    "SOLVE",
    "SORRY",
    "SOUND",
    "SOUTH",
    "SPACE",
    "SPARE",
    "SPEAK",
    "SPEED",
    "SPEND",
    "SPENT",
    "SPLIT",
    "SPOKE",
    "SPORT",
    "STAFF",
    "STAGE",
    "STAKE",
    "STAND",
    "START",
    "STATE",
    "STEAM",
    "STEEL",
    "STEEP",
    "STEER",
    "STICK",
    "STILL",
    "STOCK",
    "STONE",
    "STOOD",
    "STORE",
    "STORM",
    "STORY",
    "STRIP",
    "STUCK",
    "STUDY",
    "STUFF",
    "STYLE",
    "SUGAR",
    "SUITE",
    "SUPER",
    "SWEET",
    "TABLE",
    "TAKEN",
    "TASTE",
    "TAXES",
    "TEACH",
    "TEAM",
    "TERRY",
    "TEXAS",
    "THANK",
    "THEFT",
    "THEIR",
    "THEME",
    "THERE",
    "THESE",
    "THICK",
    "THING",
    "THINK",
    "THIRD",
    "THOSE",
    "THREE",
    "THREW",
    "THROW",
    "THUMB",
    "TIGHT",
    "TIRED",
    "TITLE",
    "TODAY",
    "TOPIC",
    "TOTAL",
    "TOUCH",
    "TOUGH",
    "TOWER",
    "TRACK",
    "TRADE",
    "TRAIN",
    "TREAT",
    "TREND",
    "TRIAL",
    "TRIBE",
    "TRICK",
    "TRIED",
    "TRIES",
    "TRIP",
    "TRUCK",
    "TRULY",
    "TRUNK",
    "TRUST",
    "TRUTH",
    "TWICE",
    "UNCLE",
    "UNDER",
    "UNDUE",
    "UNION",
    "UNITY",
    "UNTIL",
    "UPPER",
    "UPSET",
    "URBAN",
    "USAGE",
    "USUAL",
    "VALID",
    "VALUE",
    "VIDEO",
    "VIRUS",
    "VISIT",
    "VITAL",
    "VOCAL",
    "VOICE",
    "WASTE",
    "WATCH",
    "WATER",
    "WHEEL",
    "WHERE",
    "WHICH",
    "WHILE",
    "WHITE",
    "WHOLE",
    "WHOSE",
    "WOMAN",
    "WOMEN",
    "WORLD",
    "WORRY",
    "WORSE",
    "WORST",
    "WORTH",
    "WOULD",
    "WRITE",
    "WRONG",
    "WROTE",
    "YOUNG",
    "YOUTH",
  ];

  constructor(redisUrl?: string) {
    if (redisUrl) {
      this.redisClient = createClient({ url: redisUrl });
      this.redisClient.on("error", (err) =>
        console.error("Redis Client Error:", err)
      );
    }
  }

  async initialize(): Promise<void> {
    console.log("🔄 Initializing dictionary service...");

    // Connect to Redis if available
    if (this.redisClient && !this.redisClient.isOpen) {
      try {
        await this.redisClient.connect();
        console.log("✅ Connected to Redis");
      } catch (error) {
        console.warn("⚠️ Redis connection failed:", error);
        this.redisClient = null;
      }
    }

    const strategies = [
      this.loadFromGitHub.bind(this),
      this.loadFromRedis.bind(this),
      this.loadFromFallback.bind(this),
    ];

    for (const strategy of strategies) {
      try {
        const words = await strategy();
        if (words && words.length > 0) {
          this.memoryCache = new Set(words.map((w) => w.toUpperCase()));
          console.log(`✅ Dictionary loaded: ${this.memoryCache.size} words`);
          this.isInitialized = true;
          return;
        }
      } catch (error) {
        console.warn(`Dictionary loading strategy failed:`, error);
        continue;
      }
    }

    throw new Error("❌ All dictionary loading strategies failed");
  }

  private async loadFromGitHub(): Promise<string[]> {
    console.log("📡 Loading from GitHub...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(this.GITHUB_URL, {
        signal: controller.signal,
        headers: { "User-Agent": "Wordle-Game-Service/1.0" },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const text = await response.text();
      const words = text
        .split("\n")
        .map((w) => w.trim().toUpperCase())
        .filter((w) => w.length === 5 && /^[A-Z]+$/.test(w));

      // Cache in Redis
      if (this.redisClient && words.length > 0) {
        await this.redisClient.setEx(
          this.REDIS_KEY,
          this.CACHE_TTL,
          JSON.stringify(words)
        );
        console.log("💾 Cached dictionary in Redis");
      }

      return words;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async loadFromRedis(): Promise<string[]> {
    if (!this.redisClient) {
      throw new Error("Redis not available");
    }

    console.log("🗂️ Loading from Redis cache...");
    const cached = await this.redisClient.get(this.REDIS_KEY);

    if (!cached) {
      throw new Error("No Redis cache found");
    }

    return JSON.parse(cached) as string[];
  }

  private async loadFromFallback(): Promise<string[]> {
    console.log("🆘 Loading from fallback words...");
    return this.FALLBACK_WORDS;
  }

  async validateWord(word: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.memoryCache.has(word.toUpperCase());
  }

  async getRandomWord(): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    const words = Array.from(this.memoryCache);
    return words[Math.floor(Math.random() * words.length)];
  }

  getDictionarySize(): number {
    return this.memoryCache.size;
  }

  async refreshDictionary(): Promise<void> {
    console.log("🔄 Refreshing dictionary...");
    this.isInitialized = false;
    await this.initialize();
  }

  async close(): Promise<void> {
    if (this.redisClient && this.redisClient.isOpen) {
      await this.redisClient.disconnect();
    }
  }
}

// game-service/src/services/GameLogicService.ts
import {
  Game,
  Guess,
  LetterFeedback,
  LetterStatus,
  GameStatus,
} from "../models/Game";
import { DictionaryService } from "./DictionaryService";

export class GameLogicService {
  constructor(private dictionaryService: DictionaryService) {}

  /**
   * Calculate feedback for a guess against the target word
   * Implements proper Wordle logic for duplicate letters
   */
  calculateFeedback(guess: string, targetWord: string): LetterFeedback[] {
    const guessArray = guess.toUpperCase().split("");
    const targetArray = targetWord.toUpperCase().split("");
    const feedback: LetterFeedback[] = [];

    // Track which target positions have been used
    const targetUsed = new Array(5).fill(false);

    // First pass: Mark CORRECT letters (exact position matches)
    for (let i = 0; i < 5; i++) {
      if (guessArray[i] === targetArray[i]) {
        feedback[i] = {
          letter: guessArray[i],
          position: i,
          status: LetterStatus.CORRECT,
        };
        targetUsed[i] = true;
      } else {
        // Initialize as ABSENT, will be updated in second pass if needed
        feedback[i] = {
          letter: guessArray[i],
          position: i,
          status: LetterStatus.ABSENT,
        };
      }
    }

    // Second pass: Mark PRESENT letters (wrong position)
    for (let i = 0; i < 5; i++) {
      if (feedback[i].status !== LetterStatus.CORRECT) {
        // Look for this letter in unused target positions
        for (let j = 0; j < 5; j++) {
          if (!targetUsed[j] && guessArray[i] === targetArray[j]) {
            feedback[i].status = LetterStatus.PRESENT;
            targetUsed[j] = true;
            break;
          }
        }
      }
    }

    return feedback;
  }

  /**
   * Determine game status after a guess
   */
  determineGameStatus(
    guess: string,
    targetWord: string,
    attemptNumber: number
  ): GameStatus {
    if (guess.toUpperCase() === targetWord.toUpperCase()) {
      return GameStatus.WON;
    }

    if (attemptNumber >= 6) {
      return GameStatus.LOST;
    }

    return GameStatus.PLAYING;
  }

  /**
   * Validate a guess
   */
  async validateGuess(
    guess: string
  ): Promise<{ valid: boolean; reason?: string }> {
    // Check length
    if (guess.length !== 5) {
      return { valid: false, reason: "Word must be exactly 5 letters" };
    }

    // Check characters
    if (!/^[A-Za-z]+$/.test(guess)) {
      return { valid: false, reason: "Word must contain only letters" };
    }

    // Check dictionary
    const isValidWord = await this.dictionaryService.validateWord(guess);
    if (!isValidWord) {
      return { valid: false, reason: "Word not found in dictionary" };
    }

    return { valid: true };
  }

  /**
   * Process a guess and return the complete result
   */
  async processGuess(
    game: Game,
    guessWord: string
  ): Promise<{
    feedback: LetterFeedback[];
    gameStatus: GameStatus;
    isCorrect: boolean;
  }> {
    const feedback = this.calculateFeedback(guessWord, game.targetWord);
    const gameStatus = this.determineGameStatus(
      guessWord,
      game.targetWord,
      game.currentAttempt + 1
    );
    const isCorrect = guessWord.toUpperCase() === game.targetWord.toUpperCase();

    return {
      feedback,
      gameStatus,
      isCorrect,
    };
  }
}
