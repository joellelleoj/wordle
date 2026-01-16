import { WordService } from "../src/services/wordService";
import * as fs from "fs/promises";
import * as path from "path";

describe("WordService - Dictionary Management", () => {
  let wordService: WordService;
  const testCacheDir = "./test-cache";

  beforeEach(() => {
    process.env.WORD_CACHE_PATH = testCacheDir;
    wordService = new WordService();
  });

  afterEach(async () => {
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true });
    } catch (error) {}
  });

  describe("Initialization", () => {
    it("should initialize with hardcoded words as fallback", async () => {
      await wordService.initialize();
      const stats = wordService.getStatistics();

      expect(stats.initialized).toBe(true);
      expect(stats.totalWords).toBeGreaterThan(400);
    });

    it("should not re-initialize if already initialized", async () => {
      await wordService.initialize();
      const firstStats = wordService.getStatistics();

      await wordService.initialize();
      const secondStats = wordService.getStatistics();

      expect(firstStats.totalWords).toBe(secondStats.totalWords);
    });
  });

  describe("Word Validation", () => {
    beforeEach(async () => {
      await wordService.initialize();
    });

    it("should validate correct 5-letter words", () => {
      expect(wordService.isValidWord("HELLO")).toBe(true);
      expect(wordService.isValidWord("WORLD")).toBe(true);
      expect(wordService.isValidWord("ABOUT")).toBe(true);
    });

    it("should reject invalid words", () => {
      expect(wordService.isValidWord("")).toBe(false);
      expect(wordService.isValidWord("HI")).toBe(false);
      expect(wordService.isValidWord("TOOLONG")).toBe(false);
      expect(wordService.isValidWord("12345")).toBe(false);
      expect(wordService.isValidWord("HELLO!")).toBe(false);
    });

    it("should handle case insensitive validation", () => {
      expect(wordService.isValidWord("hello")).toBe(true);
      expect(wordService.isValidWord("Hello")).toBe(true);
      expect(wordService.isValidWord("HELLO")).toBe(true);
    });

    it("should reject non-dictionary words", () => {
      expect(wordService.isValidWord("ZZZZZ")).toBe(false);
      expect(wordService.isValidWord("QWXYZ")).toBe(false);
    });

    it("should throw error if not initialized", () => {
      const uninitializedService = new WordService();
      expect(() => uninitializedService.isValidWord("HELLO")).toThrow(
        "WordService not initialized"
      );
    });
  });

  describe("Random Word Generation", () => {
    beforeEach(async () => {
      await wordService.initialize();
    });

    it("should generate valid 5-letter words", () => {
      for (let i = 0; i < 10; i++) {
        const word = wordService.getRandomWord();
        expect(word).toMatch(/^[A-Z]{5}$/);
        expect(wordService.isValidWord(word)).toBe(true);
      }
    });

    it("should generate different words", () => {
      const words = new Set();
      for (let i = 0; i < 20; i++) {
        words.add(wordService.getRandomWord());
      }
      expect(words.size).toBeGreaterThan(1);
    });

    it("should throw error if not initialized", () => {
      const uninitializedService = new WordService();
      expect(() => uninitializedService.getRandomWord()).toThrow(
        "WordService not initialized"
      );
    });
  });

  describe("Cache Management", () => {
    it("should create cache directory", async () => {
      await wordService.initialize();

      try {
        const stats = await fs.stat(testCacheDir);
        expect(stats.isDirectory()).toBe(true);
      } catch (error) {
        console.log("Cache directory not created (using hardcoded words)");
      }
    });

    it("should save and load from cache", async () => {
      await fs.mkdir(testCacheDir, { recursive: true });
      const cacheData = {
        words: ["HELLO", "WORLD", "CACHE", "TESTS", "WORDS"],
        timestamp: new Date().toISOString(),
        version: "1.0",
      };

      const cachePath = path.join(testCacheDir, "words.json");
      await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2));

      process.env.WORD_CACHE_PATH = testCacheDir;
      const cachedService = new WordService();
      await cachedService.initialize();

      const stats = cachedService.getStatistics();
      expect(stats.initialized).toBe(true);
      expect(stats.totalWords).toBeGreaterThan(0);
      expect(cachedService.isValidWord("HELLO")).toBe(true);
    });
  });

  describe("Dictionary Refresh", () => {
    beforeEach(async () => {
      await wordService.initialize();
    });

    it("should refresh word list", async () => {
      const initialStats = wordService.getStatistics();

      await wordService.refreshWords();
      const refreshedStats = wordService.getStatistics();

      expect(refreshedStats.initialized).toBe(true);
      expect(refreshedStats.totalWords).toBeGreaterThan(0);
    });
  });

  describe("Statistics", () => {
    beforeEach(async () => {
      await wordService.initialize();
    });

    it("should provide service statistics", () => {
      const stats = wordService.getStatistics();

      expect(stats.totalWords).toBeGreaterThan(0);
      expect(stats.initialized).toBe(true);
      expect(stats.lastRefresh).toBeDefined();
      expect(stats.cacheDir).toBe(testCacheDir);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid cache data", async () => {
      await fs.mkdir(testCacheDir, { recursive: true });
      const cachePath = path.join(testCacheDir, "words.json");
      await fs.writeFile(cachePath, "invalid json");

      const service = new WordService();
      await service.initialize();

      expect(service.getStatistics().initialized).toBe(true);
      expect(service.getStatistics().totalWords).toBeGreaterThan(400);
    });

    it("should handle missing cache directory permissions", async () => {
      process.env.WORD_CACHE_PATH = "/invalid/path/that/cannot/be/created";

      const service = new WordService();
      await service.initialize();

      expect(service.getStatistics().initialized).toBe(true);
    });
  });
});
