import axios from "axios";
import * as path from "path";
import * as fs from "fs/promises";
import * as crypto from "crypto";

export class WordService {
  private words: Set<string> = new Set();
  private initialized: boolean = false;
  private readonly cacheDir: string;

  constructor() {
    this.cacheDir = process.env.WORD_CACHE_PATH || "./cache";
    this.initializeCache();
  }

  private async initializeCache(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error(
        "Failed to create cache directory:",
        this.getErrorMessage(error)
      );
    }
  }

  // Helper to safely extract error messages
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return "Unknown error occurred";
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log("Initializing WordService...");

    const initializationMethods = [
      { name: "GitHub", method: () => this.loadFromWorkingUrl() },
      { name: "Cache", method: () => this.loadFromCache() },
      { name: "Hardcoded", method: () => this.loadHardcodedWords() },
    ];

    for (const { name, method } of initializationMethods) {
      try {
        await method();
        if (this.words.size > 0) {
          this.initialized = true;
          console.log(
            `WordService initialized from ${name} with ${this.words.size} words`
          );
          return;
        }
      } catch (error) {
        console.warn(
          `${name} initialization failed:`,
          this.getErrorMessage(error)
        );
        continue;
      }
    }

    throw new Error("Failed to initialize WordService with any method");
  }

  private async loadFromWorkingUrl(): Promise<void> {
    console.log("Loading words from GitHub source...");

    const url =
      "https://raw.githubusercontent.com/tabatkins/wordle-list/main/words";

    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          "User-Agent": "Wordle-Game-Service/1.0",
          Accept: "text/plain",
        },
        maxRedirects: 3,
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const words = this.parseWordList(response.data);
      if (words.length === 0) {
        throw new Error("No valid words found in response");
      }

      this.words = new Set(words);
      await this.saveToCache();

      console.log(`Successfully loaded ${this.words.size} words from GitHub`);
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      console.error("Failed to load from GitHub:", errorMessage);
      throw new Error(`GitHub load failed: ${errorMessage}`);
    }
  }

  private parseWordList(content: string): string[] {
    if (!content || typeof content !== "string") {
      return [];
    }

    try {
      // Handle JSON format
      if (content.trim().startsWith("[") || content.trim().startsWith("{")) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return this.validateWords(parsed);
        }
      }
    } catch (parseError) {
      // Not JSON, continue with text parsing
      console.log("Content is not JSON, parsing as text");
    }

    // Handle text format
    const words = content
      .split(/[\s,\n\r]+/)
      .map((word) => word.trim().toUpperCase())
      .filter((word) => /^[A-Z]{5}$/.test(word));

    return this.validateWords(Array.from(new Set(words)));
  }

  private validateWords(words: string[]): string[] {
    return words
      .filter(
        (word) =>
          typeof word === "string" &&
          word.length === 5 &&
          /^[A-Z]+$/i.test(word)
      )
      .map((word) => word.toUpperCase());
  }

  private async saveToCache(): Promise<void> {
    try {
      const cacheData = {
        words: Array.from(this.words),
        timestamp: new Date().toISOString(),
        version: "1.0",
      };

      const cachePath = path.join(this.cacheDir, "words.json");
      await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2), "utf8");

      console.log("Words cached successfully");
    } catch (error) {
      console.error("Failed to save cache:", this.getErrorMessage(error));
    }
  }

  private async loadFromCache(): Promise<void> {
    console.log("Loading words from cache...");

    const cachePath = path.join(this.cacheDir, "words.json");

    try {
      const content = await fs.readFile(cachePath, "utf8");
      const cached = JSON.parse(content);

      if (!cached.words || !Array.isArray(cached.words)) {
        throw new Error("Invalid cache format");
      }

      // Check cache age
      const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
      const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (cacheAge > MAX_CACHE_AGE) {
        console.warn("Cache is old, but using anyway as fallback");
      }

      this.words = new Set(this.validateWords(cached.words));

      if (this.words.size === 0) {
        throw new Error("No valid words in cache");
      }

      console.log(`Loaded ${this.words.size} words from cache`);
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      console.error("Failed to load from cache:", errorMessage);
      throw new Error(`Cache load failed: ${errorMessage}`);
    }
  }

  private loadHardcodedWords(): void {
    console.log("Loading hardcoded word list as final fallback...");

    const hardcodedWords = [
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
      "ASIDE",
      "ASSET",
      "AUDIO",
      "AUDIT",
      "AVOID",
      "AWAKE",
      "AWARD",
      "AWARE",
      "BADLY",
      "BAKER",
      "BASES",
      "BASIC",
      "BATCH",
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
      "BLAST",
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
      "BUILT",
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
      "RIDER",
      "RIDGE",
      "RIGHT",
      "RIGID",
      "RIVAL",
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
      "SIMON",
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
      "SQUAD",
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
      "TEAMS",
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
      "TIMER",
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
      "TRAIL",
      "TRAIN",
      "TRAIT",
      "TRASH",
      "TREAT",
      "TREND",
      "TRIAL",
      "TRIBE",
      "TRICK",
      "TRIED",
      "TRIES",
      "TRUCK",
      "TRULY",
      "TRUNK",
      "TRUST",
      "TRUTH",
      "TWICE",
      "TWIST",
      "TYLER",
      "TYPES",
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
      "USERS",
      "USING",
      "USUAL",
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
      "YIELD",
      "YOUNG",
      "YOUTH",
    ];

    this.words = new Set(hardcodedWords);
    console.log(`Loaded ${this.words.size} hardcoded words`);
  }

  getRandomWord(): string {
    if (!this.initialized) {
      throw new Error("WordService not initialized");
    }

    if (this.words.size === 0) {
      throw new Error("No words available");
    }

    const words = Array.from(this.words);
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = randomBytes.readUInt32BE(0);
    const index = randomNumber % words.length;

    return words[index];
  }

  isValidWord(word: string): boolean {
    if (!this.initialized) {
      throw new Error("WordService not initialized");
    }

    if (!word || typeof word !== "string") {
      return false;
    }

    const normalizedWord = word.trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(normalizedWord)) {
      return false;
    }

    return this.words.has(normalizedWord);
  }

  async refreshWords(): Promise<void> {
    console.log("Manually refreshing word list...");
    this.initialized = false;
    this.words.clear();

    try {
      await this.loadFromWorkingUrl();
      this.initialized = true;
      console.log("Word refresh completed successfully");
    } catch (error) {
      try {
        await this.loadFromCache();
        this.initialized = true;
        console.log("Refresh failed, restored from cache");
      } catch (cacheError) {
        this.loadHardcodedWords();
        this.initialized = true;
        console.log("Refresh failed, using hardcoded words");
      }
    }
  }

  getStatistics() {
    return {
      totalWords: this.words.size,
      initialized: this.initialized,
      lastRefresh: new Date().toISOString(),
      cacheDir: this.cacheDir,
      sampleSize: Math.min(10, this.words.size),
    };
  }

  getWordSample(count: number = 5): string[] {
    if (!this.initialized) return [];
    const words = Array.from(this.words);
    return words.slice(0, count);
  }
}
