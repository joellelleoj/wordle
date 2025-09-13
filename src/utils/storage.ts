import { logger } from "./logger";

interface StorageItem<T> {
  data: T;
  timestamp: number;
  expiresAt?: number;
}

class Storage {
  static set<T>(key: string, value: T, expiresInMs?: number): void {
    try {
      const item: StorageItem<T> = {
        data: value,
        timestamp: Date.now(),
        expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined,
      };

      localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      logger.warn("Failed to save to localStorage", { key, error });
    }
  }

  static get<T>(key: string): T | null {
    try {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return null;

      const item: StorageItem<T> = JSON.parse(itemStr);

      // Check expiration
      if (item.expiresAt && Date.now() > item.expiresAt) {
        this.remove(key);
        return null;
      }

      return item.data;
    } catch (error) {
      logger.warn("Failed to read from localStorage", { key, error });
      this.remove(key);
      return null;
    }
  }

  static remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      logger.warn("Failed to remove from localStorage", { key, error });
    }
  }

  static clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      logger.warn("Failed to clear localStorage", { error });
    }
  }

  static has(key: string): boolean {
    return this.get(key) !== null;
  }
}

export const storage = Storage;
